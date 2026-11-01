import { UiEventShield } from "../../../platform/browser/dom/ui_event_shield.js";

// The window's size factor at start (owner, 2026-10-18: 1.5 times smaller than full size); − / + change it.
const DEFAULT_SCALE = 2 / 3;

// The DEV overlay window. Its scale is the --debug-overlay-scale property: CSS zooms the content and the − / + buttons
// with it and scales the window's padding, so the window's box is what is seen (dragging and clamping need no
// transform correction) and its width follows the content.
export class OverlayDomAdapter {
  #documentTarget;
  #mountNode;
  #createScaleControls;
  #createDragController;
  #container = null;
  #content = null;
  #dragController = null;
  #scale;
  #openDetailsIds = new Set();

  constructor({
    documentTarget = document,
    mountNode = documentTarget.body,
    createScaleControls,
    createDragController,
    scale = DEFAULT_SCALE,
  } = {}) {
    this.#scale = scale;
    this.#documentTarget = documentTarget;
    this.#mountNode = mountNode;
    this.#createScaleControls = createScaleControls;
    this.#createDragController = createDragController;
  }

  init() {
    if (this.#container?.isConnected) return;

    this.#container = this.#documentTarget.createElement("div");
    this.#container.id = "debugOverlay";
    this.#container.className = "debug-overlay";

    if (UiEventShield.makeSolid) {
      UiEventShield.makeSolid(this.#container);
    }

    this.#content = this.#documentTarget.createElement("div");
    this.#content.className = "debug-overlay__content";
    if (typeof this.#content.addEventListener === "function") {
      this.#content.addEventListener("toggle", (event) => {
        const details = event.target;
        if (details?.id) {
          if (details.open) this.#openDetailsIds.add(details.id);
          else this.#openDetailsIds.delete(details.id);
        }
      }, true);
    }
    this.#container.appendChild(this.#content);

    const controls = this.#createScaleControls({
      documentTarget: this.#documentTarget,
      scale: this.#scale,
      onScaleChanged: (scale) => this.setScale(scale),
    });
    this.#container.appendChild(controls.create());
    this.#container.style.setProperty("--debug-overlay-scale", String(this.#scale));
    this.#mountNode.appendChild(this.#container);

    this.#dragController = this.#createDragController(this.#container);
    this.#dragController.attach();
  }

  show() {
    if (!this.#container) return;
    if (this.#container.style.display === "flex") return;
    this.#container.style.display = "flex";
    this.#clampWhenStable();
  }

  hide() {
    if (this.#container) this.#container.style.display = "none";
  }

  updateHtml(html) {
    if (!this.#content) return;
    const hasExistingChildren = this.#content.childNodes && this.#content.childNodes.length > 0;
    if (!hasExistingChildren || typeof this.#documentTarget.createElement !== "function") {
      this.#content.innerHTML = html;
      this.#applyOpenDetails();
      this.#clampWhenStable();
      return;
    }
    const temp = this.#documentTarget.createElement("div");
    temp.innerHTML = html;
    this.#patchNode(this.#content, temp);
    this.#applyOpenDetails();
    this.#clampWhenStable();
  }

  #applyOpenDetails() {
    if (this.#openDetailsIds.size === 0 || typeof this.#content.querySelectorAll !== "function") return;
    for (const el of this.#content.querySelectorAll("details[id]")) {
      if (this.#openDetailsIds.has(el.id) && !el.open) el.open = true;
    }
  }

  #patchNode(current, next) {
    if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName) {
      if (typeof current.replaceWith === "function" && typeof next.cloneNode === "function") {
        current.replaceWith(next.cloneNode(true));
      } else if (current.parentNode && typeof current.parentNode.replaceChild === "function") {
        current.parentNode.replaceChild(typeof next.cloneNode === "function" ? next.cloneNode(true) : next, current);
      }
      return;
    }
    if (current.nodeType === 3 /* TEXT_NODE */) {
      if (current.nodeValue !== next.nodeValue) {
        current.nodeValue = next.nodeValue;
      }
      return;
    }
    if (current.nodeType !== 1 /* ELEMENT_NODE */) return;

    const curAttrs = current.attributes;
    const nextAttrs = next.attributes;
    if (curAttrs) {
      for (let i = curAttrs.length - 1; i >= 0; i--) {
        const name = curAttrs[i].name;
        if (current.nodeName === "DETAILS" && name === "open") continue;
        if (!next.hasAttribute(name)) {
          current.removeAttribute(name);
        }
      }
    }
    if (nextAttrs) {
      for (let i = 0; i < nextAttrs.length; i++) {
        const { name, value } = nextAttrs[i];
        if (current.nodeName === "DETAILS" && name === "open") continue;
        if (current.getAttribute(name) !== value) {
          current.setAttribute(name, value);
        }
      }
    }

    this.#patchChildren(current, next);
  }

  #patchChildren(parent, nextParent) {
    const curChildren = Array.from(parent.childNodes || []);
    const nextChildren = Array.from(nextParent.childNodes || []);
    const max = Math.max(curChildren.length, nextChildren.length);
    for (let i = 0; i < max; i++) {
      const cur = curChildren[i];
      const next = nextChildren[i];
      if (!cur && next) {
        parent.appendChild(typeof next.cloneNode === "function" ? next.cloneNode(true) : next);
      } else if (cur && !next) {
        if (typeof cur.remove === "function") cur.remove();
        else parent.removeChild?.(cur);
      } else if (cur && next) {
        this.#patchNode(cur, next);
      }
    }
  }

  getRootElement() {
    return this.#container;
  }

  setScale(scale) {
    this.#scale = scale;
    this.applyScale();
  }

  applyScale() {
    if (this.#container) {
      this.#container.style.setProperty("--debug-overlay-scale", String(this.#scale));
      this.#clampWhenStable();
    }
  }

  #clampWhenStable() {
    if (this.#dragController?.isDragging?.()) return;
    this.#dragController?.clampToViewport?.();
  }

  dispose() {
    this.#dragController?.detach?.();
    this.#container?.remove();
    this.#container = null;
    this.#content = null;
    this.#dragController = null;
  }
}
