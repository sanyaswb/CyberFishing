# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.52.89 - Review before the push: lightning draws no hidden quads, one way to read weather values (TK-406.3, TK-405.1, TK-408.1)

- The lightning no longer makes the GPU draw hundreds of invisible quads during a strike.
- dev.html «ПОГОДА»: the fields at a slider's level and the links read their values without building a record on every live update; the weather import applies a file exactly as apply:weather does; apply:weather names a broken file's own reason first.

## v0.52.88 - Weather export: a rule and a check that it stays complete (spec 189, stage C)

- Checks only: a new weather setting that DevTools «ПОГОДА» can edit but the export would leave out now fails the checks; DEVELOPMENT_RULES «Weather export» says how to add or rename weather settings.

## v0.52.87 - Weather export: every weather setting, only the changes (spec 189, stage B)

- dev.html: «ПОГОДА» → «Експорт погоди» now carries every part the section edits — the lightning, starfall, water, emission screen, radiation hiss, Geiger counter and the location's current too — and only the changed parameters (was → is). `npm run apply:weather` applies just those, so a file still applies after the code changed elsewhere; a parameter changed in the code since the export is the only conflict. Old files still apply.

## v0.52.86 - Weather settings in their own data files (spec 189, stage A)

- No change in the game: the lightning, starfall, water, emission screen, radiation hiss, Geiger counter and the location's current now live in their own data files, so the weather export can carry them (next step).

## v0.52.85 - Lightning: the owner's time seen and branch angle (TK-406.2)

- A strike is now seen 0.9–2.1 s and its branches leave the channel at 18–63° (the owner's values from DevTools).

## v0.52.84 - Lightning: how long a strike is seen (TK-406.1)

- dev.html: ШТОРМ → «Блискавка — вигляд» → «Час видимості, с [від, до]» sets how long a strike is seen (0.5–0.9 s by default, random within); its flashes fill the first part («Спалахи: частка часу»), then it glows out by the end.

## v0.52.83 - Procedural lightning in the sky (spec 188, stage A)

- The storm's lightning strikes now show on the WebGL scene: a jagged branching bolt in the sky zones (where the stars fall), new every time, flickering 2–4 times; far strikes are shorter and dimmer. dev.html: «ПОГОДА» → «Блискавка» strikes now (and closes the panel on a phone); ШТОРМ → «Блискавка — вигляд» edits its look live.

## v0.52.82 - DevTools: the storm's, wind's and waves' «від / до» follow the strength slider (spec 187 D16)

- dev.html: in «ПОГОДА» the storm's effects, the wind's slant and drift, the rain's effect on the wind and the sea state show one number at the strength slider's level, live; «від» is edited at 5 %, «до» at 100 % — as the rain and the ash already do. «Загальні» keeps the pairs.

## v0.52.81 - DevTools: the water's settings in three groups (spec 187, stage D)

- dev.html: «ПОГОДА» → ВОДА splits the one long list into «Вигляд хвиль», «Стан моря — як погода міняє хвилі» and «Покачування поплавка»; the parameters and what they do are the same.

## v0.52.80 - DevTools: a weather link reads like the parameter's own row (TK-403.2)

- dev.html: a link in «ПОГОДА» shows the parameter's key as in the code with its «i» (name and description) and the key's copy button, like the row it opens.
