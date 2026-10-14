# Inventory sections: equipment, backpack, keepnet

Owner instructions: 2026-10-14, the grey equipment reference (tall rod cell with a condition bar, a column of
dependent slots, a row of four auxiliary wells, three bottom tabs). Step 1 redesigns the equipment container and adds
the tab bar as a visual stub; step 2 implements section switching (owner: "do every step, resolve conflicts yourself").

## Step 1 — equipment container and tab bar stub (this change)

### Composition (every orientation)

The left inventory container follows the reference in portrait and in the two-column layout:

1. **Primary panel.** The rod cell fills the remaining width; the dependent slots (reel, terminal line, tackle,
   float — whatever the equipped rod supports) form the right column. The column height is three square cells plus
   two gaps; any number of dependent slots shares that height equally. Without a rod there are no dependent slots
   and the rod cell spans the full width. The fixed 9:16 rod proportion is removed (owner decision; DESIGN_RULES §8
   updated).
2. **Rod condition.** An equipped rod with an available condition shows a pill-shaped meter at the bottom inside its
   cell, through the shared `InventoryResourceMeterRenderer` and `DegradationColorResolver` (§9). An empty rod cell
   shows no meter.
3. **Auxiliary panel.** Four equal dark wells (hand chum, net, boat, gas mask) distributed across exactly the width
   of the primary content: the first well starts at the rod cell's left edge, the last ends at the column's right edge.
4. **Section tabs** below the container: equipment, backpack, keepnet as SVG icons (`assets/ui/inventory-sections.svg`,
   `currentColor`), accessible names from `INVENTORY_SECTIONS`. The active tab is taller, lighter and outlined,
   joined to the container like a folder tab; selection animates with shared motion tokens and respects
   `prefers-reduced-motion`. In step 1 a tab only changes its own active state (keyboard arrows/Home/End included);
   the content does not switch yet.

### Scaling

One unit `--inventory-equipment-unit` (the side cell) drives every dimension: gaps, paddings, radii, the auxiliary
well and the column height are fixed fractions of it, so the composition looks the same at every scale and stays
centered. The unit comes from the container width (`cqi` of `inventory-main__left`); in the two-column layout the
container also has a definite height, so the unit is additionally limited by its height (`cqb`) and the whole
composition fits without scrolling. Below 320 px the existing UI surface scale applies once (§4).

### Palette

Grey section palette from the reference as `--inventory-equipment-*` properties in the inventory theme: container
surface, panel, cell, well, tabs and tab text. Item cards keep their rarity frame inside the grey cells. The meter
color comes from the shared degradation colors, not from the reference image.

### Ownership

- `InventoryLoadoutPanelRenderer` builds the structure, the single-column modifier and the rod condition meter
  (resource meter renderer injected by bootstrap).
- `InventorySectionTabsRenderer` (presentation) creates/updates the tab bar; `InventoryDomFactory.svgIcon` creates the
  sprite reference. `InventoryUI` owns the tab host and, for step 1 only, the transient active section.
- Empty-slot border/background become component properties (`--inventory-slot-border`, `--inventory-slot-background`)
  with the previous values as defaults; the equipment container overrides them.

## Step 2 — section switching (implemented)

### State and actions

- `InventoryUiState` (application navigation state, already owning category, sort and panel mode) owns
  `activeSectionId: "equipment" | "backpack" | "keepnet"`; default `equipment`, kept for the rest of the session.
- New action `SECTION_SELECT { sectionId }` in `InventoryActionType` / `InventoryActionContract`, handled by the
  inventory command path that already handles navigation actions (allowed while tackle is in the water); the view
  model exposes `sections: { activeId, backpackItemCount }`. `InventoryUI` keeps no section state of its own: a tab
  dispatches the action and the rendered view model shows the section.

### Layout per section

| Section | Two-column layout (separate containers) | Single column (portrait/phones) |
| --- | --- | --- |
| Equipment | left: loadout (step 1); right: the item list | loadout, tabs, item list |
| Backpack | left: backpack illustration (`assets/ui/inventory/backpack.svg`) and carried item count; right: the item list | summary, tabs, item list |
| Keepnet | left: keepnet summary (illustration, help, occupancy `0 / 100` meter, status); right: filters, groups, fish cards | summary, tabs, fish |

Each section keeps one host per side (`inventory-main__section--equipment|backpack|items|keepnet`); a change only
toggles `hidden`, so scroll, focus, images and the item-list render signature survive. The single column keeps the
same summary/content pair as the two-column layout, stacked, so equipping from the list below works as before.

### Keepnet integration

`KeepnetUI` is a separate modal (own toolbar button, mount, close, focus, timers); `InventoryUiBootstrap.createKeepnet`
closes it when the inventory opens. Target:

- `KeepnetUI` (modal) became `KeepnetSectionView`: `summaryNode` and `contentNode` are mounted by
  `InventoryUI.attachKeepnetSection`; it reuses `KeepnetViewModel`, `KeepnetCardRenderer`, `KEEPNET_LABELS`
  and the shared resource meter. The `keepnet-modal` block became `keepnet-section` in the grey palette;
- the toolbar keepnet button toggles the inventory at `keepnet`; a catch notice opens it there
  (`showCatchResult`); the separate dialog, its close button, focus trap and `setOnOpen` coupling are removed;
- `isOpen` means "section visible", so game timers refresh the keepnet only then; Escape steps back inside the
  section (help, pending release, details) and is otherwise left to the inventory; live bait services and save
  formats are unchanged.

### Decisions (delegated by the owner)

1. Single column keeps the item list below every equipment/backpack summary, so empty-slot activation still
   highlights compatible items without a picker or forced tab change.
2. The active section persists for the session (navigation state), not in saves.
3. The toolbar keeps its keepnet button as a shortcut to the keepnet section.
4. A vector backpack illustration in the placeholder style (`assets/ui/inventory/backpack.svg`).

### Accessibility and checks

`tablist`/`tab`/`tabpanel` with `aria-controls`, roving `tabindex`, arrows/Home/End; icons carry names; focus stays
in the modal. Checks: section state transitions and default, contract rejection of unknown sections, hidden sections
keep their DOM identity, keepnet timers stop when hidden, open/close/remount leave no listeners.

## Verification

Focused inventory UI checks for structure (rod-only modifier, dependent count, meter only on an equipped rod with
condition, four wells, tab roles/active state/keyboard), CSS contracts (unit-based sizing, slot properties, hover
scoped to the desktop-hover modifier, reduced motion) and the UI catalog. Step 2: section state persists across
close/open and clears the highlighted slot (integration); unknown sections are rejected; tabs dispatch and follow the
rendered state; section hosts toggle without rebuilding the item list; backpack count; keepnet attach/visibility,
toolbar toggle, catch notice, Escape steps and disposal (keepnet check). Architecture, Quick and Full pass; the owner
performs visual acceptance; no browser testing by Claude.
