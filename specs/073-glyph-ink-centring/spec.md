# Text glyphs centred by their ink

Owner instructions: 2026-10-15, screenshot of the bait glyph in the header consumable pill (`inventory-toggle__glyph`,
20.75 × 20.75): the emoji sits visibly to the right and low. Fix the cause without hardcoded offsets and add a design
rule that prevents it.

## Cause (measured from the Windows font files)

- Segoe UI Emoji glyphs are 1.373em wide (worm 🪱: ink 0.229..1.118em, -0.14..0.845em around the baseline).
- The glyph box was `display: grid; place-items: center` with `font: <box>/1`. The implicit `auto` column grows to the
  1.373em advance and starts at the box's left edge, so `place-items` centres inside the wider track: the ink lands
  (1.373 - 1) / 2 = 0.186em ≈ 3.9px right of centre.
- With `line-height: 1` the baseline follows the primary font (Segoe UI 1.079 / 0.251em): it lies 0.414em below the line
  centre, while the emoji's ink centre is 0.353em above the baseline, so the ink is 0.06em ≈ 1.3px low and fills the box.
- Item cards used flex (no horizontal error) but the same vertical offset; other platforms' emoji fonts differ.

## Change

1. `ui-glyph.css` (linked after `tokens.css` on every page): `.ui-glyph` is a flex size container; `.ui-glyph__ink`
   uses `--ui-font-body`, `line-height: 1`, a size share of the box (`--ui-glyph-scale`, `--ui-glyph-max-size`) and
   `translate(--ui-glyph-shift-x, --ui-glyph-shift-y)`. Flex centring overflows an over-wide advance evenly.
2. `GlyphInkMetrics` (platform/browser) measures each glyph once with canvas `measureText` (ink bounds, advance and the
   font's line metrics) in the `--ui-font-body` family and returns the ink-centre offset in em; without a canvas it
   returns zero. `InventoryDomFactory.glyph(text, className)` builds the glyph and writes the shift.
3. Consumers: header consumable pill, item card icon, attachment badge icon and item-parameter header icon. Their
   classes only size the box; sizes are unchanged (cards cap at 63px, the assembly visual keeps its clamp, badges 20px).
4. DESIGN_RULES §8 rule; the UI components check verifies the measurement on Segoe's real numbers, the factory output,
   and rejects `display`/`font`/`line-height`/alignment on any glyph consumer class.

No gameplay, save or formula changes. Verification: UI components check, Architecture, Quick, Full; owner visual
acceptance, no browser testing by Claude.
