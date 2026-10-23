# Plan and boundaries

Inspected: LocationMap owns scaled bodies and the coarse depth/physics grid; GameWorld.checkWater and boat collision callbacks currently use coarse flags. WorldRenderFrameBuilder separately creates water clips from authored rectangles. DEV State/Section/Drag/GeometryBuilder handle selected-number input and shared annotation commands. zone_export_format serves both browser and CLI. Bootstrap composes DEV stateful collaborators.

1. Engine pure mask codec/topology: bounded cells, connectivity, compact rectangle baking, cached normalized rectangles/contours and point tests. No domain names or platform APIs.
2. Domain: optional nested mask on ordinary bodies, exact coordinate tests in LocationMap without changing the water/depth raster. Applied castable masks also drive Pixi wave clipping; the wave envelope uses their union to avoid seams at merged rectangle edges. Existing mask-free behavior remains. Dynamic movement uses occupied mask extents when enabled.
3. DEV-only draft owner, composed in bootstrap and injected into section/input/geometry. Explicit mesh mode routes LMB/RMB painting before ordinary drag. Identity and lifecycle checks discard stale drafts.
4. Section controls for mesh/subdivision/enable/invert/apply/discard; hide raw mask arrays from generic parameter tree. Config writes continue through the current command/validation/export path.
5. Shared cached contour/fill commands for Canvas and WebGL; no full-screen texture, pixel readback or production→DEV import.
6. Extend zone-editor and apply-zones functional scenarios; meaningful point/continuity tests, invalid imports, masked waves and independent depth, moving-body bounds, lifecycle and cache checks. Full once after final code; patch version and cleanup. Owner appearance/phone checks remain pending.

Persisted optional `mask` keeps `{enabled, cell: [normalizedWidth, normalizedHeight], rects: [[col,row,width,height], ...]}`.
Rectangles merge equal row runs vertically. Normalization is relative to the host, independent of global cell size.
At most 1,048,576 cells and 4096 cells per axis bound import/draft work; invalid/oversized data reports an error.
The existing zone-file version 1 remains compatible: mask-free files keep their canonical form; `mask` is additive.
Adaptive masks use the full map-width host rectangle, matching existing DEV annotations; the viewport clips its visible portion.
The cached mesh/focus foreground follows static revisions, independently of moving-body annotation updates. Four nonoverlapping
black rectangles dim the rest of the viewport, without a full-screen texture or a hole raster.

TK-075 refinement: the existing transparent control-group API can emit a disabled native fieldset for the active
host's complete parameter subtree and structural actions. Mesh/number controls remain outside; tree ordering and
description ownership stay with DevToolsUI. ZoneMaskEditor owns one session-only fill opacity, invalidating only
view revisions and preserving the compiled draft. Grid opacity remains owned by ZoneEditorState and feeds all
three grids through shared annotation data. No config/zone-file/gameplay change.
