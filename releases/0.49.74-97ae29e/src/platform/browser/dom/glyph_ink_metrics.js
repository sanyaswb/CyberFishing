// Ink centring for text glyphs (emoji) in a square box (DESIGN_RULES §8). Flex centring centres a glyph's advance and its
// line box; fonts draw the ink elsewhere (Segoe UI Emoji: 1.373em advance, ink 0.06em below the line-box centre). One
// canvas measurement per glyph returns the remaining offset in em, so every platform font is corrected without constants.
export class GlyphInkMetrics {
  static #SIZE = 100;
  static #ZERO = Object.freeze({ x: 0, y: 0 });
  #document;
  #context = undefined;
  #fontFamily = null;
  #offsets = new Map();

  constructor({ documentRef }) {
    this.#document = documentRef;
  }

  // The ink box's centre relative to the centre of a line-height:1 box, negated: { x, y } in em, zero when unmeasurable.
  offset(text) {
    const glyph = String(text);
    let offset = this.#offsets.get(glyph);
    if (!offset) {
      offset = this.#measure(glyph);
      this.#offsets.set(glyph, offset);
    }
    return offset;
  }

  #measure(glyph) {
    const context = this.#canvasContext();
    if (!context || !glyph) return GlyphInkMetrics.#ZERO;
    const size = GlyphInkMetrics.#SIZE;
    context.font = `${size}px ${this.#fontFamily}`;
    context.textBaseline = "alphabetic";
    const metrics = context.measureText(glyph);
    const inkCenterX = (metrics.actualBoundingBoxRight - metrics.actualBoundingBoxLeft) / 2;
    // With line-height 1 the baseline lies (fontAscent - fontDescent) / 2 below the line-box centre.
    const baselineBelowCenter = (metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2;
    const inkAboveBaseline = (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
    const x = (metrics.width / 2 - inkCenterX) / size;
    const y = (inkAboveBaseline - baselineBelowCenter) / size;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return GlyphInkMetrics.#ZERO;
    return Object.freeze({ x: GlyphInkMetrics.#round(x), y: GlyphInkMetrics.#round(y) });
  }

  // The glyph font is the --ui-font-body token, read once from the root, so CSS and the measurement use one family.
  #canvasContext() {
    if (this.#context !== undefined) return this.#context;
    this.#context = null;
    const view = this.#document?.defaultView;
    const root = this.#document?.documentElement;
    const family = root && view?.getComputedStyle?.(root).getPropertyValue("--ui-font-body").trim();
    const context = family ? this.#document.createElement("canvas").getContext?.("2d") : null;
    if (context?.measureText) {
      this.#fontFamily = family;
      this.#context = context;
    }
    return this.#context;
  }

  static #round(value) {
    return Math.round(value * 1000) / 1000 || 0;
  }
}
