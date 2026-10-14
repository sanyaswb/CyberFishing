import { UiEventShield } from "../dom/ui_event_shield.js";

const DEPTH_STEP_METERS = 0.1;
const DEPTH_PAGE_METERS = 1;

// Depth control of a float or jig rig: a tackle button that shows the selected depth and, when pressed, slides out a
// vertical depth track below it (surface at the top, the deepest reachable depth at the bottom). The track follows
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
  #onDocumentPointerDown = (event) => this.#closeOnOutsidePress(event);
  #onDocumentKeyDown = (event) => {
    if (this.#isOpen && event.key === "Escape") this.close();
  };

  constructor({ labels, documentRef = document, mountNode = documentRef.body } = {}) {
    this.#labels = labels;
    this.#document = documentRef;
    this.#mount = mountNode;
    this.onChange = null;
    this.isActive = false;
    this.#build();
    this.#bindEvents();
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
    this.#root.style.display = "block";
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

  // The tackle icon on the button (the equipped float or jig); an image can replace the emoji later.
  setIcon(icon) {
    if (this.#disposed) return;
    const text = icon || "";
    if (text === this.#iconText) return;
    this.#iconText = text;
    this.#icon.textContent = text;
  }

  open() {
    if (this.#disposed || !this.isActive || this.#isOpen) return;
    this.#isOpen = true;
    this.#root.classList.add("depth-selector--open");
    this.#button.setAttribute("aria-expanded", "true");
  }

  close() {
    if (this.#disposed || !this.#isOpen) return;
    this.#isOpen = false;
    this.#dragPointerId = null;
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
    this.#root.style.display = "none";
  }

  dispose() {
    if (this.#disposed) return;
    this.close();
    this.#disposed = true;
    this.isActive = false;
    this.onChange = null;
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
    this.#root = element("div", "depth-selector");
    this.#root.style.display = "none";

    this.#button = element("button", "depth-selector__float");
    this.#button.type = "button";
    this.#button.setAttribute("aria-expanded", "false");
    this.#button.setAttribute("aria-label", this.#labels.depthToggle);
    this.#icon = element("span", "depth-selector__icon");
    this.#buttonValue = element("span", "depth-selector__value");
    this.#button.appendChild(this.#icon);
    this.#button.appendChild(this.#buttonValue);

    this.#panel = element("div", "depth-selector__panel");
    this.#track = element("div", "depth-selector__track");
    this.#track.tabIndex = 0;
    this.#track.setAttribute("role", "slider");
    this.#track.setAttribute("aria-orientation", "vertical");
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
    UiEventShield.makeSolid(this.#root);
    this.#mount.appendChild(this.#root);
  }

  #bindEvents() {
    this.#button.addEventListener("click", () => {
      if (!this.#disposed) this.toggle();
    });
    this.#track.addEventListener("pointerdown", (event) => {
      if (this.#disposed || !this.#isOpen || event.button > 0) return;
      this.#dragPointerId = event.pointerId;
      this.#track.setPointerCapture?.(event.pointerId);
      this.#selectAt(event.clientY);
      event.preventDefault?.();
    });
    this.#track.addEventListener("pointermove", (event) => {
      if (this.#disposed || event.pointerId !== this.#dragPointerId) return;
      this.#selectAt(event.clientY);
    });
    const endDrag = (event) => {
      if (event.pointerId !== this.#dragPointerId) return;
      this.#dragPointerId = null;
      this.#track.releasePointerCapture?.(event.pointerId);
    };
    this.#track.addEventListener("pointerup", endDrag);
    this.#track.addEventListener("pointercancel", endDrag);
    this.#root.addEventListener("wheel", (event) => {
      if (this.#disposed || !this.#isOpen) return;
      event.preventDefault?.();
      this.#select(this.#value + (event.deltaY > 0 ? DEPTH_STEP_METERS : -DEPTH_STEP_METERS));
    }, { passive: false });
    this.#track.addEventListener("keydown", (event) => {
      if (this.#disposed || !this.#isOpen) return;
      const delta = {
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

  #selectAt(clientY) {
    const rect = this.#track.getBoundingClientRect();
    const ratio = rect.height > 0 ? (clientY - rect.top) / rect.height : 0;
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
