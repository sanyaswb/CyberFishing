# Hints inside their containers

Owner request, 2026-10-15: review every hint that shows task information and give them one style. The keepnet help
(`keepnet-section__help`) is cut off and does not show its full text; the inventory warning (for example
`equipLineToCast`, "Спочатку споряди ліску для закидання.") and the House notice (`house__notice`) each have their own
look. Rule: a hint appears inside the container it belongs to. The quick hint gets a close button (×).

## Causes

- Keepnet help: an absolutely positioned box up to 320px wide, anchored to the right edge of the illustration box,
  which is narrower in the inventory's left column. It extended past the left edge and below the illustration, and the
  scrolling summary and sidebar clipped it.
- Inventory warning: a collapsible row between the header and the main area (`max-height: 120px`, `overflow: hidden`,
  red banner), unlike the other hints and without a way to dismiss it. This in-flow rule came from v0.24.0 (no spec)
  and is replaced by the owner's container rule.
- House notice: `position: fixed` 140px from the top of the page, centred on the viewport, whatever sheet the
  reported action came from; its own colours.

## Change

- `ui-hint` (in `modal-controls.css`, next to the shared close button): one hint surface (`--ui-hint-*` tokens in
  `tokens.css`), tones `ui-hint--info | --warning | --error`, `ui-hint__text` (wraps long words, keeps line breaks) and
  `ui-hint__close` (the shared `ui-modal-close`, compact and transparent). Hidden with the `hidden` attribute; a long
  hint scrolls inside itself instead of being clipped.
- `UiHintRenderer` (`presentation/ui`): `create` builds the hint for JS-built screens, `adopt` binds page markup that
  already has the structure (the House page); `show(hint, text, tone)`, `hide`, `isVisible`, `dispose`. The owner places
  the hint through a BEM mix; the block never positions itself.
- Keepnet help: built by the renderer, a child of `keepnet-section__summary` (now `position: relative`), across the
  summary width minus its padding, under the ? button. Clicks inside the hint keep it open; its × and any other click
  or Escape dismiss it, as before.
- Inventory warning: a `ui-hint--warning` inside `inventory-main` (now `position: relative`), over the top edge of the
  main area, at most 620px wide and never taller than the area; the × dismisses it and cancels its 5 s timer.
- House notice: `ui-hint` markup in `fisherman-house.html` with a × (`data-house-notice-close`). `HouseView.announce`
  moves it into the open sheet (`HouseNavigationController.activeSheetContent()`), where it sticks above the dock as the
  last child of the sheet content; with no sheet open it stays in the room under the header. Failures use
  `ui-hint--error`.
- The item balance tooltip keeps its hover placement (it opens only on desktop hover and does not take pointer
  events, so it has no ×) and shares the hint surface tokens (background, radius, shadow).

No gameplay, save, timing or formula changes.

## Verification

Focused: inventory UI (placement rule, structure, × closes and a new warning reopens), keepnet (hint inside the summary,
inside click keeps it open, × closes and releases the document listener), House (notice in the open sheet, back in the
room without one, × closes, error tone, House sheets still have no cross buttons), UI catalog, UI components, CSS usage,
Architecture. Quick and Full. Visual acceptance by the owner; Claude did not open a browser.
