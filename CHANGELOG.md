# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.49.90 - Utils cleanup after spec 157

- TK-211: every tool and dependency of the start's work still has a consumer, so nothing tracked is removed; stale release descriptions and measurements corrected. No game change.

## v0.49.89 - One pass of the spec 157 owner checks

- TK-210: the spec 157 owner checks in tasks.md are one pass (a cold phone report and a short list of visible things); the finished parts of TK-165, TK-173-179 and the closed R12 question are in the archive. No game change.

## v0.49.88 - Start manifest budget in the release check

- TK-209 (spec 157 R9): the pages-release check fails when a page's start manifest exceeds the 2.5 MB budget and names its largest files. Game-cycle report unchanged.

## v0.49.87 - A failed start says so

- TK-208 (spec 157 R3): a failed start shows an error text and a retry button on the startup screen instead of an endless ring, also when the game's bundle cannot load; the cause goes to the console. Game-cycle report unchanged.

## v0.49.86 - One stylesheet and one start bundle

- TK-206 (spec 160 stage 1): the release links one minified stylesheet instead of 32; the start's small modules are static imports and each page is built on its own (JS files 20 -> 10); the first layer's image groups load together (network steps 4 -> 3); release notes moved to DEV. Fast 4G: 74 -> 31 requests, 0.47 -> 0.41 MB. Game-cycle report unchanged.

## v0.49.85 - Fisherman's House loads lazily

- TK-203 (spec 159): the Fisherman's House is open, so the art of every room level loads in the third layer; the `locked` queue stays for future content and is empty today. Asset-load-plan check asserts the behavior. Game-cycle report unchanged.

## v0.49.84 - DEV overlay width, loading rows and zoom

- TK-202: the DEV overlay grows to its unwrapped text above 820 logical px and scrolls sideways up to 820; loading rows have no hints, hover or click. Dragging, limits and the saved position now account for the window's zoom, a click on a metric reaches it again (capture starts with the drag), and the window is clamped when its size changes instead of on every update. Ui-surface and startup-load-report checks assert the behavior. Game-cycle report unchanged.

## v0.49.83 - Audio on demand

- TK-201 (spec 159): audio stays in the third layer as an on-demand group and loads only when the radio starts or a sound plays; the background no longer downloads it. Asset-load-plan check asserts the behavior. Game-cycle report unchanged.

## v0.49.82 - Lazy load order and locked queue

- TK-200 (spec 159): the third layer of the asset load plan runs low copies of backgrounds, items, then Spine, the Fisherman's Room and the rest, then the full files in the same order, audio last; art above the opened room level waits in a `locked` queue until progress opens it. Layer two loads each full file right after its copy. `LazyImageWarmUp` is removed. Asset-load-plan check asserts the order. Game-cycle report unchanged.

## v0.49.81 - New VOLIA 77.2 recording

- TK-198: the first VOLIA 77.2 track plays the owner's new recording (8:34) under the same asset id, as 32 kbit/s mono AAC like the other tracks; the master is in `asset-sources/`, the old `RADIO_VOLIA.m4a` is removed. Radio-receiver check asserts the file. Game-cycle report unchanged.
