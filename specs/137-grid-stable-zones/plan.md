# Implementation plan

Inspected consumers: LocationMap converts design cells into runtime cells and rasterizes gameplay/depth; DynamicZone owns current positions. WorldRenderFrameBuilder currently interprets authored clip rectangles using the wrong cell basis. DEV geometry and input read runtime cells; ZoneEditorConfigEdits projects live bodies back to authored design cells. Fixed designCellSize=40 is present in game_config.

1. Retain exact scaled geometry in LocationMap; integer raster iteration covers intersecting cells without mutating that geometry.
2. Remember the applied grid size with the map. On grid refresh, rescale existing live body positions/velocities by ID; ordinary authored-zone edits retain their current refresh behavior.
3. Make water clipping use authored design units. DEV readers use the map's applied cell size so a pending config reload cannot misinterpret old cells as new ones.
4. Extend existing zone-editor/config scenarios for non-divisible sizes, round trips, live motion, depth/collision cells, clipping, authored export and next edit. Run focused checks then Full; patch and cleanup.

No new mutable gameplay owner, DEV dependency in production, compatibility bridge or per-frame normalization. No unrelated architecture migration.
