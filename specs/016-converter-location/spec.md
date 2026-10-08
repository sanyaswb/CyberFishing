# Feature Specification: Commit the owner's converter move into utils

**Branch**: `develop` · **Created**: 2026-10-08 · **Kind**: owner-authorized tool relocation

The owner moved `convert-images.js` to `utils/` and authorized committing it with the cleanup.
Because v0.30.1/c69cfc3 is already published, use a follow-up commit without rewriting the tag/history.
Set BASE_DIR to the parent of utils so searches and the original-file backup keep the project-root scope.
Keep all other converter code/behavior unchanged; regenerate the tracked-file project structure.

Acceptance: compare old/new source except the base-dir declaration; isolated VM startup proves identical
search patterns with no image/filesystem writes. Architecture, Quick, Full and unchanged game-cycle digest.
Browser smoke is unnecessary: this Node tool is reachable from neither browser entry.

Implemented: source differs only in BASE_DIR; isolated startup/search parity passes with no file writes.
Architecture 2/2, Quick 13/13, Full 38/38; runtime graphs and game-cycle SHA256 unchanged.
