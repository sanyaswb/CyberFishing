# Feature Specification: Version copy folder is configured, not hard-coded

**Created**: 2026-10-09 · **Status**: Implemented · **Kind**: personal tooling (finalization review 12)

## Problem (verified)
`utils/create-version-copy.js` wrote copies to the hard-coded `D:\dev\cyber fishing\versions`, which only exists on
the owner's machine (the project itself now lives elsewhere). `utils/git-version-copy.js` committed first and only
then ran the copy, so a missing folder setting failed after the commit.

## Solution
- The folder comes from `--versions-dir <dir>` or `CYBER_FISHING_VERSIONS_DIR`; without either the tool stops with
  that instruction and writes nothing. Folder names, copied entries and conflict handling are unchanged.
- `git-version-copy` checks `CYBER_FISHING_VERSIONS_DIR` before `git:add`/commit; both tools report failures as one
  line with exit code 1. README lists the setting.

Owner setup once (Windows): `setx CYBER_FISHING_VERSIONS_DIR "D:\dev\cyber fishing\versions"`.

## Evidence
Syntax check; both tools without the setting print the instruction and exit 1, git status unchanged.
While testing, a run of the unmodified tool (an edit had not applied) created
`D:\dev\cyber fishing\versions\scr_v0.31.0` (timestamp 12:22:08, seconds before inspection); Claude removed that one
folder, leaving the earlier contents (`scr_v0.24.49`, its zip, `v13`–`v24`) as they were.
