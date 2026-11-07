# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.50.27 - Live baits in the backpack keep their place

- TK-244: once a species is sent to the backpack, every keepnet card of it loses both the backpack button and «Відпустити» (its live baits are all in the backpack, and the service refuses releasing them); «В садок» in the inventory brings both back.

## v0.50.26 - Live bait card: release and backpack

- TK-243: every live bait card ends with «Відпустити» across the row and a square backpack button, which is available before the live bait is chosen (a species already in the backpack only says so); the chosen live bait still cannot be released.

## v0.50.25 - Repeated click on an equipped bait

- TK-241: clicking a bait that is already on the hook (or another jar of the same bait) opens its editor instead of highlighting the hook's cell again for the same replacement; every bait type alike, a different bait still proposes the replacement.

## v0.50.24 - Live bait stack in the item editor

- TK-240: a live bait stack opens in the ordinary item editor like any bait: the fish's picture in the editor's card, each fish as a parameter row (thumbnail and life scale without a number), «В садок» and «Назад»; the separate stack panel is gone.

## v0.50.23 - Backpack limit

- TK-239 (spec 164): the backpack holds at most 100 slots: every owned item counts wherever it is (equipped ones too, so taking things off always works), live baits never; new items that do not fit are refused (DEV shop, House feed; one-time grants wait for room); a full backpack's skin turns translucent red.

## v0.50.22 - Live bait stack in the backpack

- Spec 163 stage 2: a species shown with «В інвентар» is a bait-like stack card in the backpack (fish picture, count in the corner, one slot, no weight); opening it lists every fish with a life scale without numbers, «В садок» removes the stack. The fish stay in the keepnet.

## v0.50.21 - Chosen live bait goes to the inventory

- Spec 163 stage 1: the chosen live bait can no longer be released; its card has «В інвентар» (backpack icon), which marks its species for a backpack stack of its keepnet and aquarium live baits (they stay in the keepnet); a used-up, dead or released live bait leaves the stack. The backpack card follows in stage 2.

## v0.50.20 - Live bait card icons, one hook drawing

- TK-238: on the live bait card «На живця» is the inventory's hook icon, «В акваріум» a new aquarium icon and every cancel a red cross (the text stays the button's name and tooltip); empty hook compartments draw the same hook, the old tackle.svg moved to asset-sources.

## v0.50.19 - Automatic switch needs a chosen bait

- TK-237: without a bait (or chum) in any slot the automatic switch is off and inactive (dimmed track), so a used-up bait no longer lets «A» turn on with the old bait's reserve; the saved setting returns with a chosen bait.

## v0.50.18 - Green switcher when a bait is chosen

- TK-236: the bait and chum switcher turns green while a bait, live bait or chum is in its slots, not only in automatic mode; automatic mode colours only its own track.
