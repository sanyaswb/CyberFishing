# House DevTools apply live config edits

Owner instruction: 2026-10-14 — DevTools in the House do not show every section, and aquarium grid edits (size,
`showZone`) do not change the aquarium. Backlog G-037.

## Cause

- `LIVE_BAIT_CONFIG` is deeply frozen, so the runtime config view treats `CONFIG.liveBait` as an immutable branch:
  a read returns the current resolved object, but a captured reference stays the startup snapshot. The House gave
  `AquariumFishMotion` `CONFIG.liveBait.visual` once and nothing applied later edits. Only the location page pushed
  `visual` to an embedded House (`cyber-fishing:aquarium-preview`).
- The DEV House composed DevTools without `configValidation` and with the production `ITEM_DB` instead of the DEV
  item catalog. Overlay modules, item progression, the free shop and the active fish are location-session tools:
  the House has no overlay settings store, fight, item progression provider or `PlayerInventory`.

## Decision

- House startup listens for `config-updated` on its document (the existing DEV-edit contract of `GameApplication`
  and `ChumService`). Edits of `CONFIG`, `CONFIG.liveBait` or `CONFIG.liveBait.visual.*` pass the live resolved
  `CONFIG.liveBait.visual` to `AquariumFishView.setConfig`; invalid values keep the previous settings; unrelated
  edits do nothing; disposal removes the listener.
- `composeDevConfigValidation` (bootstrap/development) is shared by the location and House DEV pages. The House
  DevTools get validation ("Validate config", edit reports) and the DEV item catalog.

## Verification

`house-check` runs the real House startup with stubbed collaborators: the check failed before the fix (no setConfig
call) and now covers live reads, reset/import paths, unrelated paths and listener disposal. `dev-time-check` asserts
the House DevTools validation and DEV catalog. Architecture 4/4, Quick 25/25, Full 51/51; game-cycle unchanged.
No browser/visual testing by Claude.

## Open (owner decision)

- Other `liveBait` services (care, prices, capacities) still capture the frozen snapshot on both pages, so those
  DevTools edits do not apply until reload.
- The embedded House is a separate realm with its own override store: location edits other than `visual`/time are
  not visible in the House and House edits are lost on return. A single override handoff (`exportOverrides` on open
  and return) would replace the separate `visual` and `debugTime` messages.
- `HOUSE_CONFIG` is outside `CONFIG`, so room/UI settings have no DevTools section.
