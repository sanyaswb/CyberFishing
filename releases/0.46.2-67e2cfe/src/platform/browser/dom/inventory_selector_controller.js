// Owns browser input and its lifetime; the view owns expansion/candidate presentation.
export class InventorySelectorController {
  #view;
  #surface;
  #window;
  #document;
  #select;
  #bindings = [];
  #unsubscribe;
  #active = null;
  #mode = null;
  #frame = null;
  #readyAt = Infinity;
  #hoverBlocked = false;
  #suppressClick = false;
  #disposed = false;
  #motionQuery;
  #observer;
  #motions;
  #offsets;
  #motionDuration = 0;
  #motionEasing = "ease";

  constructor({ view, uiSurface, documentRef, windowRef, onSelect }) {
    this.#view = view; this.#surface = uiSurface; this.#window = windowRef;
    this.#document = documentRef; this.#select = onSelect;
    this.#motions = view.buttons.map(() => ({ animation: null, from: 0, to: 0 }));
    this.#offsets = view.buttons.map(() => 0);
    this.#motionQuery = windowRef.matchMedia?.("(prefers-reduced-motion: reduce)");
    const root = view.element;
    this.#listen(view.central, "pointerenter", this.#enter);
    this.#listen(root, "pointerleave", this.#leave);
    this.#listen(root, "pointerdown", this.#down);
    this.#listen(root, "pointermove", this.#move);
    this.#listen(root, "pointerup", this.#up);
    this.#listen(root, "pointercancel", this.#pointerCancel);
    this.#listen(root, "lostpointercapture", this.#lost);
    this.#listen(root, "click", this.#click);
    this.#listen(root, "keydown", this.#key);
    this.#listen(root, "keyup", this.#stop);
    this.#listen(root, "focusout", this.#focusOut);
    for (const type of ["mousedown", "mouseup", "touchstart", "touchmove", "touchend", "wheel", "dblclick"]) this.#listen(root, type, this.#stop);
    for (const type of ["contextmenu", "dragstart"]) this.#listen(root, type, this.#prevent);
    this.#listen(documentRef, "pointerdown", this.#outside, true);
    this.#listen(documentRef, "focusin", this.#outside);
    this.#listen(root, "focusin", this.#focusIn);
    this.#listen(documentRef, "visibilitychange", this.#visibility);
    this.#listen(windowRef, "blur", this.#cancel);
    this.#listen(windowRef, "pagehide", this.#cancel);
    this.#listen(this.#motionQuery, "change", this.#cancel);
    this.#unsubscribe = uiSurface?.subscribe(this.#cancel);
    // Only while expanded, observe the small ancestor chain for screen/modal
    // hiding and inertness. Never observe the inventory subtree or every frame.
    if (typeof windowRef.MutationObserver === "function") this.#observer = new windowRef.MutationObserver(this.#ancestorChanged);
  }

  setEnabled(enabled) { this.cancel(); this.#hoverBlocked = false; this.#view.setEnabled(enabled); }

  openKeyboard() {
    if (!this.#open("keyboard")) return;
    this.#view.buttons[0].focus();
  }

  // Browser-native animation timing supplies the exact visible translation to
  // hit testing. No animation loop or per-move layout/style measurement.
  highlight(index) {
    if (!this.#view.expanded) return;
    this.#readOffsets();
    this.#view.highlight(index);
    this.#motions.forEach((motion, i) => {
      const to = i === index ? 1 : 0;
      if (motion.to === to) return;
      const from = this.#offsets[i];
      motion.animation?.cancel();
      motion.from = from; motion.to = to;
      motion.animation = from !== to && this.#motionDuration > 0 && typeof this.#view.buttons[i].animate === "function"
        ? this.#view.buttons[i].animate([
          { translate: this.#view.motionTranslation(i, from) },
          { translate: this.#view.motionTranslation(i, to) },
        ], { duration: this.#motionDuration, easing: this.#motionEasing, fill: "none" }) : null;
    });
  }

  #readOffsets() {
    this.#motions.forEach((motion, i) => {
      const progress = motion.animation?.effect?.getComputedTiming().progress;
      this.#offsets[i] = !motion.animation || motion.animation.playState === "finished" ? motion.to
        : progress == null ? motion.from : motion.from + (motion.to - motion.from) * progress;
    });
    return this.#offsets;
  }

