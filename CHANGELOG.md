# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.49.94 - A hung check no longer counts as passed

- TK-215: the check runner requires exit code 0 and a pass line at the end of stdout, because Node exits with 0 when an awaited promise never settles (incident I-13, check `check-runner`). Game-cycle report unchanged.

## v0.49.93 - T-full: the time of the full load

- TK-214: a `startup:full-load` mark when every asset load plan layer has settled, without closed and on-demand content; shown as T-full in the DEV overlay «ЗАВАНТАЖЕННЯ» and its JSON, and by `npm run measure:startup -- --full`. Game-cycle report unchanged.

## v0.49.92 - A closed inventory is not rendered at the start

- TK-213 (spec 160, the owner's cheaper option instead of stage 2): the closed inventory is no longer rendered during the start, and a lazy feature that becomes ready refreshes it only when open; the first opening renders the list itself. Game-cycle report unchanged.

## v0.49.91 - One result in spec 157

- TK-212: spec 157 has one new result (v0.49.90: 0.41 MB, 31 requests, 3 network steps on Fast 4G); closing TK-165 waits for the owner's phone report. No game change.
