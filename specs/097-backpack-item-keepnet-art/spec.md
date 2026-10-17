# Backpack item and keepnet occupancy artwork

Owner request, 2026-10-17: add the supplied backpack as an inventory item available in the DEV free shop,
use backpack artwork instead of emoji thumbnails, and select the supplied keepnet images by occupancy.

## Behavior

- `backpack_basic` is a production catalog item in `misc`, type `backpack`, with authored tier 1 rarity.
  The existing catalog-grant port adds it, saves it and rehydrates it. Inventory lists it in Other / Backpacks.
- This adds an artwork item, with no new equipment slot, capacity limit, stat or save-schema change.
- Backpack cards, the toolbar, the All filter and capacity icon use the original-size 2048px closed WebP.
  Existing large artwork remains closed; the decorative item-list backdrop remains open.
  Landscape also shows the open backpack as a faint background aligned to the right inside the items panel;
  it never becomes a separate item or a second foreground illustration.
  Images retain their aspect ratio with `contain`; no small thumbnail is enlarged or pixelated rendering enabled.
- Keepnet artwork uses the same occupancy reading as the capacity meter, including stored catches,
  keepnet live bait and reserved hook-return positions, independently of filters.
- Images: 0% uses 0; (0,20] uses 20; (20,40] uses 40; (40,60] uses 60; (60,80] uses 80;
  (80,100] uses 100. Overcapacity clamps to 100. Zero capacity follows the existing full meter.
- Both overview instances, the decorative fish-list backdrop and the toolbar use the same image resolver.
  All six WebPs are preloaded. Repeated updates within one band retain nodes and do not rewrite `src`.
- Source PNGs stay intact. Conversion uses `utils/convert-images.js`, Middle WebP quality 80,
  preserving dimensions and alpha. Existing capacity semantics, fish rules and persistence stay unchanged.

## Acceptance

- Grant the backpack in DEV, find its image card under Other, reload and find the same item and artwork.
- Check every occupancy boundary, zero/full/overcapacity, reservations, filters and repeated unchanged readings.
- Verify production and DEV inventory at desktop and portrait sizes, including below 320px scaling.
- Run focused inventory/keepnet checks, Architecture, Quick and Full without weakening guards or baselines.
