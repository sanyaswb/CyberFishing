# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.50.17 - Switcher cells at full height

- TK-235: the bait and chum switcher's item circle takes the pill's whole height and the art inside is the largest box of its own proportion that fits the circle (a long worm icon or live bait is no longer a third of the circle); a slot's count is a badge on the circle's edge.

## v0.50.16 - Live bait reserve in the switcher

- TK-234: with auto refill on, the bait switcher's count shows how many live baits of the chosen one's species can still follow it onto the hook (keepnet and aquarium, not the chosen one, not dead ones), like the backpack reserve of a regular bait; it showed 0.

## v0.50.15 - «Замінити» fixed

- TK-233: pressing «Замінити» no longer crashes the inventory (incident I-14): the moment the bait is off and the live bait not yet chosen draws an empty green cell; the waiting card's second button is «Скасувати».

## v0.50.14 - Live bait in the bait switcher

- TK-229.3 stage 2 (spec 162): the chosen live bait shows in the bait switcher's empty hook cell; over a regular bait «На живця» turns the card green with «Замінити» and the hook's cell blinks, and replacing returns the bait to the backpack. Not while the tackle is in the water; one hook only.
