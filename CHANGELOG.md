# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.50.37 - Spine load order

- TK-250.1 (spec 166): with Spine the rod and the bait boat start on a half-size atlas page and the full page replaces it in place; the full static pictures load only without Spine, and the boat then shows the owner's picture instead of the vector shape.

## v0.50.36 - Spine animations in one folder

- TK-250: the rod and bait boat Spine exports live in assets/animations/<type>/; the bamboo rod has the owner's new 3840 px art, and the first frame shows its low copy until the full picture arrives.

## v0.50.35 - Equipped chum shows the mix icon

- TK-249.1: an equipped item's cell (the tackle's chum cell, boat bunkers, editor tabs, attachment badges) shows its equipped icon, as the switcher does; the backpack card and the editor preview keep the whole pack picture.

## v0.50.34 - Carp mix packs

- TK-249: the basic carp mix comes in packs of 15, 25, 50 and 100 with their own pictures (DEV free shop too); the chum switcher shows the mix's icon, and every pack of the mix joins one spot in the water.

## v0.50.33 - Release confirmation is a green check

- TK-248: a keepnet fish card waiting for release confirmation shows a green check instead of «Так, відпустити» (the text stays its name and tooltip), beside the red cross «Залишити».

## v0.50.32 - Keepnet thumbnail follows the fill

- TK-247: the keepnet sector of the inventory fan shows the keepnet's current fill stage (it was always the empty one), updated each time the fan opens; the classic keepnet button follows the fill while the keepnet is closed too.

## v0.50.31 - A bait over a live bait asks first

- TK-246: with a live bait on the hook, choosing a regular bait lights the switcher cell and offers «Замінити» in its editor, like over any other bait; a second choice (the card, «Замінити» or the cell) puts it on and clears the live bait's choice (the fish stays in the keepnet), «Назад» keeps the live bait.

## v0.50.30 - Live bait stacks equip like baits

- TK-245: tapping a live bait stack in the backpack follows the bait rules: an empty single hook takes the species' next live bait at once; over a regular bait or another live bait the switcher cell turns green and the stack panel offers «Замінити» (a repeated tap or the cell confirms, «Назад» cancels); the chosen species only opens its panel; with no single hook «Спорядити» marks the tackle.

## v0.50.29 - Live bait in the bait pick, full list after a choice

- Spec 165 stage 2 (TK-242): an empty bait cell lists the live bait stacks among the compatible baits when the tackle has one hook; choosing a stack (or the repeated tap on the cell when it is first) puts the species' next live bait on and opens its panel. After any bait choice the search ends: «Усе» lists the whole backpack (it showed only baits).

## v0.50.28 - Bait choice always opens its editor

- Spec 165 stage 1 (TK-242): choosing a bait opens its editor every time; an empty hook takes it at once, a hook with another bait highlights its switcher cell and the editor offers «Замінити» (a repeated click or a tap on the cell replaces too, «Назад» cancels); «Спорядити» with nowhere to put the bait opens the equipment and marks the missing rod or tackle.
