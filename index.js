const exec = require('@actions/exec');
const core = require('@actions/core');
const env = process.env;

async function run() {
    const token = core.getInput('TOKEN');
    var mainFilePath = core.getInput('MAIN_FILE_PATH')

    if (!mainFilePath) {
        mainFilePath = './index.js'
    }

    try {
        await exec.exec('npm install');
        await exec.exec('npm i @vercel/ncc');
        await exec.exec('ncc', ['build', mainFilePath, '--license', 'licenses.txt']);
    
        // check for git diff
        const diff = await exec.exec(
            'git', ['diff', '--quiet'], {ignoreReturnCode: true}
        );
    
        if (diff) {
            await core.group('push changes', async () => {
                const actor = env.GITHUB_ACTOR
                await exec.exec('git', ['config', 'user.name', actor]);
    
                const branch = pr.head.ref;
                await exec.exec('git', ['checkout', 'HEAD', '-b', branch]);
    
                await exec.exec('git', ['add', './dist']);
    
                await exec.exec('git', ['commit', '-m', 'Use  @vercel/ncc']);
                const url = pr.head.repo.clone_url.replace(/^https:\/\//, `https://x-access-token:${token}@`);
    
                await exec.exec('git', ['push', url, 'HEAD']);
            });
        } else {
            console.log("Node.js module is up to date.");
        }
    } catch(error) {
        core.setFailed(error);
    }
}

run();
