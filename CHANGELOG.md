# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.52.62 - Overlay windows with DevTools icons instead of emoji (TK-397, spec 186)

- dev.html: overlay window headings that had emoji (ПРОДУКТИВНІСТЬ, ЗАВАНТАЖЕННЯ, ЕХОЛОТ, ДЕБАФИ, …) show the same line icons as DevTools, the same on every phone; emoji in the overlays' text are gone; the balance windows' reset button shows the reset icon.

## v0.52.61 - Overlay: a metric's explanation under its row (TK-396, spec 186)

- dev.html: a tap on a highlighted metric name in an overlay window opens its explanation right under the row — what it is, the formula, the parameters with their values now and a button to open each parameter in DevTools; a second tap closes it (on a phone there is no console). The startup report without a clipboard now opens in the DevTools text window instead of the browser's prompt.

## v0.52.60 - Overlay core without fallbacks (TK-395, spec 186)

- No visible change: the DEV overlay's core takes everything it needs from its composition (no hidden global defaults or optional calls), so a missing part fails at once instead of silently doing nothing.

## v0.52.59 - «ПРОДУКТИВНІСТЬ» draws its frame bar with three shapes (TK-393, spec 186)

- dev.html: the frame bar of the «ПРОДУКТИВНІСТЬ» overlay looks the same but is three shapes instead of up to 240, so the overlay itself costs the phone less while it measures.
