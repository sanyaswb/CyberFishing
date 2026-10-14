# Inventory shortcuts and cast consumables

Owner instructions: 2026-10-14, portrait inventory corrections and the clarified sequential bait selection.
The same interaction applies in landscape. Existing gameplay formulas, custody, save format and auto-refill
remain authoritative; the hook/bait relationship is hidden in the UI rather than migrating persisted items.

## Navigation

- The location backpack shortcut selects `backpack`, including after closing the keepnet and while another section
  is open. Pressing it again while the backpack is visible closes the inventory.
- Keepnet shortcuts still select `keepnet`. Explicit backpack navigation ends a stale item editor; normal socket
  picks retain their editor until completion or cancellation.

## Header

- Consumable buttons sit inside each pill to the left of its separate automatic-mode switch label. Pressing an
  item button never toggles automatic mode. Keyboard focus and accessible item names remain available.
- With no equipped hook, bait shows one dark-grey placeholder. Each equipped hook exposes its own lighter
  placeholder; an equipped bait replaces it with its artwork. The owner's `inventory-switcher-mob-v2.png` sketch
  supersedes the earlier two-icon limit: three hooks expose three individually selectable icons.
- Automatic mode shows each different item's exact matching backpack reserve below its artwork and the
  deduplicated total beside `A`: 12/80/10 reads 102. Manual mode shows one per filled item and the number of
  equipped portions beside `A`: three different baits read 1/1/1 and total 3.
- When every target is filled with the same refill choice, retain every selectable icon but hide all individual
  counts, including for one hook. Show only the total (shared reserve in automatic mode, equipped count in manual).
  Different variants/qualities remain distinct; partially empty tackle retains individual filled-item counts.
- Both equipment pills and the House's compact switch slide their thumb with `transform`, preserving DOM
  identity and focus across updates. Automatic mode controls the `A` color/track; empty outer pills stay muted.
- Portrait keeps one composition through logical 820px, where the side panel is still hidden. A shared header
  unit grows from 1px at 320px to a 2px cap: 36px pill/track/close, 26px thumb and 22px artwork circle.
  No style jump occurs at 520px; below 320px the existing surface scale still applies once.
- Empty slots remain visible independently of equipped-item count. Slot availability comes from the equipped
  tackle's actual attachment targets, not from the number of compatible items in the backpack.
- Chum shows only the portions carried by the cast tackle. Hand chum and boat cargo do not appear in the pill or
  contribute to its displayed reserve. Multiple configured tackle chum slots follow the same icon contract.
- Hook cards and craft panels have no bait badges, bait sockets or nested bait selection. Craft panels still show
  their other components; a compatible bare hook equips directly without an empty craft menu.
- Successful equipment commands return to `equipment` and flash the changed slot green once. Bait/chum slot
  fills keep the backpack open. Subsequent refreshes do not replay the equipment flash.
- Owner correction after the 336px screenshot: weight leaves the consumable row. A separate lower load row
  stays inside `inventory-header`, spans its mobile content width and the desktop left-panel column, with the weight icon on its left.
  The fixed scale maximum is 100kg (1kg = 1%); the shared resource-meter renderer owns fill/color/reading updates.
- Item artwork sits in a true circle with an initially invisible border and independent count below it.
  Selected/focused borders follow the same circle; padding and `contain` keep the actual artwork visible.
  Pill, track and thumb backgrounds remain opaque when automatic mode changes their color.
- The backpack item area is its own opaque rounded panel, using the existing `inventory-panel` template and
  equipment palette. It fills all remaining content height with inner/outer spacing; four mobile columns and
  internal grid scrolling remain intact.
- Owner reference correction: pill, track and close share one height and top/bottom alignment, without a taller
  padded outer container. Narrow landscape uses the same compact geometry with a 44px height cap; desktop
  also uses 44px controls and centers the switch group relative to the full upper header row.

## Selection

1. A header icon opens the backpack and highlights available consumables for that specific slot. Selecting an item
   equips/replaces one portion in that slot, leaving the backpack open.
2. Selecting bait directly in the backpack equips the first empty slot immediately; each subsequent click fills
   the next empty slot in the stable attachment order.
3. When all slots are filled, a first click proposes exactly one replacement and highlights that header icon.
   It prefers a different item ID: choosing worm beside worm + bread proposes bread. No item is consumed yet.
4. Clicking that same inventory item again confirms the highlighted replacement and returns the previous bait
   through the existing atomic assembly transaction. Choosing a different item recomputes the proposed target.
5. Category/sort browsing keeps the pick. Section navigation or closing cancels it. Equipment-changing actions,
   including opening the consumable picker, remain blocked while the tackle is in the water.

## Ownership and validation

`EquipmentConsumableTargetResolver` reads the equipped tackle's targets. `InventoryUiState` owns the transient
kind, target and selected item; `InventoryCommandService` orchestrates existing atomic attachment operations.
The presentation factory projects available/highlighted slots; shared switch and header renderers build the UI.
No DOM or UI state owns gameplay items.

Focused inventory/UI/shared-component/player checks cover section shortcuts, empty/populated placeholders,
sequential placement, replacement highlighting and confirmation, returned stock, cancellation, lock policy,
three independent icons, manual/automatic totals, uniform-reserve count suppression and callback disposal.
Architecture, Quick and Full validate the production and DEV composition;
the game-cycle digest and save round trips must remain unchanged. The existing UI surface checks cover
240/280/319/320px scaling and pointer policy. Browser measurements at 240/280/319/320/520/521/600/740/820px
confirm both pills fit and item counts stay below artwork. At 821px the side panel appears. Production browser
checks confirm actual bait art, working mode changes, rod return/one-shot flash and direct hook equipment.
The complete interaction contract is [docs/inventory-behavior.md](../../docs/inventory-behavior.md).
Owner visual/play acceptance remains pending.

Final verification (2026-10-14): Architecture 4/4, Quick 25/25, Full 51/51. The game-cycle baseline is unchanged.
Index and DEV browser smoke cover the changed controls; DEV warning/error logs are empty.
The UI catalog includes three different baits and three identical baits for repeatable visual checks.
The follow-up catalog states reproduce the owner's two-bait selected slot with 1kg and the worst-case
three-bait/two-chum header. Browser checks at 240/280/319/320/520/521/600/740/820/821/960px confirm fitting
controls, square circular artwork bounds, separate item counts and load width equal to the desktop left column.
Final follow-up verification (2026-10-15): the 100kg scale is contained in the lower header row, and the
backpack's opaque rounded panel fills the available area. Index/DEV browser checks pass without warning/error
logs; four mobile columns and internal scrolling are preserved. Architecture 4/4, Quick 25/25 and Full 51/51 pass.
Equal-height reference follow-up: portrait/landscape catalog sweeps at 240–960px confirm shared height/top edges,
five-slot fitting and unobstructed item counts. Real index at 1280×800 and DEV at 600×340 both report 44px for
pills, tracks and close; desktop center offset is zero. Architecture 4/4, Quick 25/25 and Full 51/51 still pass.
