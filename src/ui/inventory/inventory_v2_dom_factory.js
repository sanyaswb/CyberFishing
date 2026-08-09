class InventoryV2DomFactory {
  #document;

  constructor(documentRef = globalThis.document) {
    if (!documentRef?.createElement) {
      throw new TypeError("InventoryV2DomFactory requires a document");
    }
    this.#document = documentRef;
  }

  get document() {
    return this.#document;
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

  replaceChildren(container, ...children) {
    if (!container) return;
    container.replaceChildren(...children.filter(Boolean));
  }
}

globalThis.InventoryV2DomFactory = InventoryV2DomFactory;
