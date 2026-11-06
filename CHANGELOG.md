# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.50.14 - Live bait in the bait switcher

- TK-229.3 stage 2 (spec 162): the chosen live bait shows in the bait switcher's empty hook cell; over a regular bait «На живця» turns the card green with «Замінити» and the hook's cell blinks, and replacing returns the bait to the backpack. Not while the tackle is in the water; one hook only.

## v0.50.13 - Perch trophy weight

- TK-232: a radioactive perch from 0.833 kg is a trophy (owner's value); the victory ruler shows its trophy zone.

## v0.50.12 - Victory window corrections

- TK-231: the victory window sizes the fish by level like the keepnet (no frame, nothing cropped), tints its semi-transparent panel by the fish's quality like an inventory card (glow animates only for a unique fish), shows the caught weight unrounded, the level in the panel's corner and the buttons «Забрати» / «Відпустити».

## v0.50.11 - Automatic live bait by species

- TK-229.3 stage 1 (spec 162): a kept fish up to 100 g becomes a live bait at once (saved catches convert on load); a live bait card has «На живця» and «В акваріум» (disabled without an aquarium); when the chosen live bait is used up, dies or is released, the same species' bait with the least life left follows.

## v0.50.10 - Victory window

- TK-230: the victory panel is a DOM window (spec 161): a rounded rectangular picture that opens the fish on the whole screen over a blur, plates with icons (weight, trophy cup, radiation sign with check or cross), rarity stars and a weight ruler with the green trophy segment. No per-frame canvas blur any more.

## v0.50.9 - Keepnet fish card text box and stars

- TK-229.1-2: a keepnet fish card shows its text in a grey rounded box (name, level, weight, rarity as a row of SVG stars, timer); its buttons fill the row, two that fit take half each.

## v0.50.8 - Filter plates without scrollbars

- TK-229: the backpack's and keepnet's filter plates (species, sort, settings) have the filters panel's 14 px inset on every side, and the plates and category rows scroll without a scrollbar.

## v0.50.7 - Keepnet group weight in kg

- TK-228: a keepnet group shows its total weight in kilograms with two decimals; the DevTools keepnet fill moved under DEBUG and now adds every species of the game (a species without per-level weight ranges splits its depth weight range by level).

## v0.50.6 - DevTools keepnet fill

- TK-227: DevTools section «САДОК» shows the keepnet's fill and fills it to 0, 20, 40, 60, 80 or 100 % with random fish (species, level, weight, art, rarity) through the ordinary keep and release commands.

## v0.50.5 - Fish preview beside the keepnet

- TK-226: in wide layouts a click on a fish card inside a group shows that fish's full art on the left in place of the keepnet; a second click, leaving the group or closing the section brings the keepnet back.
