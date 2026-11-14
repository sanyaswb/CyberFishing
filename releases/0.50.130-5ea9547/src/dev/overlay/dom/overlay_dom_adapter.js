import { UiEventShield } from "../../../platform/browser/dom/ui_event_shield.js";

// The window's size factor at start (owner, 2026-10-18: 1.5 times smaller than full size); top slider changes it.
const DEFAULT_SCALE = 2 / 3;
const MIN_SAVED_SCALE = 0.3;
const MAX_SAVED_SCALE = 3.0;

function nodeKey(node) {
  if (!node || node.nodeType !== 1 /* ELEMENT_NODE */) return null;
  if (node.id) return `#${node.id}`;
  if (typeof node.getAttribute === "function") {
    const metric = node.getAttribute("data-overlay-metric");
    if (metric) return `m:${metric}`;
    const control = node.getAttribute("data-overlay-control");
    if (control) return `c:${control}`;
  }
  return null;
}

// A DEV overlay window. Its scale is the --debug-overlay-scale property: CSS zooms the content and controls with it
// and scales the window's padding, so the window's box is what is seen (dragging and clamping need no transform
// correction) and its width follows the content.
export class OverlayDomAdapter {
  #documentTarget;
  #mountNode;
  #createScaleControls;
  #createDragController;
  #moduleKey;
  #cache;
  #scaleStorageKey;
  #onClose;
  #container = null;
  #content = null;
  #scaleControls = null;
  #dragController = null;
  #scale;
  #openDetailsIds = new Set();
  #sizeObserver = null;

  constructor({
    documentTarget = document,
    mountNode = documentTarget.body,
    createScaleControls,
    createDragController,
    scale = DEFAULT_SCALE,
    moduleKey = "",
    cache = null,
    scaleStorageKey = "",
    onClose = null,
  } = {}) {
    const saved = scaleStorageKey ? Number(cache?.get?.(scaleStorageKey)) : NaN;
    this.#scale = Number.isFinite(saved) && saved >= MIN_SAVED_SCALE && saved <= MAX_SAVED_SCALE ? saved : scale;
    this.#documentTarget = documentTarget;
    this.#mountNode = mountNode;
    this.#createScaleControls = createScaleControls;
    this.#createDragController = createDragController;
    this.#moduleKey = String(moduleKey || "");
    this.#cache = cache;
    this.#scaleStorageKey = String(scaleStorageKey || "");
    this.#onClose = typeof onClose === "function" ? onClose : null;
  }

  init() {
    if (this.#container?.isConnected) return;

    this.#container = this.#documentTarget.createElement("div");
    if (this.#moduleKey) {
      this.#container.dataset.overlayModule = this.#moduleKey;
    } else {
      this.#container.id = "debugOverlay";
    }
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

    this.#scaleControls = this.#createScaleControls({
      documentTarget: this.#documentTarget,
      scale: this.#scale,
      onScaleChanged: (scale) => this.setScale(scale),
      onScaleCommitted: (scale) => this.#saveScale(scale),
      onClose: this.#onClose,
    });
    this.#container.appendChild(this.#scaleControls.create());
    this.#container.appendChild(this.#content);
    this.#container.style.setProperty("--debug-overlay-scale", String(this.#scale));
    this.#mountNode.appendChild(this.#container);

