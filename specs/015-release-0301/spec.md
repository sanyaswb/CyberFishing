# Release Specification: 0.30.1 cleanup closure

**Branch**: `develop` · **Created**: 2026-10-08

## Scope
Close handoff steps 1–11: write-only progression styles, metadata-aware optional tier badges,
test-only capacity policy, comments, dead readiness APIs, diagnostics naming, perspective ownership,
tracked-file structure generation, release and local context. Keep ratingTier available for balance
overrides and absent from production. Gameplay, formulas, timing and schema 4 saves stay unchanged.

## Release requirements
- Update package/lock/UI version, codename/notes, both page cache versions and short CHANGELOG.
- Generate project-structure from Git after staging all new files.
- Architecture, Quick, Full, handoff game-cycle SHA256, Chrome game/DEV smoke.
- Fresh clone: npm ci, npm run check and npm run struct with byte-identical structure output.
- Commit facts, annotated v0.30.1 tag, push develop and that tag; keep local notes/memory untracked.

## Validation
Accepted: Architecture 2/2, Quick 13/13, Full 38/38; 19 guard fixtures; production 463/654, DEV 569/839.
Game-cycle SHA256 `7b9baea38feaa4b550e20bc2d22d5eed7875a8c7fb6f3fdf9e176ddf573ed5b6` unchanged.
Chrome smoke performed by Codex through computer-use: world renders; both entries show v0.30.1;
both inventories have 20 cards and no console errors. Fresh clone: npm ci installs 21 packages,
npm run check 38/38; npm run struct leaves the clone clean with all 688 tracked files and structure SHA256
`ea55db4f0386e950ec23ef3cd2a504e004ee3e893a62592d6e81c4cc3e65d05e`.
Local CLAUDE.md reduced to 36 lines; memory/resume updated, original context backed up and kept untracked.
The parallel user move of convert-images.js to utils/ is preserved outside this release's index.
