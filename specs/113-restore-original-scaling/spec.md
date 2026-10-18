# Restore original visual scaling

Owner, 2026-10-19: restore the previous scaling logic, keep the engine's 50 px = 1 m base and retain the DEV tools.
G-076, v0.42.2. This explicit rollback supersedes the shared visual/physical scale requirements of specs 109,
111 and 112. Those completed specifications remain historical records.

## Verified rollback boundary

- Restore WorldPerspective's formulas from `e1a46f79^`: interpolate the location's `perspective.angleTop/angleBottom`
  between its `safeZone.top/bottom`, clamp the interpolation, use `tan(angle) / tan(angleBottom)` for visual scale
  and `sin(angle)` for vertical squash. The test location restores its original 0° / 30° settings.
- Restore WaterMetric's formulas and its resolver from `23a13cc2`, retaining the read-only `topY` getter needed by the
  editor and finite-input guards. Physical base pixels remain metres × the injected pixelsPerMeter (50 in the shipped config). No tilt,
  automatic fitting or angle-dependent physical zoom. Keep the original inverse and velocity derivatives.
- Keep the current 30 m far edge and `linearShare: 0`; physical compression starts at the green zone's lower edge.
  Visual scaling uses its historical safeZone bounds, separately from physical distance conversion. No casting
  accuracy defaults, chum radii, line limits, boat speeds or save format changes.
- Undo the automatic metric factor added to the landing area's lateral radius. Viewport camera scale applies once;
  the screen-space rod remains unchanged.

## Retained tools and ownership

Keep zone geometry editing, metre grid, category visibility, black background, cached WebGL annotations, Canvas
fallback and export/import/local reset. Keep Overlay off by default. Readable angle controls now edit the live
location's `perspective` object; distance controls retain the physical profile and original height / pixelsPerMeter
minimum. Rejected edits leave config unchanged and restore the displayed value. Reset restores both groups and
survives override export/import without reviving old child edits. DEV diagnostics compose the production visual query.
Production bootstrap injects the location query; Domain does not import raw config, browser APIs or DEV.

## Reproduction and evidence

The focused viewport regression failed before the rollback: near-field visual scale at 30° was
`2.0000000000000004`, expected the historical `1`. Compare the archived sine/tangent formulas at and beyond
both bounds and inside the actual water. Check real chum render radii and gameplay boundaries at 0/1/2/10/30 m
through portrait/landscape camera transforms. Verify physical near-shore scale stays 50 and the resolver keeps its
metric identity after visual angle edits. Retain physical inverses, exact uniform arithmetic, boat and line-budget
checks. Exercise actual editor callbacks, range rejection, reset/export/import and bounded/unchanged geometry caching.

The independent-tilt/autofit assertions introduced in specs 111/112 are superseded by the owner's rollback; the
existing physical checks are restored and historical visual regressions replace the obsolete assertions. No check
manifest entry, architecture guard, baseline, utility, fixture, vendor file, dependency or script becomes obsolete
or is removed. Run focused checks, Architecture, Quick and Full; keep the game-cycle baseline unchanged.

Owner performs visual/phone checks: compare casting spread, chum areas and object sizes near/far in index/dev in
both orientations; exercise angle editing, metre grid, black background and reset. No agent browser visual check.

Verification: focused checks, Architecture 4, Quick 36 and Full 62 pass. Architecture guards, check manifest and
game-cycle baseline remain unchanged. Artifact cleanup found no generated logs or temporary files to remove.
