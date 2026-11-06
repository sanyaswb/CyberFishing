# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.50.3 - Sized item art

- TK-224: items marked with a size (batteries Volt-1..4, fish by level 1..6) show their art smaller in cards and cells the smaller they are; the largest fills the box. One CSS value (--art-size-min-scale) sets the smallest. Game-cycle report unchanged.

## v0.50.2 - convert-images v2

- TK-223: convert-images is rewritten: batch/thumbnails/low-copies/spine-region commands, a guided menu and help, files in parallel, failures fail the run, --masters moves masters to asset-sources, --max-size and --dry-run; output bytes unchanged.

## v0.50.1 - Fish art without empty edges

- TK-222: convert-images --trim cuts empty edges; the fish art is re-encoded without them, so the fish is larger in keepnet cards; the catch panel and the aquarium draw it whole with its proportions. Game-cycle report unchanged.

## v0.50.0 - Keepnet and asset folder fixes

- Minor release of v0.49.98-0.49.100: only the current keepnet stage loads after the first frame, the keepnet fish card shows its whole picture, and every item's files lie in one folder per type with --low/--scene/--spine name suffixes. Game-cycle report unchanged.

## v0.49.100 - One folder per item type

- TK-221: every file of an item lies in its type folder with a suffix name: low copies beside their image (name--low.webp), scene art name--scene.webp, Spine exports name--spine.*; the clone folders low-copies, floats-scene, rods-scene and animations are gone, and the unused lobby and loader art left the registry. Game-cycle report unchanged.

## v0.49.99 - Keepnet fish card picture

- TK-220: a fish card in the keepnet shows only the fish's picture (the placeholder icon stayed visible over it and pushed it down, where it was cropped); the picture box has a fixed size, the whole fish fits, long text no longer moves it. Game-cycle report unchanged.

## v0.49.98 - Only the current keepnet stage after the first frame

- TK-219: right after the first frame only the keepnet stage the player sees now loads (an 80 % keepnet after a cleared cache shows its own art first); the other stages load with the items of the lazy third layer. Game-cycle report unchanged.

## v0.49.97 - One startup budget

- TK-218: the startup budget has one source for the DEV overlay and the measurer; stale comments removed. Finished tasks archived. Game-cycle report unchanged.

## v0.49.96 - No underline or hover on overlay metrics

- TK-217: DEV overlay metric rows have no underline, help cursor, hover highlight or tooltip on any device; a click on a metric's name still writes its formula to the console. Ui-surface check asserts the behavior. Game-cycle report unchanged.

## v0.49.95 - Only the opened room level loads

- TK-216 (replaces part of TK-203): the Fisherman's Room loads its opened level, the aquarium and the renovation picture; a higher level's art waits in the locked queue until the player presses upgrade, and T-full does not count it. Asset-load-plan and house checks assert the behavior. Game-cycle report unchanged.
