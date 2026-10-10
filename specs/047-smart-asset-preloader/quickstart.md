# Validation Guide: Smart Asset Preloader

**Date**: 2026-10-10 · **Status**: design scenarios, not implementation results.

## Current Repository Checks

These commands already exist. Run during implementation from the repository root; they do not prove the proposed features until corresponding focused checks are added.

```powershell
npm run check:architecture
npm run check:quick
npm run check
node utils/run-checks.js --check platform-runtime
node utils/run-checks.js --check game-application-composition
node utils/run-checks.js --check game-cycle
node utils/run-checks.js --check pages-release
```

Before first runtime change capture game-cycle stdout/digest and cold-browser baseline. Current spec 046 records digest beginning `7b9baea3`; capture actual output instead of assuming that abbreviated history is current evidence. Changes to loading order are authorized; gameplay output must remain byte-identical.

Docs-only delivery: inspect Markdown references, requirements/contract consistency, current evidence and diff. Architecture/Quick/Full/browser are required for later code, not claimed as run for this design.

## Focused Deterministic Scenarios to Add

| Scenario | Evidence |
| --- | --- |
| Startup minimum vs queued High/locked | Until minimum ready zero upgrades/prefetch; exact demand order |
| Promotion/concurrency | Required action before every pending background; max4 network/max1 speculative/max1 preparation |
| Two consumers/cancel one | One physical load; other resolves; release idempotent |
| Retry/timeout/decode fail | Bounded attempts, no unhandled rejection, explicit Retry cycle |
| Missing tier/format/catalog stale | Deterministic fallback, critical failure only if no allowed minimum |
| Partial High/late Low/stale scene | Prior visual retained; atomic swap; no accidental downgrade/stale activation |
| Budget+overlap+pinned excess | Optional defers, unpinned evicts, active never evicts; diagnosed soft overflow |
| Visibility/network hints missing | Defaults work; background suspended/resumes under gates |
| Exact depth and existing blending | Same depth pixels/grid/dynamic zones, phase alpha values, RNG/time/save |
| Converter missing dependency | Game/server/tree still usable; dimensions cached/unknown; no implicit install |
| Selective source/outputs | Only selected immutable variants; originals byte-identical; names/tree preserved |
| Conflicts/stale plan/symlink/cancel | No active catalog corruption, no escape, no partial publish |
| Crash before/after catalog commit | Prior generation usable or new complete generation; orphan not active |
| Spine absent/corrupt/incompatible | Static scene works; no unused runtime download |
| Multi-page Spine/context loss | Queue caps respected, coherent tier, backing image retained until texture disposal |
| Production graph/immutable release | No DEV/tools; literal module paths; correct `<base>` URLs, old release intact |

Register focused new checks in the existing runner. Не створювати tests, що просто дублюють getters або UI labels; перевіряти order, ownership, lifecycles і failure outcomes.

## Browser Smoke Matrix

Start with existing command:

```powershell
npm run dev
```

Open production [index.html](http://127.0.0.1:4173/index.html) and development [dev.html](http://127.0.0.1:4173/dev.html). Planned tool-enabled server flag and route details: [dev-image-tools.md](contracts/dev-image-tools.md); that flag is not implemented now.

1. Cold/cache-disabled launch: all minimum backgrounds + exact depth; no optional requests before ready. Legacy-only catalog still runs.
2. Prepared Low/High catalog: usable Low scene first; High in bounded background; coherent replacement without flash/geometry change. Time-phase blending unaffected.
3. Fishing → victory: opportunistic request promoted/shared; claim/release/rod retrieval and save unchanged. Missing every minimum fish representation produces existing failure reason.
4. Force offline/404/decode failure: Low retained on upgrade failure; critical retry available; no console unhandled errors.
5. Hidden tab/save-data/Low: speculative jobs stop; reopening/current action works. Unsupported capability API does not crash.
6. DEV catalog opened, fish/probe changes, panel closed/reopened: selection/job lifetime intentional and independent from parameter-panel rebuild.
7. Missing sharp/local service: view metadata and explanatory capability, game responsive. Explicit local install button only initiates declared setup job.
8. Convert selected copies: plan exact output paths/dimensions; originals unchanged; catalog refreshed; Apply to preview only decorative resources. Depth and atlas blocked.
9. Spine fixture: unused capability generates zero runtime fetches; demand success, library failure, multipage failure and context loss all retain usable static fallback. Close/reopen has one game loop and no retained texture leak.
10. Release preview: old and new release open together; generated catalog, optional runtime and textures resolve from each `<base>`. Do not publish to prove this; use existing release-builder fixtures/local output.

Repeat on desktop Chromium, Firefox/Safari where available, and one constrained mobile/device profile. Record actual browser/device/version; unavailable matrix rows remain reported as unverified.

### Authoring Registration and Profiles

During implementation seed `asset-pipeline/catalog.json` with the existing 16 images, stable IDs, aliases, exact depth role and three-phase group. New masters go under `asset-sources/` with retained folder structure. Add explicit source/ID/logicalSize/outputStem mapping to authored catalog, then Scan; unregistered/missing files remain visible with explanation. Edit reusable presets in `asset-pipeline/profiles.json`; per-job UI overrides change only the validated plan. Current authoritative WebP can produce l/m after explicit legacy-derivation selection; h reuses unchanged baseline. No generated low serves as master.

## Performance Evidence

Fix browser version, viewport/DPR, scene, art, CPU/network throttling, cache policy and device. Run 10 baseline + 10 candidate cold launches, alternating order when practical.

- Measure time to first usable minimum scene, asset requests/known transferred bytes before ready, decoded pixel estimates, upgrade traffic after ready, cache hits.
- Capture frame-time p50/p95 and long tasks around decode/activation; report raw samples, not only average FPS.
- Track max in-flight/network/preparation and peak accounted old+new resource overlap. Explain browser memory estimates versus measured process/GPU memory where tools expose it.
- Minimum-scene median may not regress >5%; bytes and decoded pixels must decrease with real Low artifacts. If not, fix selection/dimensions before claiming optimization.
- Use current four location files' 596,980 compressed bytes as an audited asset-set fact, not complete startup-network baseline. CSS/modules/audio have separate requests.

Full runtime acceptance: focused checks + Architecture + Quick + Full + game-cycle equivalence + recorded production/DEV browser smoke + measured fixture results. This specification alone does not satisfy that acceptance.
