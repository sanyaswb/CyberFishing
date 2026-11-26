# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.52.79 - Check: a weather link opens its field the way the game does (TK-403.1)

- Checks only: the DevTools link check now goes through the same reveal feedback as the game and asserts the field is visible, not only highlighted. No change in the game or dev.html.

## v0.52.78 - DevTools: what one weather element does to another is edited in one place (spec 187 D16)

- dev.html: «ПОГОДА» → ДОЩ holds what the rain does to the wind; ВІТЕР shows it as a link. A link shows the value now and opens the parameter where it is edited (storm → ШТОРМ, rain → ДОЩ, emission → ВИКИД; ДОЩ and ПОПІЛ link to what the storm and the wind do to them).

## v0.52.77 - Review before the push: no per-frame objects for the weather's look, a symmetric automatic switch (TK-402)

- The rain's and the ash's look no longer make a new object per value every frame on a location with its own values.
- Turning the automatic weather on releases every frozen or hand-set level by itself, whoever turns it.
