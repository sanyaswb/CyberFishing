# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.50.69 - Direct pixel depth reading without grid stepping

- TK-266.1: float, feeder and tackle read exact bottom depth directly from DepthMapReader at their continuous (x, y) coordinates without 40px grid stepping, while grid cells retain fixed central depths for DevTools and zone overview.

## v0.50.68 - Depth map reader non-linear calibration

- TK-266: depth map reader calibrated with non-linear piecewise interpolation matching the owner's exact color-to-depth control points (0.1m at rgb(254), 0.5m at rgb(217), 1.0m at rgb(147), 5.0m at rgb(54), 7.5m at rgb(35), 15.0m at rgb(10)), eliminating harsh depth transitions near the shore.

## v0.50.67 - Hand chum throw zone dimming and selector input isolation

- TK-267: hand chum throw zone dims unreachable water above the limit line (matching float depth limit); inventory selector neighbouring buttons are hidden with isolated pointer events and touch dragging is guarded against native screen scrolling.

## v0.50.66 - Test location background art refresh, pipeline rules and zones

- TK-265: refreshed test location backgrounds (2560x1440 WebP/JPEG) for day, evening and night; added location pipeline specification rules and prompt templates; updated castable and collision zones to y=20 and updated depth map.

## v0.50.65 - Chum icon on toolbar button

- TK-249.3: the chum button on the HUD toolbar (chum-control--idle) shows the equipped mix's WebP icon (switcherIconAsset) instead of the generic sprite symbol.

## v0.50.64 - Chum and bait icon in editor tabs

- TK-249.2: the item editor's root and view tabs show the mix/bait icon (switcherIconAsset) instead of the packaging picture; the whole-art preview above keeps the full pack art.

## v0.50.63 - Suppressing scripted editor preview with equipment values

- TK-264.5: enabling "take values from equipment" (fromEquipment) suppresses the simulated editor preview zones and phantom float handle; the editor marks only the real float when a cast is active.

## v0.50.62 - Fixed line reach for pole rods and unspooled line overlay

- TK-264.4: pole rods without a reel maintain a fixed authoritative line reach that never shrinks on retrieval, allowing the float to move freely within slack; the line radius overlay reflects the actual unspooled/fixed line boundary.

## v0.50.61 - Rod movement restricted by taut line

- TK-264.3: when tackle is blocked by shore obstacles and the line is fully played out, sideways rod movement stops at maximum line reach, preventing infinite line stretching while keeping reverse movement free.

## v0.50.60 - Anti-teleportation and smooth deceleration at obstacles

- TK-264.2: continuous collision check prevents tackle from jumping across land ledges when moving the rod; tackle movement smoothly decelerates to zero upon encountering obstacles instead of abruptly freezing.