  cancel({ returnFocus = false } = {}) {
    const expanded = this.#view.expanded;
    const active = this.#active;
    this.#active = null;
    if (active !== null && this.#view.central.hasPointerCapture?.(active)) this.#view.central.releasePointerCapture(active);
    this.#observer?.disconnect();
    for (const motion of this.#motions) {
      motion.animation?.cancel(); motion.animation = null; motion.from = 0; motion.to = 0;
    }
    this.#offsets.fill(0);
    this.#view.setExpanded(false);
    this.#mode = null; this.#frame = null; this.#readyAt = Infinity;
    if (expanded && returnFocus && this.#view.enabled) this.#view.central.focus();
  }

  dispose() {
    if (this.#disposed) return;
    this.cancel(); this.#disposed = true;
    this.#unsubscribe?.();
    for (const [node, type, listener, options] of this.#bindings) node.removeEventListener(type, listener, options);
    this.#bindings.length = 0;
    this.#observer?.disconnect();
  }

  #listen(node, type, listener, options) {
    if (!node?.addEventListener) return;
    node.addEventListener(type, listener, options);
    this.#bindings.push([node, type, listener, options]);
  }
  #stop = event => event.stopPropagation();
  #prevent = event => { event.preventDefault(); event.stopPropagation(); };
  #cancel = () => this.cancel();
  #visibility = () => { if (this.#document.visibilityState === "hidden") this.cancel(); };
  #outside = event => { if (!this.#view.element.contains(event.target)) this.cancel(); };
  #focusOut = event => { if (this.#mode === "keyboard" && !this.#view.element.contains(event.relatedTarget)) this.cancel(); };
  #focusIn = event => {
    const index = this.#view.buttons.findIndex(button => button.contains(event.target));
    if (index >= 0) this.highlight(index);
  };
  #pointerCancel = event => { this.#stop(event); if (event.pointerId === this.#active) this.cancel(); };
  #lost = event => {
    if (event.target === this.#view.central && event.pointerId === this.#active) this.cancel();
  };
  #hoverAllowed() { return this.#surface?.getMetrics().hoverEnabled === true; }
  #enter = event => {
    if (event.pointerType === "mouse" && this.#hoverAllowed() && !this.#hoverBlocked && this.#active === null) this.#open("hover");
  };
  #leave = event => {
    if (this.#view.element.contains(event.relatedTarget)) return;
    this.#hoverBlocked = false;
    if (this.#mode === "hover") this.cancel();
  };
  #ancestorChanged = records => {
    if (!this.#view.expanded || !this.#frame) return;
    let changed = false;
    for (const record of records) {
      const node = record.target;
      if (record.oldValue === node.getAttribute(record.attributeName)) continue;
      if (node.hidden || node.inert) { this.cancel(); return; }
      const style = this.#window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") { this.cancel(); return; }
      changed = true;
    }
    if (!changed) return;
    const rect = this.#view.element.getBoundingClientRect();
    const previous = this.#frame.rect;
    if (rect.left !== previous.left || rect.top !== previous.top || rect.width !== previous.width || rect.height !== previous.height) this.cancel();
  };

  #open(mode) {
    if (this.#disposed || !this.#view.enabled) return false;
    if (this.#view.expanded) return true;
    // The root takes its final slot immediately; only the inner stage animates.
    // Cache final open bounds once instead of measuring an in-flight transform.
    this.#view.setExpanded(true);
    const rect = this.#view.element.getBoundingClientRect();
    if (!(rect.width > 0)) { this.#view.setExpanded(false); return false; }
    const origin = this.#point(rect.left + rect.width, rect.top + rect.height);
    const edge = this.#point(rect.left, rect.top);
    this.#frame = { x: origin.x, y: origin.y, unit: origin.x - edge.x, rect };
    this.#mode = mode;
    const style = this.#window.getComputedStyle(this.#view.buttons[0]);
    const durations = (style.transitionDuration || "0s").split(",").map(value => Number.parseFloat(value) * (value.trim().endsWith("ms") ? 1 : 1000));
    const delay = Math.max(0, ...durations);
    const immediate = this.#motionQuery?.matches || this.#view.element.classList.contains("inventory-selector--reduced-motion");
    this.#readyAt = this.#now() + (immediate ? 0 : delay);
    this.#motionDuration = immediate ? 0 : delay;
    this.#motionEasing = style.transitionTimingFunction?.split(",")[0] || "ease";
    for (let node = this.#view.element.parentNode; node?.nodeType === 1; node = node.parentNode) {
      this.#observer?.observe(node, { attributes: true, attributeOldValue: true, attributeFilter: ["hidden", "inert", "class", "style"] });
    }
    return true;
  }

  #now() { return this.#window.performance.now(); }
  #point(x, y) { return this.#surface ? this.#surface.physicalToLogicalPoint({ x, y }) : { x, y }; }
  #position(event) {
    if (!this.#frame) return null;
    const p = this.#point(event.clientX, event.clientY);
    return { x: (p.x - this.#frame.x) / this.#frame.unit, y: (p.y - this.#frame.y) / this.#frame.unit };
  }
  #candidate(event, stableHover = false) {
    if (this.#now() < this.#readyAt) return -1;
    const p = this.#position(event);
    if (!p) return -1;
    const current = this.#view.hitTest(p.x, p.y, this.#readOffsets());
    // Keep the original footprint as a hover anchor while its paint moves out.
    // Release/click still use only the currently visible translated polygons.
    return current >= 0 || !stableHover ? current : this.#view.hitTest(p.x, p.y);
  }
  #down = event => {
    this.#stop(event);
    if (event.button !== 0 || event.isPrimary === false || this.#active !== null) return;
    this.#suppressClick = false;
    if (!this.#view.central.contains(event.target)) return;
    if (event.pointerType === "mouse" && this.#hoverAllowed()) { event.preventDefault(); return; }
    event.preventDefault();
    if (!this.#open("hold")) return;
    this.#mode = "hold";
    this.#active = event.pointerId;
    this.#view.central.setPointerCapture(event.pointerId);
  };
  #move = event => {
    this.#stop(event);
    if (this.#active !== null && event.pointerId !== this.#active) return;
    if (!this.#view.expanded) return;
    if (this.#mode === "hover") {
      const p = this.#position(event);
      if (p && !this.#view.containsRetention(p.x, p.y)) { this.cancel(); return; }
    }
    this.highlight(this.#candidate(event, true));
  };
  #up = event => {
    this.#stop(event);
    if (event.pointerId !== this.#active || this.#active === null) return;
    event.preventDefault();
    const index = this.#candidate(event);
    this.#suppressClick = true;
    this.#choose(index);
  };
  #choose(index) {
    const id = this.#view.sectionId(index);
    this.#hoverBlocked = true;
    this.cancel();
    if (id) this.#select(id);
  }
  #click = event => {
    this.#prevent(event);
    if (this.#suppressClick) { this.#suppressClick = false; return; }
    const keyboard = event.detail === 0;
    if (this.#view.central.contains(event.target)) {
      if (keyboard) this.openKeyboard();
      return;
    }
    if (!this.#view.expanded || this.#now() < this.#readyAt) return;
    const index = keyboard ? this.#view.buttons.findIndex(button => button.contains(event.target)) : this.#candidate(event);
    if (index >= 0 && this.#active === null) this.#choose(index);
  };
  #key = event => {
    this.#stop(event);
    this.#suppressClick = false;
    if (event.key === "Escape") { event.preventDefault(); this.cancel({ returnFocus: true }); return; }
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (event.repeat) return;
    if (this.#view.central.contains(event.target)) this.openKeyboard();
    else if (this.#view.expanded) this.#choose(this.#view.buttons.findIndex(button => button.contains(event.target)));
  };
}
