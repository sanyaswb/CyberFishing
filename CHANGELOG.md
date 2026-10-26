# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.48.13 - Discrete worm jar sizes (25, 50, 75, 100) and DEV shop delivery

- Inventory: added discrete worm jar catalog items (25, 50, 75, 100 pcs) with distinct jar art and pack capacities; DEV shop grants nominal jar quantities (TK-108).

## v0.48.12 - Bait and chum packs in backpack and switcher worm icon

- Inventory: bait and chum stacks count by pack/jar size towards backpack capacity (50 worms in jars of 25 = 2 items); worm item displays jar artwork in backpack and worm icon in header switcher (TK-107).

## v0.48.11 - Mobile inventory card columns by display size

- Inventory: mobile layout (<=820px) adapts grid column counts to the selected display size: 1 -> 6 columns, 2 -> 4 columns (standard), 3 -> 3 columns (TK-106).

## v0.48.10 - Unified card rounded corners and inventory grid scale settings

- Inventory: item cards in backpack unified with rounded corners matching equipment wells, and added display settings toggle with 1 (0.5×), 2 (1×), 3 (1.5×) scale buttons (TK-105).

## v0.48.9 - Backpack capacity scale color derives from remaining space

- Inventory: backpack capacity scale color now derives from remaining free capacity, staying safe green when empty and turning red when full (TK-104).

## v0.48.8 - Unified parameter scale styles matching inventory-parameter bar fill

- Inventory: parameter scale styles unified across resource and bar meters with rounded track corners, inherited fill radius and smooth transitions (TK-103).

## v0.48.7 - Design token parameters, single charge meter and live battery capacity

- Inventory: item parameters refactored to design tokens, duplicate battery charge bar removed in favor of resource meter, and battery capacity counts down dynamically with discharge (TK-102).

## v0.48.6 - Worn items first among the auxiliary wells

- Inventory: in the auxiliary block worn items come first and empty wells after, so the radio is no longer hidden behind empty wells (TK-101).

## v0.48.5 - Radio prefers stations with the effect

- Radio remembers which stations play with the effect (their servers allow it) and offers them first; DEV switch to skip stations without it (TK-100).

## v0.48.4 - Radio sound export and interference switch

- Radio: «Перешкоди сигналу» switch (the hiss and crackle left with the effects off), DEV switches for vinyl, walkie-talkie and interference in the radio's window, export of the sound settings and `npm run apply:radio` to write them into the code (TK-099).