    this.#dragController = this.#createDragController(this.#container);
    this.#dragController.attach();
    // The window is clamped when its size changes, not on every content update: reading it forces a layout (TK-202).
    const ResizeObserverClass = this.#documentTarget.defaultView?.ResizeObserver;
    if (typeof ResizeObserverClass === "function") {
      this.#sizeObserver = new ResizeObserverClass(() => this.#clampWhenStable());
      this.#sizeObserver.observe(this.#container);
    }
  }

  show() {
    if (!this.#container) return;
    if (this.#container.style.display === "flex") return;
    this.#container.style.display = "flex";
    this.#clampWhenStable();
  }

  // TK-308: the controller calls hide() on every update for inactive windows; a hidden window is not written again.
  hide() {
    if (this.#container && this.#container.style.display !== "none") this.#container.style.display = "none";
  }

  updateHtml(html) {
    if (!this.#content) return;
    const hasExistingChildren = this.#content.childNodes && this.#content.childNodes.length > 0;
    if (!hasExistingChildren || typeof this.#documentTarget.createElement !== "function") {
      this.#content.innerHTML = html;
      this.#applyOpenDetails();
      if (!this.#sizeObserver) this.#clampWhenStable();
      return;
    }
    const temp = this.#documentTarget.createElement("div");
    temp.innerHTML = html;
    this.#patchChildren(this.#content, temp);
    if (!this.#sizeObserver) this.#clampWhenStable();
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

    const curKeyMap = new Map();
    for (let i = 0; i < curChildren.length; i++) {
      const child = curChildren[i];
      const key = nodeKey(child);
      if (key && !curKeyMap.has(key)) {
        curKeyMap.set(key, child);
      }
    }

    let curIdx = 0;
    for (let nextIdx = 0; nextIdx < nextChildren.length; nextIdx++) {
      const nextChild = nextChildren[nextIdx];
      const nextKey = nodeKey(nextChild);
      let matchingNode = null;

      if (nextKey && curKeyMap.has(nextKey)) {
        matchingNode = curKeyMap.get(nextKey);
        curKeyMap.delete(nextKey);
      } else {
        const candidate = parent.childNodes ? parent.childNodes[curIdx] : null;
        if (candidate && !nodeKey(candidate) && candidate.nodeType === nextChild.nodeType && candidate.nodeName === nextChild.nodeName) {
          matchingNode = candidate;
        }
      }

      if (matchingNode) {
        const refNode = parent.childNodes ? parent.childNodes[curIdx] : null;
        if (matchingNode !== refNode && typeof parent.insertBefore === "function") {
          parent.insertBefore(matchingNode, refNode || null);
        }
        this.#patchNode(matchingNode, nextChild);
        curIdx++;
      } else {
        const newNode = typeof nextChild.cloneNode === "function" ? nextChild.cloneNode(true) : nextChild;
        if (newNode.nodeName === "DETAILS" && newNode.id && this.#openDetailsIds.has(newNode.id)) {
          newNode.open = true;
        }
        const refNode = parent.childNodes ? parent.childNodes[curIdx] : null;
        if (typeof parent.insertBefore === "function") {
          parent.insertBefore(newNode, refNode || null);
        } else {
          parent.appendChild?.(newNode);
        }
        curIdx++;
      }
    }

    for (const [, orphan] of curKeyMap) {
      if (orphan.parentNode === parent) {
        if (typeof orphan.remove === "function") orphan.remove();
        else parent.removeChild?.(orphan);
      }
    }

    while (parent.childNodes && parent.childNodes.length > curIdx) {
      const child = parent.childNodes[curIdx];
      if (typeof child.remove === "function") child.remove();
      else parent.removeChild?.(child);
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
      const zoom = () => this.#container.style.setProperty("--debug-overlay-scale", String(this.#scale));
      if (this.#dragController?.keepPosition) this.#dragController.keepPosition(zoom);
      else zoom();
      this.#clampWhenStable();
    }
  }

  #saveScale(scale) {
    if (this.#scaleStorageKey) this.#cache?.set?.(this.#scaleStorageKey, scale);
  }

  #clampWhenStable() {
    if (this.#dragController?.isDragging?.()) return;
    this.#dragController?.clampToViewport?.();
  }

  dispose() {
    this.#sizeObserver?.disconnect();
    this.#sizeObserver = null;
    this.#scaleControls?.dispose?.();
    this.#scaleControls = null;
    this.#dragController?.detach?.();
    this.#container?.remove();
    this.#container = null;
    this.#content = null;
    this.#dragController = null;
  }
}
