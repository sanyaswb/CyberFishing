# CyberFishing

Browser fishing game (native ES modules, Canvas 2D). [Demo](https://sanyaswb.github.io/CyberFishing/)

- `npm run dev` — local server at http://127.0.0.1:4173/ (`index.html` game, `dev.html` with DEV tools)
- UI patterns: DEV tools → `Каталог UI 🧩` opens `ui-catalog.html` over the paused game; `← До DevTools` returns to the same session. The standalone page shows isolated production component examples, states and responsive widths; [validation guide](specs/057-modular-ui-catalog/quickstart.md)
- DEV House: DevTools → `Будинок рибалки 🏠` opens the House screen over the paused game in the same page (spec 084); `dev.html?screen=house` opens it after startup. In production the future lobby will open it. DEBUG → `Прискорення ⏩` enables clock clicks: ×1.5, then +0.5 through ×5, then ×1. Clock, day/night and House lighting advance together; production stays passive.
- `npm run check` — syntax, architecture guard and behavior tests
- `npm run clean:artifacts` — keep at most 50 meaningful records per service text file in temporary/log/archive folders; remove empty files and repetitive Git LF/CRLF warnings
- Architecture: [docs/architecture.md](docs/architecture.md); rules: [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md)
- Rod movement: [controls and gameplay](docs/rod_lateral_movement.md); [animation reference](docs/rod_animation_reference.md)
- After casting: [lateral control, bite reactions and configuration](docs/cast_rod_control.md)
- Rod tension: [dash compensation, line straightening and float tilt](docs/rod_tension_compensation.md)
- Before UI/design work: [DESIGN_RULES.md](DESIGN_RULES.md); style ownership: [docs/styles.md](docs/styles.md)
- `npm run copy:version` — copies the sources to `<versions dir>/scr_v<version>`; set `CYBER_FISHING_VERSIONS_DIR` (or pass
  `-- --versions-dir <dir>`)

## Publishing (GitHub Pages)

Each release is an immutable directory `releases/<version>-<commit>/` on the `gh-pages` branch with the committed
game, DEV, house and UI catalog pages, their stylesheets and module graphs, and assets. The root `index.html`, `dev.html` and `ui-catalog.html`
point at the newest release through `<base href>`. Older directories and files stay, so cached pages keep a
consistent set of files. The public DEV build is available at
[sanyaswb.github.io/CyberFishing/dev.html](https://sanyaswb.github.io/CyberFishing/dev.html).

```bash
git worktree add ../cyber-fishing-pages gh-pages
npm run release:pages -- --site ../cyber-fishing-pages
```

The script builds the committed `HEAD` (or `--ref <commit>`) and refuses to overwrite a published release. Review the
site checkout, then commit `releases/<id>`, `index.html`, `dev.html` and `ui-catalog.html` there and push `gh-pages`.
