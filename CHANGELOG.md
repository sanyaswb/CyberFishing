# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.52.67 - DevTools: «Хвилі» off when the water is flat (TK-398.1)

- dev.html: with the automatic weather off and no wind the water was flat, but «Хвилі» in «Керування» (and the «i» of «ПОГОДА») still showed the waves on. Now they are on only while held by hand or while the waves really show; a wind that raises waves turns the switch on by itself.

## v0.52.66 - DevTools: the weather's «i» shows what is on now (TK-400)

- dev.html: the «i» of the «ПОГОДА» section lists the automatic weather, the states on now, the radiation and a short line for each state (strength, phase, time left; the wind's direction and gusts), updated live while it is open.

## v0.52.65 - Rain comes more often under a storm (TK-399.1)

- A storm raises the rain's chance more (×10 instead of ×6): rain now falls under most storms (~85%) and more than half of the emissions (~61%), and a storm without rain still happens.

## v0.52.64 - The emission no longer brings rain (TK-399)

- An emission brings its storm and ash, but no rain: a storm may now come without rain. Rain during an emission comes only by its own chance, raised by the storm as under any storm.

## v0.52.63 - DevTools: one switch for the whole automatic weather (TK-398)

- dev.html: «ПОГОДА» → «Керування» has the switch «Автоматична погода» (instead of the button «Авто погода»). Off: no rain, storm, fog, emission, starfall or wind starts by itself, the water is flat and still; each element's own switch still turns it on, with its effects on the others (the emission's ash and rain, the rain's and the storm's wind). The rain or the storm switched off during an emission now stays off, a wind switched off leaves the waves without wind under a storm, and the water's picture drifts with the current the tackle feels.
