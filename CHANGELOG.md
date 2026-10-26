# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.48.3 - Effect sliders in the radio (DEV)

- DEV: the main parameters of the enabled radio effects (vinyl, walkie-talkie) as sliders under the volume in the radio's editor; production shows none (TK-098).

## v0.48.2 - Vinyl record sound

- Radio: a vinyl record effect (crackle, pops, wavering pitch, warm tone, hiss, rumble) beside the walkie-talkie; every effect is tuned and switched in DevTools «РАДІО», the player no longer chooses the sound (TK-097).

## v0.48.1 - Radio controls can be pressed

- Radio editor: the controls keep their height instead of shrinking under the tabs' panel, so every button can be pressed (TK-096).

## v0.48.0 - Field radio receiver

- Field radio receiver (spec 142): a wearable radio with its own battery that plays live stations of your country through a walkie-talkie sound, with weak-battery noise and dropouts, rain crackle, quieter during a bite, a wave indicator under the clock and DevTools «РАДІО».
