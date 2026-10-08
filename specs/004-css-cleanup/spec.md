# Feature Specification: Dead CSS removed, inventory styles in one place

**Branch**: `develop` · **Created**: 2026-10-08 · **Status**: Approved by owner (chat, 2026-10-08) · **Kind**: structural, no visual change

## Problem (verified)
- `style.css` still holds the classic inventory UI: 23 classes (`inv-modal`, `inv-grid`, `inv-slot`,
  `inv-filter-btn`, `inv-categories`, ...) are not mentioned anywhere in JS/HTML, so every selector using them can
  never match.
- Live inventory pieces are split across files: tooltip and progression classes (`inv-tooltip*`, `inv-slot__*`)
  sit in `style.css`, the inventory panel in `inventory.css`.
- `inventory.css` has one dead class (`inventory-item-card__level`).
- Checks assert the presence of the dead classic slot CSS (`.inv-slot.has-rarity::before`, condition fill).

## Requirements
- **FR-001** Remove every selector that references a class never mentioned in JS/HTML (static string or dynamic
  prefix such as `is-${tone}`); remove rules left without selectors and keyframes no longer referenced.
- **FR-002** Move the live `inv-*` rules (tooltip, progression scales, rarity tooltip pulse) to `inventory.css`;
  `style.css` keeps only general game UI.
- **FR-003** Checks assert the live CSS contracts (card rarity frame/glow/pulse, tooltip capacity color) instead of
  the removed classic ones.
- **FR-004** New check `css-usage`: every class selector in the stylesheets is mentioned in JS/HTML or matches a
  dynamic prefix; negative fixture.

## Acceptance
All checks; game-cycle unchanged; computed styles of the inventory panel, a card and a tooltip identical before and
after in the browser; 0 console errors.
