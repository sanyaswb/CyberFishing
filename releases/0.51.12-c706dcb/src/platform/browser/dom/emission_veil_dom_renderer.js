// Spec 179 stage E (TK-324): the emission's veil — one DOM element whose backdrop-filter blurs and whose radial gradient
// darkens what is under it, in one compositor pass (docs/rendering.md: no per-frame textures or filters of our own).
// - includeHud (owner, Q6): the veil sits in the UI surface between its content (HUD, toolbar, windows) and its
//   portals (DevTools), so everything but DevTools is blurred; off, it sits right above the WebGL scene and under the
//   2D HUD canvas, so only the world is.
// - Written only on change beyond what can be seen (a quarter pixel of blur, half an 8-bit step of darkness, a quarter
//   percent of radius); hidden (display: none, no backdrop-filter) while the emission does not reach the player.
const BLUR_EPSILON = 0.25;
const DARK_EPSILON = 1 / 510;
const RADIUS_EPSILON = 0.0025;

export class EmissionVeilDomRenderer {
  #documentRef;
  #portalRoot;
  #gameCanvas;
  #element;
  #applied = { visible: false, includeHud: null, darkness: -1, clearRadius: -1, feather: -1, blurPx: -1 };

  // portalRoot: the UI surface's portal root (DevTools lives there; the veil goes right before it); gameCanvas: the 2D
  // HUD canvas (the scene canvas sits right before it).
  constructor({ documentRef, portalRoot, gameCanvas }) {
    if (typeof documentRef?.createElement !== "function") throw new TypeError("EmissionVeilDomRenderer requires documentRef");
    if (typeof portalRoot?.before !== "function") throw new TypeError("EmissionVeilDomRenderer requires portalRoot");
    if (typeof gameCanvas?.before !== "function") throw new TypeError("EmissionVeilDomRenderer requires gameCanvas");
    this.#documentRef = documentRef;
    this.#portalRoot = portalRoot;
    this.#gameCanvas = gameCanvas;
    this.#element = documentRef.createElement("div");
    this.#element.className = "emission-veil";
    this.#element.setAttribute("aria-hidden", "true");
  }

  // record: EmissionScreenEffect.record ({ visible, includeHud, darkness, clearRadius, feather, blurPx }).
  apply(record) {
    const applied = this.#applied;
    const element = this.#element;
    if (!record?.visible) {
      if (applied.visible) {
        applied.visible = false;
        element.classList.remove("emission-veil--visible");
        element.style.backdropFilter = "none";
        element.style.webkitBackdropFilter = "none";
        applied.blurPx = -1;
      }
      return;
    }
    if (applied.includeHud !== record.includeHud || !element.isConnected) this.#place(record.includeHud);
    if (!applied.visible) {
      applied.visible = true;
      element.classList.add("emission-veil--visible");
    }
    if (Math.abs(applied.darkness - record.darkness) >= DARK_EPSILON) {
      applied.darkness = record.darkness;
      element.style.setProperty("--emission-veil-darkness", record.darkness.toFixed(3));
    }
    if (Math.abs(applied.clearRadius - record.clearRadius) >= RADIUS_EPSILON ||
      Math.abs(applied.feather - record.feather) >= RADIUS_EPSILON) {
      applied.clearRadius = record.clearRadius;
      applied.feather = record.feather;
      element.style.setProperty("--emission-veil-clear", `${(record.clearRadius * 100).toFixed(2)}%`);
      element.style.setProperty("--emission-veil-feather", `${(record.feather * 100).toFixed(2)}%`);
    }
    if (Math.abs(applied.blurPx - record.blurPx) >= BLUR_EPSILON) {
      applied.blurPx = record.blurPx;
      const filter = record.blurPx >= BLUR_EPSILON ? `blur(${record.blurPx.toFixed(2)}px)` : "none";
      element.style.backdropFilter = filter;
      element.style.webkitBackdropFilter = filter;
    }
  }

  dispose() {
    this.#element.remove();
  }

  #place(includeHud) {
    this.#applied.includeHud = includeHud;
    this.#element.classList.toggle("emission-veil--scene", !includeHud);
    if (includeHud) {
      this.#portalRoot.before(this.#element);
      return;
    }
    const scene = this.#documentRef.querySelector?.(".game-shell__scene") ?? null;
    if (scene) scene.after(this.#element);
    else this.#gameCanvas.before(this.#element);
  }
}
