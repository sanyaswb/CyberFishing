# CyberFishing workspace instructions

Read [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md) before production changes and follow the current owner's instructions.

Before any work affecting design, UI markup, CSS, SVG, HUD, screens or DEV interface components, read [DESIGN_RULES.md](DESIGN_RULES.md) and [docs/styles.md](docs/styles.md). These are mandatory design inputs, including reuse, BEM, tokens, the 320px logical layout and the current inventory/keepnet column counts. Follow the applicable feature spec and preserve unrelated changes.

## Owner checks and versions

- Visual checks in a browser (screenshots, side-by-side or pixel comparisons, clicking through the game to look at a
  result) are the owner's: the owner does them faster and better. Run the automated checks (`npm run check` and the
  focused checks) yourself, and end each delivered change with a short list of exactly what the owner should look at
  and where (page, orientation, steps). Say plainly that no visual check was done.
- Every delivered change bumps the patch version (`src/game/presentation/version/project_version.js`,
  `package.json`/`package-lock.json`, the `?v=` links of `index.html`, `dev.html` and `ui-catalog.html`) with a short
  `CHANGELOG.md` entry, so the owner can tell which build has which change. A new or changed mechanic bumps the minor
  version only after the owner's explicit instruction. Until then, increment only the patch, including for new or
  changed mechanics (owner instruction, 2026-10-20; overrides the former automatic minor-bump rule).

## Generated artifacts

Remove obsolete logs, execution transcripts, generated archives and temporary fixtures after their task is complete.
Each retained service text file must contain at most 50 latest meaningful records. Omit repetitive Git LF/CRLF
warnings and avoid saving verbose command output without a current diagnostic purpose. Keep generated artifacts
in `utils/tmp/` or `utils/generated/` and run `npm run clean:artifacts` before finishing work that creates them.
The record limit applies to service artifacts; source, specifications, test fixtures, baselines and structured
application data retain their complete contents.
