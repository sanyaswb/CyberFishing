import { UiEventShield } from "../dom/ui_event_shield.js";

const DEPTH_STEP_METERS = 0.1;
const DEPTH_PAGE_METERS = 1;

// Depth control of a float or jig rig: a tackle button that shows the selected depth and, when pressed, slides out a
// horizontal depth track beside it (surface at the left, the deepest reachable depth at the right). The track follows
// pointer drags, the wheel and the keyboard. While it is open, a press on the game canvas only closes it.
export class DepthSelector {
  #labels;
  #document;
  #mount;
  #root;
  #button;
  #icon;
  #buttonValue;
  #panel;
  #track;
  #line;
  #marker;
  #markerValue;
  #minLabel;
  #maxLabel;
  #minDepth = 0.1;
  #maxDepth = 0.1;
  #value = 0.1;
  #iconText = "";
  #dragPointerId = null;
  #isOpen = false;
  #disposed = false;
  #dom;
  #iconImages;
  #dragRect = null;
  #unsubscribe;
  #removeShield;
  #bindings = [];
  #onDocumentPointerDown = (event) => this.#closeOnOutsidePress(event);
  #onDocumentKeyDown = (event) => {
    if (this.#isOpen && event.key === "Escape") this.close();
  };

  constructor({ labels, documentRef = document, mountNode = documentRef.body, uiSurface = null,
    domFactory = null, iconImages = null } = {}) {
    this.#labels = labels;
    this.#document = documentRef;
    this.#mount = mountNode;
    this.#dom = domFactory;
    this.#iconImages = iconImages;
    this.onChange = null;
    this.isActive = false;
    this.#build();
    this.#bindEvents();
    this.#unsubscribe = uiSurface?.subscribe(() => this.close());
  }

  get isOpen() {
    return this.#isOpen;
  }

  get value() {
    return this.#value;
  }

