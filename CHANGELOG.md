# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.49.90 - Utils cleanup after spec 157

- TK-211: every tool and dependency of the start's work still has a consumer, so nothing tracked is removed; stale release descriptions and measurements corrected. No game change.

## v0.49.89 - One pass of the spec 157 owner checks

- TK-210: the spec 157 owner checks in tasks.md are one pass (a cold phone report and a short list of visible things); the finished parts of TK-165, TK-173-179 and the closed R12 question are in the archive. No game change.

## v0.49.88 - Start manifest budget in the release check

- TK-209 (spec 157 R9): the pages-release check fails when a page's start manifest exceeds the 2.5 MB budget and names its largest files. Game-cycle report unchanged.
