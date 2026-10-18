# One water metric for world scale and the diagnostic grid

Owner, 2026-10-18: every water object and area follows the perspective metre grid; the screen-space rod is excluded.
G-070. Physical movement already uses `WaterMetric` (specs 053/054). Visual `WorldPerspective` still used a separate
angle curve, so equal metre sizes, the grid, float, boats and chum areas disagreed.

`WorldPerspective` reads the session's existing water metric through an injected query. Its lateral scale is
`pixelsPerMeterX(y) / pixelsPerMeter`; vertical squash is `pixelsPerMeterY(y) / pixelsPerMeterX(y)`. Uniform water
is 1:1. No new configurable formula or second metric. Create LocationMap and LocationWaterMetricResolver together
in bootstrap before the projector; pass those same instances to GameWorld. The location's existing map bounds
remain the authoritative bounds, including after live zone edits. The viewport's affine camera transform and
the rod's screen/Spine scale are unchanged. Float body size remains art-relative; ground-plane area radii follow
the two metric axes. Existing saves do not change.

Checks: metric scale equals finite differences of ground->map mapping (near/far, uniform/profiled, both axes),
same live metric identity for world and renderer, projector pan/resize does not own perspective; Architecture,
Quick, Full and unchanged game-cycle report. Owner: compare near/far float and boat sizes with the metre grid in
the editor, both phone orientations. No visual check by the agent. No utility becomes obsolete.

Owner correction, G-072 / v0.41.8: the test location's distance profile must compress from the lower green-zone edge.
Set `linearShare` to zero; the previous 0.5 left the near half flat. Keep this same profile for physical distances,
world sizes, areas and grid. The actual cast/chum render models are covered near shore in both viewport orientations,
after pan and with edited green-zone bounds. No utilities, fixtures, scripts or dependencies become obsolete.
