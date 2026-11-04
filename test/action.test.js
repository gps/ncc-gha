import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import nccPackage from '@vercel/ncc/package.json' with { type: 'json' };

const root = fileURLToPath(new URL('../', import.meta.url));

function fixture(t, { mainFile = 'index.js', trackedDist = false } = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ncc-gha-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const work = path.join(dir, 'work');
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(work);
    fs.mkdirSync(bin);
    const git = (...args) => execFileSync('git', args, { cwd: work, encoding: 'utf8' }).trim();
    execFileSync('git', ['init', '--bare', path.join(dir, 'fixture.git')]);
    git('init', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    fs.writeFileSync(path.join(work, 'package.json'), '{"name":"fixture","version":"1.0.0"}\n');
    fs.writeFileSync(path.join(work, '.gitignore'), 'node_modules/\n');
    fs.writeFileSync(path.join(work, mainFile), 'console.log("fixture compiled");\n');
    const ncc = path.join(root, 'node_modules/@vercel/ncc/dist/ncc/cli.js');
    if (trackedDist) {
        execFileSync(process.execPath, [ncc, 'build', mainFile, '--license', 'licenses.txt'], { cwd: work });
    }
    git('add', '.');
    git('commit', '-m', 'Initial fixture');
    git('remote', 'add', 'origin', path.join(dir, 'fixture.git'));
    git('push', 'origin', 'main');

    // Keep the test offline while checking the exact npm exec package selection.
    // Compilation and Git operations use the real tools.
    fs.writeFileSync(path.join(bin, 'npm'), `#!${process.execPath}
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const args = process.argv.slice(2);
if (args[0] === 'install') {
    execFileSync(process.execPath, [process.env.TEST_NPM, 'install', '--offline'], { stdio: 'inherit' });
} else {
    assert.deepEqual(args.slice(0, 5), ['exec', '--yes', '--package=@vercel/ncc@${nccPackage.version}', '--', 'ncc']);
    execFileSync(process.execPath, [process.env.TEST_NCC, ...args.slice(5)], { stdio: 'inherit' });
}
`, { mode: 0o755 });
    const run = (input = '') => spawnSync(process.execPath, [path.join(root, 'dist/index.js')], {
        cwd: work,
        encoding: 'utf8',
        env: {
            ...process.env,
            PATH: `${bin}${path.delimiter}${process.env.PATH}`,
            TEST_NPM: process.env.npm_execpath,
            TEST_NCC: ncc,
            INPUT_TOKEN: 'fixture-token',
            INPUT_MAIN_FILE_PATH: input,
            GITHUB_SERVER_URL: `file://${dir}`,
            GITHUB_REPOSITORY: 'fixture',
            GITHUB_REF: 'refs/heads/main',
            GITHUB_EVENT_NAME: 'push',
            GITHUB_EVENT_PATH: '',
            GITHUB_ACTOR: 'fixture-bot'
        }
    });
    return { work, git, run };
}

test('bundled action compiles the default entry and pushes the generated distribution', (t) => {
    const { work, git, run } = fixture(t);
    const result = run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(git('log', '-1', '--format=%s'), 'Generate distribution');
    assert.equal(git('rev-parse', 'HEAD'), git('ls-remote', 'repo', 'refs/heads/main').split(/\s/)[0]);
    assert.equal(execFileSync(process.execPath, [path.join(work, 'dist/index.js')], { encoding: 'utf8' }).trim(), 'fixture compiled');
    assert.equal(fs.readFileSync(path.join(work, 'package.json'), 'utf8'), '{"name":"fixture","version":"1.0.0"}\n');
});

test('bundled action accepts a custom entry and skips committing unchanged output', (t) => {
    const { git, run } = fixture(t, { mainFile: 'custom.js', trackedDist: true });
    const before = git('rev-parse', 'HEAD');
    const result = run('./custom.js');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(git('rev-parse', 'HEAD'), before);
    assert.match(result.stdout, /Node js module is up to date/);
});

test('bundled action reports a compilation failure without pushing a commit', (t) => {
    const { git, run } = fixture(t);
    const before = git('rev-parse', 'HEAD');
    const result = run('./missing.js');
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /::error::/);
    assert.equal(git('rev-parse', 'HEAD'), before);
});
