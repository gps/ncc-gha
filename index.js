import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { simpleGit } from 'simple-git';
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
        let branch;
        if (github.context.eventName == 'pull_request') {
            const head = github.context.payload.pull_request.head;
            if (head.repo?.full_name !== env.GITHUB_REPOSITORY) {
                core.notice('Skipping fork pull request: the repository token cannot push to the fork.');
                return;
            }
            branch = head.ref;
        } else {
            if (!github.context.ref.startsWith('refs/heads/')) {
                core.notice('Skipping non-branch ref: distribution updates require a branch.');
                return;
            }
            branch = github.context.ref.slice('refs/heads/'.length);
        }

        const url = `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}.git`.replace(/^https:\/\//, `https://x-access-token:${token}@`);
        const git = simpleGit();
        await git.addRemote('repo', url);
        await git.fetch('repo', `refs/heads/${branch}`);
        await git.checkout(['-B', branch, 'FETCH_HEAD']);

        await exec.exec('npm install');
        await exec.exec('npm', [
            'exec', '--yes', `--package=@vercel/ncc@${nccPackage.version}`, '--',
            'ncc', 'build', mainFilePath, '--license', 'licenses.txt'
        ]);

        const distChanges = await git.raw(['status', '--porcelain', '--untracked-files=all', '--', 'dist']);
        if (distChanges.trim()) {
            await core.group('push changes', async () => {
                await git.addConfig('user.email', `${env.GITHUB_ACTOR}@users.noreply.github.com`);
                await git.addConfig('user.name', env.GITHUB_ACTOR);
                await git.add('./dist');
                await git.commit("Generate distribution");
                await git.push('repo', `HEAD:refs/heads/${branch}`);
            });
        } else {
            console.log("Node js module is up to date.");
        }
    } catch(error) {
        core.setFailed(error);
    }
}

run();
