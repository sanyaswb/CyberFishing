# Implementation plan

- Share pure rectangle containment/container selection in engine geometry. DynamicZone keeps RNG/direction scheduling but moves/reflexes inside the full-body top-left interval; no new per-frame allocations.
- ZoneEditorState owns the selected bounds-editing context (zone selection plus active flag), cleared by relevant lifecycle/permission changes.
- ZoneEditorDragController selects the context on body press; movement-area edge/corner/middle hit tests use actual map bounds converted once to design cells. Body drags have priority. Reuse existing snapping/window math and constrain body/area gestures before one config write.
- Geometry adds handles only to selected movement bounds, retaining one body and the existing reusable overlay/cache model. Area hover/handles remain distinct from body fill.
- ZoneEditorConfigEdits enforces containment for accepted direct geometry edits as well as drag payloads, preserving current positions of untouched dynamic siblings.
- Extend existing zone-editor fixed-clock scenarios for original centre-overflow reproduction, all bounce directions, large steps, bounds selection/drag, mutual containment and lifecycle. Full once; record gameplay backlog and only update baseline if it changes.
- Cleanup replaced centre-only predicate and obsolete bounds drawing/hit assumptions, without weakening architecture or safety guards.
