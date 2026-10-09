# Feature Specification: Immutable Pages release directories

**Created**: 2026-10-09 · **Status**: Implemented (tool and check; publishing is the owner's step) · **Kind**:
deployment (owner decision 1 in [follow-up decisions](../029-backend-foundation/follow-up-decisions.md))

## Problem (verified)
Only the entry and the 22 stylesheets carry `?v=`; the 466 production modules do not, so a cached page could combine
old and new modules after a deploy. The demo is a manual snapshot on `gh-pages` (still v0.23.39, classic scripts at
the branch root).

## Solution
`npm run release:pages -- --site <gh-pages checkout> [--ref <commit>]` (`utils/build-pages-release.js`):
- Release id `<CURRENT_PROJECT_VERSION>-<7-char commit>`; files are the committed blob bytes (`git ls-tree` +
  one `git cat-file --batch` per import level), never the working tree.
- Contents: `index.html`, its stylesheets, the module graph of its entry (static, re-export and literal dynamic
  imports, as the guard follows them) and every tracked file under `assets/` (runtime paths are built from data).
  DEV modules and `dev.html` are not part of the graph and are not published.
- Written to `releases/<id>.partial-<pid>` and renamed, so an interrupted build never leaves a partial release under
  its id. An existing `releases/<id>` is refused ("never overwritten"); nothing else in the site is removed, so older
  releases and the old root files stay for cached pages.
- Root `index.html` = the release page with `<base href="releases/<id>/">` as the first `<head>` child, so the
  stylesheets, the entry and runtime asset URLs (images, audio fetch) all resolve inside the release; modules import
  relative to themselves. The build fails on paths GitHub Pages would hide (`_`/`.` segments).
- README documents the worktree workflow; committing and pushing `gh-pages` stays manual.

No import map or service worker. Game code, saves and timing are untouched.

## Evidence
Architecture 2/2, Quick 13/13, Full 39/39 (new `pages-release` check in the tools suite: builds HEAD into a temporary
site and proves the id, released stylesheets/entry/assets, no DEV files, a closed module graph, committed bytes, the
base-resolved root page, retained earlier release and root files, refused overwrite, rejected external stylesheet;
1.7 s). Game-cycle digest unchanged `7b9baea3…ed5b6`.
Trial site by Claude: `0.31.0-44d560f`, 506 files (page, 22 stylesheets, 466 modules, 17 assets), 5.08 MB, served
under `/CyberFishing/` from a local static server in the desktop browser pane: the root page loads v0.31.0 with
`document.baseURI` inside the release, no resource outside it, the game restarts and runs, 0 errors; the release URL
itself also loads. A second build was refused; the earlier release and old root file stayed. Not published.
