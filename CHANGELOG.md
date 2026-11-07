# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.50.40 - ACTIVE FISH without Overlay, guaranteed Fixed Catch anomaly

- TK-252: DevTools show the hooked fish's parameters (ACTIVE FISH) in the fight while the panel is open, Overlay off.
- Fixed Catch hasAnomaly always makes the test fish anomalous; perch_radioactive gets the crucian's anomaly (inside, 1%, test).
- ui-catalog.html removed (owner): no longer released, served or checked.

## v0.50.39 - Step mode holds HUD full files

- TK-251.1 (spec 167): in step-by-step loading a full file asked for by a view (toolbar, HUD, inventory pictures after their low copy) waits for the first step that loads it in full.

## v0.50.38 - Step-by-step loading in DevTools

- TK-251 (spec 167): DevTools «⏯ ПОКРОКОВЕ ЗАВАНТАЖЕННЯ» stops dev.html after the first frame; «Далі ▶», a layer jump, the whole layer or everything load the plan's next steps, with each step's files and their quality listed.

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
