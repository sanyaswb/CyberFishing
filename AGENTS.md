# CyberFishing workspace instructions

Record each new development task from the owner in `tasks.md` before implementation. Keep completed
implementation marked `[x]` separately from pending owner visual checks (owner instruction, 2026-10-22).

Small tasks and large changes (owner instruction, 2026-10-22):
- A **small task** (a fix, a control, a label, a contained change in one module or screen) is written as a `TK-NNN`
  entry in `tasks.md`: what the owner asked, what was found, what will change, how it is checked, and the owner's
  check. It is implemented directly from that entry.
- A **large change** (a new or changed mechanic, a new input, render or data path, a change across several modules or
  layers, a new DEV tool, anything that needs owner decisions) is developed through a specification first:
  `specs/NNN-name/spec.md` with the problem, the decisions (owner questions marked), the model, the checks and the
  owner's acceptance. `tasks.md` then lists its tasks, each referring to the spec, and the spec records what was
  implemented. When unsure, treat the change as large.

Read [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md) before production changes and follow the current owner's instructions.

Before changing tools or tests, read [utils/UTILS_RULES.md](utils/UTILS_RULES.md). Prioritize deterministic functional
scenarios; the owner checks appearance. The final Full check includes Quick and Architecture: do not repeat the
same suites on unchanged code.

Before any work affecting design, UI markup, CSS, SVG, HUD, screens or DEV interface components, read [DESIGN_RULES.md](DESIGN_RULES.md) and [docs/styles.md](docs/styles.md). These are mandatory design inputs, including reuse, BEM, tokens, the 320px logical layout and the current inventory/keepnet column counts. Follow the applicable feature spec and preserve unrelated changes.

## Owner checks

- Visual checks in a browser (screenshots, side-by-side or pixel comparisons, clicking through the game to look at a
  result) are the owner's: the owner does them faster and better. Run the automated checks (`npm run check` and the
  focused checks) yourself, and end each delivered change with a short list of exactly what the owner should look at
  and where (page, orientation, steps). Say plainly that no visual check was done.
- A rendering change (renderers, passes, styles of world overlays, Pixi/Canvas drawing, assets) also needs the owner's
  phone measurement in both orientations with the DevTools overlay "ПРОДУКТИВНІСТЬ" (docs/rendering.md): say so.

## Versions (owner instructions, 2026-10-20 … 2026-10-23)

- **Patch: one per completed task.** Every completed task (a whole `TK-NNN` or spec step, not each intermediate edit)
  bumps the patch version (`0.47.N` → `0.47.N+1`) with a short `CHANGELOG.md` entry (1–3 lines), so the owner can tell
  which build has which change. The version lives in `src/game/presentation/version/project_version.js` (version and
  release note), `package.json`/`package-lock.json` and the `?v=` links of `index.html`, `dev.html` and
  `ui-catalog.html`; change all of them together.
- **Minor: only after the owner's explicit approval**, also for a new or changed mechanic. Until then increment only
  the patch. Never bump the major.
- Keep the version, `CHANGELOG.md` and its archive consistent: the latest 10 entries in `CHANGELOG.md`, the oldest
  moved to the archive with every bump, no duplicate or missing versions. Work from another session may have bumped the
  version meanwhile: read the current version and `git log` before bumping and continue from the real latest number.

## Commits

- Commit **locally after each completed task**, once its focused checks and one Full run pass. Read the runner's exit
  code (or its full summary line): never pipe the run through `tail`/`grep` in a way that hides a failure, and never
  commit on a failed run.
- Stage explicit paths only (`git add <paths>`), never `git add -A`/`git add .`. Leave the owner's untracked files
  (zone exports `zones-*.json`, `.agents/`, `.specify/`, local tools) out unless the owner asks to commit them. Never
  commit `CLAUDE.md`, `CODEX.md`, `.claude/` or agent memory.
- A factual message: what changed, why (the cause for a fix), how it was checked, and whether the game-cycle report
  changed. Tracked text stays LF.
