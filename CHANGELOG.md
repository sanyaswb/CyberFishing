# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.49.94 - A hung check no longer counts as passed

- TK-215: the check runner requires exit code 0 and a pass line at the end of stdout, because Node exits with 0 when an awaited promise never settles (incident I-13, check `check-runner`). Game-cycle report unchanged.

## v0.49.93 - T-full: the time of the full load

- TK-214: a `startup:full-load` mark when every asset load plan layer has settled, without closed and on-demand content; shown as T-full in the DEV overlay «ЗАВАНТАЖЕННЯ» and its JSON, and by `npm run measure:startup -- --full`. Game-cycle report unchanged.

## v0.49.92 - A closed inventory is not rendered at the start

- TK-213 (spec 160, the owner's cheaper option instead of stage 2): the closed inventory is no longer rendered during the start, and a lazy feature that becomes ready refreshes it only when open; the first opening renders the list itself. Game-cycle report unchanged.

## v0.49.91 - One result in spec 157

- TK-212: spec 157 has one new result (v0.49.90: 0.41 MB, 31 requests, 3 network steps on Fast 4G); closing TK-165 waits for the owner's phone report. No game change.

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