  // Shows the control closed; the map stays clean until the player opens the track.
  show(maxDepth, currentDepth, changeCallback) {
    if (this.#disposed) return;
    this.isActive = true;
    this.onChange = changeCallback;
    this.#setRange(maxDepth);
    this.#value = this.#clamp(currentDepth);
    this.#root.hidden = false;
    this.#render();
  }

  updateMax(maxDepth) {
    if (this.#disposed || !this.isActive || maxDepth === this.#maxDepth) return;
    this.#setRange(maxDepth);
    const clamped = this.#clamp(this.#value);
    if (clamped !== this.#value) {
      this.#value = clamped;
      this.#render();
      this.onChange?.(clamped);
      return;
    }
    this.#render();
  }

  // Artwork is supplied by composition; legacy callers retain the text fallback.
  setIcon(icon) {
    if (this.#disposed) return;
    const text = icon || "";
    if (text === this.#iconText) return;
    this.#iconText = text;
    this.#icon.textContent = "";
    const source = this.#iconImages?.[text];
    if (source) {
      const image = this.#document.createElement("img");
      image.className = "game-toolbar-button__image";
      // Spec 157 R6: lazy before src, so a hidden image (closed inventory, hidden toolbar button) waits until it is shown.
      image.loading = "lazy"; image.decoding = "async";
      image.src = source; image.alt = ""; image.draggable = false;
      this.#icon.appendChild(image);
    } else if (this.#dom) this.#icon.appendChild(this.#dom.glyph(text, "depth-selector__glyph"));
    else this.#icon.textContent = text;
  }

  open() {
    if (this.#disposed || !this.isActive || this.#isOpen) return;
    this.#isOpen = true;
    this.#panel.hidden = false;
    this.#panel.inert = false;
    this.#track.tabIndex = 0;
    this.#root.classList.add("depth-selector--open");
    this.#button.setAttribute("aria-expanded", "true");
  }

  close() {
    if (this.#disposed || !this.#isOpen) return;
    this.#isOpen = false;
    this.#endDrag();
    this.#panel.hidden = true;
    this.#panel.inert = true;
    this.#track.tabIndex = -1;
    this.#root.classList.remove("depth-selector--open");
    this.#button.setAttribute("aria-expanded", "false");
  }

  toggle() {
    if (this.#isOpen) this.close();
    else this.open();
  }

  hide() {
    if (this.#disposed) return;
    this.close();
    this.isActive = false;
    this.#root.hidden = true;
  }

  dispose() {
    if (this.#disposed) return;
    this.close();
    this.#disposed = true;
    this.isActive = false;
    this.onChange = null;
    this.#unsubscribe?.();
    this.#removeShield?.();
    for (const [node, type, listener, options] of this.#bindings) node.removeEventListener(type, listener, options);
    this.#bindings.length = 0;
    this.#document.removeEventListener("pointerdown", this.#onDocumentPointerDown, true);
    this.#document.removeEventListener("keydown", this.#onDocumentKeyDown);
    this.#root.remove();
  }

  #build() {
    const doc = this.#document;
    const element = (tag, className) => {
      const node = doc.createElement(tag);
      node.className = className;
      return node;
    };
    this.#root = element("div", "depth-selector game-toolbar-frame");
    this.#root.hidden = true;

    this.#button = element("button", "depth-selector__float");
    this.#button.type = "button";
    this.#button.setAttribute("aria-expanded", "false");
    this.#button.setAttribute("aria-label", this.#labels.depthToggle);
    this.#icon = element("span", "depth-selector__icon");
    this.#buttonValue = element("span", "depth-selector__value");
    this.#button.appendChild(this.#icon);
    this.#button.appendChild(this.#buttonValue);

    this.#panel = element("div", "depth-selector__panel");
    this.#panel.hidden = true;
    this.#panel.inert = true;
    this.#track = element("div", "depth-selector__track");
    this.#track.tabIndex = -1;
    this.#track.setAttribute("role", "slider");
    this.#track.setAttribute("aria-orientation", "horizontal");
    this.#track.setAttribute("aria-label", this.#labels.depthTrack);
    this.#line = element("div", "depth-selector__line");
    this.#marker = element("div", "depth-selector__marker");
    this.#markerValue = element("span", "depth-selector__marker-value");
    this.#marker.appendChild(this.#markerValue);
    this.#minLabel = element("span", "depth-selector__limit depth-selector__limit--min");
    this.#maxLabel = element("span", "depth-selector__limit depth-selector__limit--max");
    this.#track.appendChild(this.#line);
    this.#track.appendChild(this.#marker);
    this.#panel.appendChild(this.#minLabel);
    this.#panel.appendChild(this.#track);
    this.#panel.appendChild(this.#maxLabel);

    this.#root.appendChild(this.#button);
    this.#root.appendChild(this.#panel);
    this.#removeShield = UiEventShield.blockEvents(this.#root);
    this.#mount.appendChild(this.#root);
  }

  #bindEvents() {
    this.#listen(this.#button, "click", () => {
      if (!this.#disposed) this.toggle();
    });
    this.#listen(this.#track, "pointerdown", (event) => {
      if (this.#disposed || !this.#isOpen || event.button > 0 || event.isPrimary === false || this.#dragPointerId !== null) return;
      // Cache coordinates only after the container stops moving. Reduced motion
      // has no running width transition and stays immediately interactive.
      if (this.#root.getAnimations?.().some(animation => animation.transitionProperty === "width" && animation.playState === "running")) return;
      this.#dragPointerId = event.pointerId;
      this.#dragRect = this.#track.getBoundingClientRect();
      this.#track.setPointerCapture?.(event.pointerId);
      this.#selectAt(event.clientX);
      event.preventDefault?.();
    });
    this.#listen(this.#track, "pointermove", (event) => {
      if (this.#disposed || event.pointerId !== this.#dragPointerId) return;
      this.#selectAt(event.clientX);
    });
    const endDrag = (event) => {
      if (event.pointerId !== this.#dragPointerId) return;
      this.#endDrag();
    };
    this.#listen(this.#track, "pointerup", endDrag);
    this.#listen(this.#track, "pointercancel", endDrag);
    this.#listen(this.#track, "lostpointercapture", endDrag);
    this.#listen(this.#root, "keydown", event => {
      event.stopPropagation();
      if (event.key === "Escape") this.close();
    });
    this.#listen(this.#root, "keyup", event => event.stopPropagation());
    this.#listen(this.#root, "wheel", (event) => {
      if (this.#disposed || !this.#isOpen) return;
      event.preventDefault?.();
      this.#select(this.#value + (event.deltaY > 0 ? DEPTH_STEP_METERS : -DEPTH_STEP_METERS));
    }, { passive: false });
    this.#listen(this.#track, "keydown", (event) => {
      if (this.#disposed || !this.#isOpen) return;
      const delta = {
        ArrowRight: DEPTH_STEP_METERS,
        ArrowLeft: -DEPTH_STEP_METERS,
        ArrowDown: DEPTH_STEP_METERS,
        ArrowUp: -DEPTH_STEP_METERS,
        PageDown: DEPTH_PAGE_METERS,
        PageUp: -DEPTH_PAGE_METERS,
      }[event.key];
      if (delta !== undefined) this.#select(this.#value + delta);
      else if (event.key === "Home") this.#select(this.#minDepth);
      else if (event.key === "End") this.#select(this.#maxDepth);
      else return;
      event.preventDefault?.();
    });
    this.#document.addEventListener("pointerdown", this.#onDocumentPointerDown, true);
    this.#document.addEventListener("keydown", this.#onDocumentKeyDown);
    this.#listen(this.#document, "config-updated", () => this.close());
    this.#listen(this.#document.defaultView, "blur", () => this.close());
    this.#listen(this.#document.defaultView, "resize", () => this.close());
  }

  #listen(node, type, listener, options) {
    if (!node?.addEventListener) return;
    node.addEventListener(type, listener, options);
    this.#bindings.push([node, type, listener, options]);
  }

  #endDrag() {
    const pointerId = this.#dragPointerId;
    this.#dragPointerId = null;
    this.#dragRect = null;
    if (pointerId !== null && this.#track.hasPointerCapture?.(pointerId)) this.#track.releasePointerCapture(pointerId);
  }

  // A press outside the control closes the open track; on the game canvas the press is consumed so it starts no cast.
  #closeOnOutsidePress(event) {
    if (!this.#isOpen || this.#root.contains?.(event.target)) return;
    this.close();
    if (event.target?.tagName === "CANVAS") {
      event.stopPropagation();
      event.preventDefault?.();
    }
  }

  #selectAt(clientX) {
    const rect = this.#dragRect;
    const ratio = rect?.width > 0 ? (clientX - rect.left) / rect.width : 0;
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    this.#select(this.#minDepth + clampedRatio * (this.#maxDepth - this.#minDepth));
  }

  #select(depth) {
    const next = this.#clamp(depth);
    if (next === this.#value) return;
    this.#value = next;
    this.#render();
    this.onChange?.(next);
  }

  #setRange(maxDepth) {
    this.#maxDepth = Math.max(this.#minDepth, Number(maxDepth) || this.#minDepth);
    this.#minLabel.textContent = this.#labels.depthValue(this.#minDepth.toFixed(1));
    this.#maxLabel.textContent = this.#labels.depthValue(this.#maxDepth.toFixed(1));
    this.#track.setAttribute("aria-valuemin", this.#minDepth.toFixed(1));
    this.#track.setAttribute("aria-valuemax", this.#maxDepth.toFixed(1));
  }

  // Depth on the 0.1 m grid inside the current range.
  #clamp(depth) {
    const value = Number(depth);
    const bounded = Math.max(this.#minDepth, Math.min(this.#maxDepth, Number.isFinite(value) ? value : this.#minDepth));
    return Math.round(bounded / DEPTH_STEP_METERS) / Math.round(1 / DEPTH_STEP_METERS);
  }

  #render() {
    const text = this.#labels.depthValue(this.#value.toFixed(1));
    const range = this.#maxDepth - this.#minDepth;
    const percent = range > 0 ? ((this.#value - this.#minDepth) / range) * 100 : 0;
    this.#buttonValue.textContent = text;
    this.#markerValue.textContent = text;
    this.#root.style.setProperty("--depth-ratio", `${percent.toFixed(2)}%`);
    this.#track.setAttribute("aria-valuenow", this.#value.toFixed(1));
    this.#track.setAttribute("aria-valuetext", text);
  }
}
