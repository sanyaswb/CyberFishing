# CyberFishing

Browser fishing game (native ES modules, Canvas 2D). [Demo](https://sanyaswb.github.io/CyberFishing/)

- `npm run dev` — local server at http://127.0.0.1:4173/ (`index.html` game, `dev.html` with DEV tools)
- `npm run check` — syntax, architecture guard and behavior tests
- Architecture: [docs/architecture.md](docs/architecture.md); rules: [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md)
- `npm run copy:version` — copies the sources to `<versions dir>/scr_v<version>`; set `CYBER_FISHING_VERSIONS_DIR` (or pass
  `-- --versions-dir <dir>`)

## Publishing (GitHub Pages)

Each release is an immutable directory `releases/<version>-<commit>/` on the `gh-pages` branch with the committed
page, stylesheets, production modules and assets; the root `index.html` points at the newest one through
`<base href>`. Older directories and files stay, so cached pages keep a consistent set of files.

```bash
git worktree add ../cyber-fishing-pages gh-pages
npm run release:pages -- --site ../cyber-fishing-pages
```

The script builds the committed `HEAD` (or `--ref <commit>`) and refuses to overwrite a published release. Review the
site checkout, then commit `releases/<id>` and `index.html` there and push `gh-pages`.
