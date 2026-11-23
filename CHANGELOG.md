# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.52.70 - DevTools: the weather by hand only without the automatic weather; off freezes it (spec 187)

- dev.html: with «Автоматична погода» on nothing is set by hand (the switches, the direction, the sliders and the actions are inactive and point at the switch). Turning it off freezes the weather where it is: no event starts or ends, the levels stay until you change them; the wind still gusts, a storm still strikes lightning and the stars still fall at the frozen level; the current and the calm swell stay. Turning it on releases everything.

## v0.52.69 - DevTools: the weather's strength sliders in their own sections (spec 187, stage A)

- dev.html: «ПОГОДА» → «Керування» keeps only the switches, the wind's direction, «авто» and the actions. Each element's «Сила, %» slider is now on top of its own section (ДОЩ, ШТОРМ, ТУМАН, ВИКИД, ЗОРЕПАД, ПОПІЛ, ВІТЕР; ВОДА — the waves' height and the current's speed), for the location the game runs; it holds the element in the game and follows its live value.

## v0.52.68 - DevTools: the weather's sliders follow the live value (TK-401)

- dev.html: in «ПОГОДА» → «Керування» the strength sliders (rain, storm, fog, emission, ash, the wind with its gusts, the waves, the current) move with the live value; one held by hand shows its value, and one the person is moving is not pulled away.
