# Stage 3 evidence archive anchor

Owner decision 2026-10-01: the migration history (history replays, per-batch evidence, before-images and the
checks that reconstruct or hash them) leaves the working tree of `develop`. Before the removal, one final
acceptance Full ran on the complete tree:

- tested commit: `04d3f5a9ffaed0bf2ca0f075cfe945f695d10b89` (source tree fingerprint unchanged during the run);
- result: 251 of 251 checks executed and passed, 0 cached, 0 isolation violations;
- run: 2026-10-01 08:46–09:57 UTC (`node utils/run-checks.js --acceptance`);
- report: `stage3_final_acceptance.json` in this directory.

The annotated tag `stage3-evidence-archive` and the branch `migration-archive` point at the commit that adds
this anchor; every archived check still runs there unchanged. Releases v0.24.46 and later keep their tags.
The archived checks are listed in `ARCHIVED_CHECKS.md` (added by the cleanup commit on `develop`).

## Stage 4 closure evidence

`stage4_final_acceptance.json`: final v0.25.2 working-tree acceptance, 64/64 executed,
0 cached/isolation violations, source unchanged. The closure record links its exact digest,
Quick/Architecture results, M1 retrospective class-body audit and actual Codex browser smoke.
The only later deltas are verification evidence and informational documents. Historical Stage 3
acceptance above remains unchanged. M2 unused tooling is recoverable at stage4-m2-tools-archive.
