# ncc-gha

“Builds” a JS GitHub Action into a `dist/index.js` using @vercel/ncc

Runs on Node.js 24 and requires a GitHub Actions runner that supports `node24`.
The compiler version matches the version locked for this action, without adding
ncc to the target project’s dependencies.

## Development

Use Node.js 24 or later. Run `npm ci` and `npm run build` before committing.
Include the generated `dist` files in the commit. Pull requests check that the
bundle is committed; pushes to master allow the release workflow to regenerate it.

The action updates branch refs and pull requests from the same repository.
Tag refs and fork pull requests are skipped with a notice because they cannot
receive a distribution commit through this action’s repository token.

## Inputs

### `TOKEN`

The GitHub token used to authenticate with GitHub.

**Required**

### `MAIN_FILE_PATH`

Path to main js file which will be used to generated `dist/index.js`. Default value is `./index.js`.

## Example Usage

```yml
- name: Compile Node.js module into a single file
  uses: gps/ncc-gha@master
  with:
    TOKEN: ${{ secrets.GITHUB_TOKEN }}
    MAIN_FILE_PATH: ./main.js
```
