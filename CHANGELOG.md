# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.52.80 - DevTools: a weather link reads like the parameter's own row (TK-403.2)

- dev.html: a link in «ПОГОДА» shows the parameter's key as in the code with its «i» (name and description) and the key's copy button, like the row it opens.

## v0.52.79 - Check: a weather link opens its field the way the game does (TK-403.1)

- Checks only: the DevTools link check now goes through the same reveal feedback as the game and asserts the field is visible, not only highlighted. No change in the game or dev.html.

## v0.52.78 - DevTools: what one weather element does to another is edited in one place (spec 187 D16)

- dev.html: «ПОГОДА» → ДОЩ holds what the rain does to the wind; ВІТЕР shows it as a link. A link shows the value now and opens the parameter where it is edited (storm → ШТОРМ, rain → ДОЩ, emission → ВИКИД; ДОЩ and ПОПІЛ link to what the storm and the wind do to them).

## v0.52.77 - Review before the push: no per-frame objects for the weather's look, a symmetric automatic switch (TK-402)

- The rain's and the ash's look no longer make a new object per value every frame on a location with its own values.
- Turning the automatic weather on releases every frozen or hand-set level by itself, whoever turns it.

## v0.52.76 - Old weather files with multipliers still apply (spec 187)

- `npm run apply:weather` and the DevTools import read a weather file exported before the storm's and the wind's «від / до» as the pairs that act the same (such a file still reports a conflict with the changed code: apply it with --force or export again).

## v0.52.75 - The waves' response to wind and storm as «від / до» (spec 187, stage C)

- How high and fast the waves get with the wind, and how a storm raises, speeds up and lengthens them, are now set by two values — at 5 % and at 100 % — instead of multipliers. The game plays the same.

## v0.52.74 - The wind's effects as «від / до» (spec 187, stage C)

- The drops' slant and the ash's drift from the wind, and the rain's effect on the wind, are now set by two values — at 5 % and at 100 % — instead of multipliers. The game plays the same.

## v0.52.73 - The storm's effects as «від / до» (spec 187, stage C)

- What a storm does to the rain, the drops and the wind is now set by two values — at 5 % and at 100 % of its strength — instead of multipliers. The game plays the same; a weak storm can now be tuned on its own.

## v0.52.72 - Weather look: «від» at 5 %, a location's own «від / до» (spec 187, stage B)

- The rain's and the ash's values that grow with their strength now start at the least visible strength (5 %) and reach their end at 100 %. A location can override either end.
- dev.html: ДОЩ and ПОПІЛ show these values at the strength slider's level and follow it; at 5 % you edit «від», at 100 % «до»; values the slider changed are marked with a dot and kept by «Змінені». A location's override now passes the weather file check (it was always refused).

## v0.52.71 - DEV: time ×10 and ×20; «Автоматична погода» remembered (spec 187)

- dev.html: a press on the time now goes on after ×5 to ×10 and ×20, then back to ×1. «Автоматична погода» left off stays off after a reload (the weather starts frozen); the game itself is not affected.
