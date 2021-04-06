# ncc-gha
"Builds" a JS GitHub Action into a `dist/index.js` using @vercel/ncc

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
    MAIN_FILLE_PATH: ./main.js
```
