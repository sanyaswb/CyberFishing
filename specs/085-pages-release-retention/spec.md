# Pages release retention

Owner decision, 2026-10-15: gh-pages accumulated twelve releases (about 540 MB, nine of them before the WebP
conversion) and an unused copy of the project tree in its root from before the release builder (spec 038). Keep only
what is served; the builder must not let releases pile up again.

## Change

- `PagesReleaseBuilder.build(site, { keep })`, CLI `npm run release:pages -- --site <checkout> [--keep 1|2]`:
  after the new release is written and the root pages point to it, every other `releases/<id>` directory is removed
  except, with `keep` 2 (default), the release the root page served before (read from its `<base href>`). Open tabs of
  the previous version and a quick rollback keep working; nothing older stays. Other root files are not touched;
  interrupted `.partial-*` staging directories are left for inspection. The result reports `previous` and `removed`.
- One-off cleanup of gh-pages (publish commit after `ae54364f`): removed releases 0.31.0 … 0.36.0-6708c50 and the old
  root project copy (`CHANGELOG.md`, `FORCODEX.md`, `README.md`, `assets/`, `backend/`, `docs/`, `package.json`,
  `project-structure.txt`, `src/`, `utils/`). The site keeps `index.html`, `dev.html`, `ui-catalog.html`,
  `.gitignore` and `releases/0.36.0-75faed8`. Git history of the gh-pages branch still holds the removed files.

## Verification

Pages release check: the previously live release is kept, an older one is removed, the root page loads the new
release, `keep` outside 1–2 is refused, root files stay. Full.
