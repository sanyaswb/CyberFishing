# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.47.25 - Batteries power the bait boat

- Bait boat runs on a battery in its new slot: 5/7.5/10 min of motion per battery at levels 1/2/3, a third while waiting, nothing while idle; the charge is saved and only falls; one battery in the starting inventory and once for existing saves (spec 143).

## v0.47.24 - Aim lead in two edge zones

- Casting aim: a 200 px zone along each screen edge leads the line towards it, smoothly from 0 at the zone border to 80 px at its middle and up to the edge, at any width and always; replaces the camera-edge lead (TK-093).

## v0.47.23 - Game UI hides while aiming

- Casting aim: while a cast is aimed every game UI element (clock, fullscreen button, toolbar, version badge, DevTools button) fades out and returns on release; the split inventory stays (TK-092).

## v0.47.22 - No aim jump at the map edge

- Casting aim: when the camera stops at the map edge, the aim line stays under the finger and the lead grows smoothly from there, instead of jumping (TK-091).

## v0.47.21 - Cut and merged zones keep one shape

- Zone editor: a RMB cut keeps one shape (L, ring) and splits only pieces that fall apart; zones of a type that overlap or touch merge on release; other controls inactive while drawing; «Редагувати все» is a switch that restores (spec 141 R2).
