# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.50.30 - Live bait stacks equip like baits

- TK-245: tapping a live bait stack in the backpack follows the bait rules: an empty single hook takes the species' next live bait at once; over a regular bait or another live bait the switcher cell turns green and the stack panel offers «Замінити» (a repeated tap or the cell confirms, «Назад» cancels); the chosen species only opens its panel; with no single hook «Спорядити» marks the tackle.

## v0.50.29 - Live bait in the bait pick, full list after a choice

- Spec 165 stage 2 (TK-242): an empty bait cell lists the live bait stacks among the compatible baits when the tackle has one hook; choosing a stack (or the repeated tap on the cell when it is first) puts the species' next live bait on and opens its panel. After any bait choice the search ends: «Усе» lists the whole backpack (it showed only baits).

## v0.50.28 - Bait choice always opens its editor

- Spec 165 stage 1 (TK-242): choosing a bait opens its editor every time; an empty hook takes it at once, a hook with another bait highlights its switcher cell and the editor offers «Замінити» (a repeated click or a tap on the cell replaces too, «Назад» cancels); «Спорядити» with nowhere to put the bait opens the equipment and marks the missing rod or tackle.

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
