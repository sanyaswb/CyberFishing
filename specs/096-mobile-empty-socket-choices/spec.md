# Mobile editor: inventory choices below an empty socket

Owner request, 2026-10-16. No version bump or release without the owner's command.

## Behavior

In portrait at up to 820 logical px, the active empty socket's page keeps its existing message
(for example, “Ліска: комірка порожня”) and shows inventory cards underneath. The list is specific
to that socket, uses the existing compatibility rules and accessible inventory roots, and does
not depend on the backpack's selected category, rarity or subtype filters. Cards reuse production
inventory artwork, quantities and resource meters in four equal columns; they flow with the
editor's existing vertical scroll. Below 320px the same composition scales through UiSurfaceAdapter.
Landscape and desktop keep their existing pages without the inline choices.

Tapping a candidate starts the existing pick/item activation flow for the exact displayed address
inside one `ASSEMBLY_SOCKET_ITEM_ACTIVATE` command, without navigating to the backpack. Existing
assembly preparation/readiness rules and editor return behavior remain in effect. The command
rechecks the current editor, source location, empty target, full address and compatibility. A stale
card must not overwrite a now occupied socket or fill another equal socket. The player-inventory
lock gate applies to the new mutation action.

When there are no compatible inventory items, show “В магазин”. The owner confirmed this is a
stub: a tap displays “Магазин у розробці.” through the existing top hint region. It neither opens
DEV Tools nor navigates to a nonexistent production shop. Other unavailable prerequisites, such
as an unequipped rod, retain their existing warning and do not offer a misleading stock/shop picker.

The existing empty-cell tap, filled-cell tap/long press and swipe navigation remain available.
Merely browsing an empty page does not start a pick or change equipment. Only the active empty
page builds candidate cards; leaving it releases that list instead of duplicating the whole
inventory under every hook. Numeric refresh updates existing card meters in place.

## Ownership and verification

InventoryViewModelFactory provides `compatibleItems` and `canSelectCompatibleItem` on each socket;
InventoryViewModelNormalizer preserves this read contract. InventoryEditorTabsRenderer builds
the active page, reusing InventoryItemCardRenderer; its labels remain in the injected catalog.
InventoryUI dispatches the addressed command, and InventoryCommandService orchestrates the
existing pick and item use cases. No new mutable gameplay owner, Domain rule, save format,
production-to-DEV dependency or global is introduced.

Focused UI/integration checks cover targeted filtering, quantities, exact second-socket placement,
stack splitting, incompatible/occupied stale cards, keeping the editor, releasing inactive grids,
and the top shop notice without an inventory command. Validate Architecture, Quick, Full and
browser smoke on index/dev, portrait widths 240/280/319/320 and wider, plus landscape/desktop.
