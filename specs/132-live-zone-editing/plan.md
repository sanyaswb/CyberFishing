# Implementation plan

- ZoneEditorState owns four category editing flags, replacing the per-zone editable set and its index-shift logic. Hover still uses zone identity/index for hit feedback.
- ZoneEditorSection renders the requested six controls directly under Zones, reusing DevToolsUI switches and prerequisite feedback. Remove the old editable section/methods and all production consumers of that obsolete contract.
- Geometry draws live dynamic bodies only in the existing moving overlay (including their handles). Static geometry retains boundaries and grid caching. Drag reads map geometry and converts accepted geometry to design cells.
- A DEV config-edit projector snapshots current dynamic coordinates only on deliberate edits. It normalizes dynamic field edits and array operations before the existing validated config write, preventing config refresh from teleporting untouched zones. This snapshot is a command payload, not another live owner.
- Inject a pause predicate from existing DEV flags into GameWorld, passing an optional motion pause to LocationMap.update. Production defaults to false; backgrounds and other world updates continue normally.
- Extend zone-editor with real LocationMap/DynamicZone scenarios, fixed RNG/clock, no duplicate bodies, current-position hit tests, pause/resume, multiple-zone edits, category aggregates and prerequisite declarations. Run focused checks and one Full.
- Cleanup: remove obsolete per-zone editing methods, UI section, tests asserting index-shift permission semantics, and superseded documentation instructions; preserve their useful drag/hover scenarios.
