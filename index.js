import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { simpleGit } from 'simple-git';
import fs from 'node:fs';
import nccPackage from '@vercel/ncc/package.json' with { type: 'json' };

const env = process.env;

async function run() {
    const token = core.getInput('TOKEN');
    core.setSecret(token);
    var mainFilePath = core.getInput('MAIN_FILE_PATH');

    if (!mainFilePath) {
        mainFilePath = './index.js';
    }

    try {
        const url = `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}.git`.replace(/^https:\/\//, `https://x-access-token:${token}@`);
        var branch;
        if (github.context.eventName == 'pull_request') {
            branch = github.context.payload.pull_request.head.ref;
        } else {
            branch = github.context.ref.replace("refs/heads/", "");
        }

        const git = simpleGit();
        await git.addRemote('repo', url);
        await git.fetch('repo');
        await git.checkout(branch);

        const distFolderAlreadyExists = fs.existsSync('./dist');
        await exec.exec('npm install');
        await exec.exec('npm', [
            'exec', '--yes', `--package=@vercel/ncc@${nccPackage.version}`, '--',
            'ncc', 'build', mainFilePath, '--license', 'licenses.txt'
        ]);
        

        // check for git diff
        const diff = await exec.exec(
            'git', ['diff', '--quiet'], {ignoreReturnCode: true}
        );
    
        if (diff || !distFolderAlreadyExists) {
            await core.group('push changes', async () => {
                await git.addConfig('user.email', `${env.GITHUB_ACTOR}@users.noreply.github.com`);
                await git.addConfig('user.name', env.GITHUB_ACTOR);
                await git.add('./dist');
                await git.commit("Generate distribution");
                await git.push('repo', branch);
            });
        } else {
            console.log("Node js module is up to date.");
        }
    } catch(error) {
        core.setFailed(error);
    }
}

run();
