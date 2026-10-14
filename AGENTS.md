# CyberFishing workspace instructions

Read [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md) before production changes and follow the current owner's instructions.

Before any work affecting design, UI markup, CSS, SVG, HUD, screens or DEV interface components, read [DESIGN_RULES.md](DESIGN_RULES.md) and [docs/styles.md](docs/styles.md). These are mandatory design inputs, including reuse, BEM, tokens, the 320px logical layout and the current inventory/keepnet column counts. Follow the applicable feature spec and preserve unrelated changes.

## Generated artifacts

Remove obsolete logs, execution transcripts, generated archives and temporary fixtures after their task is complete.
Each retained service text file must contain at most 50 latest meaningful records. Omit repetitive Git LF/CRLF
warnings and avoid saving verbose command output without a current diagnostic purpose. Keep generated artifacts
in `utils/tmp/` or `utils/generated/` and run `npm run clean:artifacts` before finishing work that creates them.
The record limit applies to service artifacts; source, specifications, test fixtures, baselines and structured
application data retain their complete contents.
