# Feature Specification: Generate the project tree only from Git-tracked files

**Branch**: `develop` · **Created**: 2026-10-08 · **Kind**: delegated tooling decision

## Decision and requirements
Replace the filesystem-scanning `struct` CLI with `node utils/project-structure.js`, using `git ls-files -z`.
This is the sole tracked-file inventory; ignored/untracked local CLAUDE.md, CODEX.md and memory never enter
the artifact. Sort tree children deterministically and preserve the existing UTF-8 tree format and output path.
Fail if Git fails; do not silently fall back to a filesystem scan. Support Git on PATH and its conventional
Windows installation location, plus an explicit `GIT_EXECUTABLE` override. Remove the now-unused CLI dependency.

## Acceptance
Run the package script after staging new files; verify its file leaves exactly equal `git ls-files`, local notes
are absent, consecutive output hashes match, and a fresh clone can run it with unchanged output.
Architecture, Quick, Full and unchanged game-cycle digest; lockfile updated without unrelated dependency upgrades.

Implemented: all 687 tree leaves equal the Git index, local notes excluded, repeat generation byte-identical.
Remaining lock entries unchanged except tslib becoming optional (its only remaining path is sharp's optional
@emnapi/runtime). Architecture 2/2, Quick 13/13, Full 38/38, unchanged game-cycle digest. Fresh-clone proof
is part of release acceptance. Production/browser source is unchanged by this tooling step.
