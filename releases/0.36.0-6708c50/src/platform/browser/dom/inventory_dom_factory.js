import { GlyphInkMetrics } from "./glyph_ink_metrics.js";

export class InventoryDomFactory {
  #document;
  #glyphMetrics;

  constructor(documentRef = globalThis.document, { glyphMetrics = new GlyphInkMetrics({ documentRef }) } = {}) {
    if (!documentRef?.createElement) {
      throw new TypeError("InventoryDomFactory requires a document");
    }
    this.#document = documentRef;
    this.#glyphMetrics = glyphMetrics;
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

  image(source, alternativeText = "") {
    const image = this.element("img");
    const safeSource = this.safeImageSource(source);
    if (!safeSource) return null;
    image.src = safeSource;
    image.alt = alternativeText;
    image.draggable = false;
    return image;
  }

  safeImageSource(source) {
    if (typeof source !== "string") return "";
    const value = source.trim();
    if (!value || /[\u0000-\u001f]/.test(value)) return "";
    if (/^(?:javascript|vbscript):/i.test(value)) return "";
    if (/^data:/i.test(value) && !/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(value)) {
      return "";
    }
    return value;
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

  // A decorative sprite icon: <svg><use href="sprite.svg#id"/></svg> inherits currentColor from its parent.
  svgIcon(href, className = "") {
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