- Stage new files before `npm run struct` and commit the regenerated `project-structure.txt` when it changes.
- Never `git stash`, `git reset --hard`, `git checkout -- <file>` or force pushes. To compare against an older version
  of a file, save the current file, write `git show HEAD:<file>` into place, run the check, then restore the saved file
  byte for byte (`cmp`).

## Pushes and Pages releases

- **Push only on the owner's command** ("Коміт пуш" or an explicit "push"). Then `develop` and the GitHub Pages
  release go together: `git push origin develop`, then `npm run release:pages -- --site ../cyber-fishing-pages`, commit
  the site checkout (releases, root `index.html`, `dev.html`, `ui-catalog.html`) and push `gh-pages`. Report both
  commits and the kept previous release.
- **Before every push** move finished tasks from `tasks.md` to `tasks-archive.md` (rule at the top of `tasks.md`); the
  owner's open checks stay in `tasks.md` with a link to the archived implementation.
- Before a release check that every runtime asset path is tracked (`git ls-files`); Pages ships tracked files only, and
  released raster art is WebP (`pages-release` check).
- Never publish or proxy the owner's code through third-party hosting or CDN mirrors; test builds go to `gh-pages` only.

## Working rules learned in practice

- **Record every significant defect in [docs/incidents.md](docs/incidents.md)** (owner instruction, 2026-10-30): a
  defect that breaks the game, loses progress, wastes an owner test round or took more than one attempt to find gets an
  entry in the same commit as its fix — what was seen, the cause as a mechanism with the place in the code, the fix, the
  architectural rule that prevents it, and the check that catches it. Read the incidents (and their rules table) of an
  area before changing it, so a solved problem is not investigated again.
- **Explain from evidence.** When the owner asks why something happens, reproduce it first (Node on the real config,
  catalogs and maps, or a disposable copy of a check in `utils/tmp/<dir>/`, removed afterwards) and name the exact cause
  with file and line before proposing a fix.
- **A fix comes with a check that fails on the old code.** Prove it once (old file in place, check fails; new file,
  check passes).
- **Checks never write project sources.** Scenarios that write files work in the OS temp folder or scratch space.
- **Library doubles must keep the library's contract** (DEVELOPMENT_RULES "Library contracts and their test doubles");
  objects from the sandboxed source runtime are compared by value after copying them into the test realm.
- **Parent dependencies in DevTools** use the declared prerequisites (spec 131): a switch that cannot work while its
  parent is off is blocked and highlights the parent; showing never depends on editing switches.
- **Read real data, do not change it for display.** DEV previews read game values through the game's own classes; they
  never edit item, fish or physics values unless the owner asks for that exact value.
- **Image conversions** only through `utils/convert-images.js` (`--batch`); the master moves to `asset-sources/`.
- **Gameplay changes** need a `docs/gameplay_backlog.md` entry and an unchanged game-cycle report or an owner-approved
  re-baseline with its reason (DEVELOPMENT_RULES "Gameplay changes").
- **Shell edits:** prefer the file tools; large heredocs with quotes or backticks break in this shell, so write a small
  script file and run it.

## Development history

Keep active development history concise. CHANGELOG.md retains only the latest 10 release entries; move older complete entries to [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>) in numeric descending version order, merging identical entries without duplicates. Follow the retention policy in DEVELOPMENT_RULES.md.

## Generated artifacts

Remove obsolete logs, execution transcripts, generated archives and temporary fixtures after their task is complete.
Each retained service text file must contain at most 50 latest meaningful records. Omit repetitive Git LF/CRLF
warnings and avoid saving verbose command output without a current diagnostic purpose. Keep generated artifacts
in `utils/tmp/` or `utils/generated/` and run `npm run clean:artifacts` before finishing work that creates them.
The record limit applies to service artifacts; source, specifications, test fixtures, baselines and structured
application data retain their complete contents.
