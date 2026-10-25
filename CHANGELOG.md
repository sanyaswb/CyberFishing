# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.48.3 - Effect sliders in the radio (DEV)

- DEV: the main parameters of the enabled radio effects (vinyl, walkie-talkie) as sliders under the volume in the radio's editor; production shows none (TK-098).

## v0.48.2 - Vinyl record sound

- Radio: a vinyl record effect (crackle, pops, wavering pitch, warm tone, hiss, rumble) beside the walkie-talkie; every effect is tuned and switched in DevTools «РАДІО», the player no longer chooses the sound (TK-097).

## v0.48.1 - Radio controls can be pressed

- Radio editor: the controls keep their height instead of shrinking under the tabs' panel, so every button can be pressed (TK-096).

## v0.48.0 - Field radio receiver

- Field radio receiver (spec 142): a wearable radio with its own battery that plays live stations of your country through a walkie-talkie sound, with weak-battery noise and dropouts, rain crackle, quieter during a bite, a wave indicator under the clock and DevTools «РАДІО».

## v0.47.31 - Radio battery and reception

- Radio receiver stage 4: the radio runs its battery down (1 hour), counted on a monotonic clock; below 25 % hiss, crackle, a quieter sound and dropouts; rain adds noise; an empty battery turns it off (spec 142).

## v0.47.30 - Walkie-talkie sound

- Radio receiver stage 3: «Звук рації» — band-pass filters, a mid boost and soft clipping with make-up gain, switched smoothly without clicks (spec 142).

## v0.47.29 - Radio receiver plays live stations

- Radio receiver stage 2: live Radio Browser stations of your country (from the browser's language, changeable), power/next/previous/volume in the radio's editor, a wave indicator under the clock, pause in a hidden tab unless «Грати у фоні» (spec 142).

## v0.47.28 - Radio receiver in the equipment

- Radio receiver stage 1: the field radio item with its art in its own auxiliary slot, a battery slot, the charge bar on its thumbnail and the item editor; the auxiliary wells scroll in a row or a column (spec 142).

## v0.47.27 - Battery as a charge bar

- A battery inserted into a device shows as the device's charge bar in its thumbnail, without an attachment cell (TK-095).

## v0.47.26 - Battery and radio art

- Battery shows its own art (768 px WebP from the owner's master); the radio receiver's art is prepared for spec 142 (1024 px); masters in asset-sources (TK-094).
