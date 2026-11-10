# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.50.59 - Water boundary sliding for rod movement

- TK-264.1: float now slides along the water shoreline and mask boundaries when the rod moves sideways, preventing deadlocks when leading the tackle.

## v0.50.58 - Cast rod movement preserves line reach and water bounds

- TK-264: moving the cast rod against shore/obstacle no longer inflates line reach or creates phantom slack; the line stays authoritative and tackle reach clamps to valid water.


