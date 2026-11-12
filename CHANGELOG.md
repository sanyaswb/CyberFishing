# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.50.84 - Zones stay on the map

- TK-278 (spec 173): in a narrow window a zone wider than the window (e.g. a full 2560 px zone) could be dragged off the map; moving and resizing now stop at the map's edges (a zone already partly beyond them never goes further out).

## v0.50.83 - DevTools edge opens on hover again

- TK-274.1 (spec 173 F2): while editing zones, the cursor resting at the left edge (~150 ms) opens DevTools again; a cursor sweeping past, a held button or a zone editor gesture (drag, drawing, mask) never does; a press or a finger swipe still opens it; strip 16 px.

## v0.50.82 - Clip zones to the castable area

- TK-277 (spec 173 F3): every zone list but the castable one has «Обрізати по ігровій зоні»: the selected zone is cut to the water exactly on the castable mask's grid (a mask where the shore is ragged; separate pieces become separate zones); a moving zone's movement area is cut instead.

## v0.50.81 - Movement area editable at once

- TK-276 (spec 173 F4): with «Редагувати рухомі» on, the movement area of the moving zone chosen in its list can be dragged at once (no click on its body first, other selections no longer hide it); an area edge beyond the map is grabbed at the map's edge.

## v0.50.80 - Zone editing goes fullscreen

- TK-275 (spec 173 F1): switching zone editing on takes the page fullscreen; switching it off leaves fullscreen only when the editor entered it (a fullscreen chosen with ⛶ stays). The game's ⛶ button and the editor share one fullscreen port.

## v0.50.79 - DevTools open only on touching the left edge

- TK-274 (spec 173 F2): while the zone editor hides the DevTools button, the panel opens only by pressing the very left edge (8 px) or swiping right from it; a pointer passing over the edge while dragging zones no longer opens it.

## v0.50.78 - Rain zones in the zone editor

- TK-273 (spec 172 D4): the zone editor has a new category «Дощ»: it rains only inside these zones (drops land in them and are clipped to them); rings and ripples stay on the water. The test location has one rain zone over the whole map; the category's switch off rains over the whole screen.

## v0.50.77 - Release check before push

- TK-272.1 (owner): the Pages release check builds the last commit, so it no longer runs in npm run check (before a commit it checked the previous commit); npm run check:release runs it before every push.

## v0.50.76 - Faster full check

- TK-272: the Pages release check reads each page's stylesheets from git in one batch instead of once per pair (about 2,600 git calls); it takes about 13 s instead of 95 s, and a full check run about 18 s instead of 100 s. It checks the same things.

## v0.50.75 - Procedural rain

- Spec 172 stage D iteration 1 (TK-271): it rains on the location: thin drops fall at the wind's slant, smaller and slower far away, as many as the rain and storm are strong; drops on the water leave rings and small ripples. DevTools «🌦 ПОГОДА» switches rain, storm and fog on with live strength, holds the wind's direction and tunes the rain's look.
