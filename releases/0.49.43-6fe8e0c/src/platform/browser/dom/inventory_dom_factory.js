import { GlyphInkMetrics } from "./glyph_ink_metrics.js";

export class InventoryDomFactory {
  #document;
  #glyphMetrics;
  #assets;

  // assets: the AssetRegistry; images and sprite icons are named by asset id (spec 157 R16). A factory without it
  // still builds elements, but asking it for an asset's file is an error.
  constructor(documentRef = globalThis.document, { glyphMetrics = new GlyphInkMetrics({ documentRef }), assets = null } = {}) {
    if (!documentRef?.createElement) {
      throw new TypeError("InventoryDomFactory requires a document");
    }
    this.#document = documentRef;
    this.#glyphMetrics = glyphMetrics;
    this.#assets = assets;
  }

  // Browser lookup for cold Bootstrap mounting; preserve live document, receiver and missing-global errors.
  static getElementById(id) {
    if (!("document" in globalThis)) throw new globalThis.ReferenceError("document is not defined");
    return globalThis.document.getElementById(id);
  }

  get document() {
    return this.#document;
  }

  get view() {
    return this.#document.defaultView || globalThis.window;
  }

  element(tagName, className = "", text = null) {
    const element = this.#document.createElement(tagName);
    if (className) element.className = className;
    if (text !== null && text !== undefined) {
      element.textContent = String(text);
    }
    return element;
  }

  button(className, label, { disabled = false, title = "" } = {}) {
    const button = this.element("button", className, label);
    button.type = "button";
    button.disabled = disabled;
    if (title) button.title = title;
    return button;
  }

  // An image by asset id, or null without one. Spec 157 R6: lazy (set before src) so an image of a hidden view, such
  // as the closed inventory, is not requested until it is shown; after the game is ready LazyImageWarmUp loads them in
  // the background.
  image(assetId, alternativeText = "") {
    const source = this.assetUrl(assetId);
    if (!source) return null;
    const image = this.element("img");
    image.loading = "lazy";
    image.decoding = "async";
    image.src = source;
    image.alt = alternativeText;
    image.draggable = false;
    return image;
  }

  // The file of an asset ("" without an id), for views that set the source of an element they keep.
  assetUrl(assetId) {
    if (!assetId) return "";
    if (!this.#assets) throw new TypeError("InventoryDomFactory requires assets for asset images");
    return this.#assets.pathOf(assetId);
  }

  // A text glyph (emoji) centred by its measured ink inside the consumer's box (DESIGN_RULES §8, ui-glyph.css).
  glyph(text, className = "") {
    const glyph = this.element("span", `ui-glyph ${className}`.trim());
    const ink = this.element("span", "ui-glyph__ink", text);
    const offset = this.#glyphMetrics.offset(ink.textContent);
    if (offset.x) ink.style.setProperty("--ui-glyph-shift-x", `${offset.x}em`);
    if (offset.y) ink.style.setProperty("--ui-glyph-shift-y", `${offset.y}em`);
    glyph.setAttribute("aria-hidden", "true");
    glyph.appendChild(ink);
    return glyph;
  }

  // A decorative sprite icon: <svg><use href="sprite.svg#symbol"/></svg> inherits currentColor from its parent;
  // spriteAsset is the sprite's asset id.
  svgIcon(spriteAsset, symbol, className = "") {
    const href = `${this.assetUrl(spriteAsset)}#${symbol}`;
    const namespace = "http://www.w3.org/2000/svg";
    const icon = this.#document.createElementNS(namespace, "svg");
    if (className) icon.setAttribute("class", className);
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("focusable", "false");
    const use = this.#document.createElementNS(namespace, "use");
    use.setAttribute("href", href);
    icon.appendChild(use);
    return icon;
  }

  replaceChildren(container, ...children) {
    if (!container) return;
    container.replaceChildren(...children.filter(Boolean));
  }
}
