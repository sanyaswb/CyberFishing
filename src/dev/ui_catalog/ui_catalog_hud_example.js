export class UiCatalogHudExample {
  #depth;
  #renderer;
  #canvas;
  #surface;
  #status;
  #charges;
  #chum;
  #clock;
  #gameControls;
  #toolbar;
  #frameScheduler;
  #documentScope;
  #state = "normal";
  #value = 67;
  #setClockState;
  constructor({ depthSelector, holdCharges, chumControls, timeDisplay, gameControls, toolbar = null, frameScheduler, documentScope, canvas, statusBarsRenderer, surface, status, setClockState = null }) {
    this.#depth = depthSelector; this.#canvas = canvas; this.#renderer = statusBarsRenderer;
    this.#surface = surface; this.#status = status;
    this.#charges = holdCharges; this.#chum = chumControls; this.#clock = timeDisplay;
    this.#gameControls = gameControls; this.#frameScheduler = frameScheduler; this.#documentScope = documentScope;
    this.#toolbar = toolbar;
    this.#setClockState = setClockState;
    holdCharges.container.classList.add("ui-catalog-preview__charges");
    timeDisplay.container.classList.add("ui-catalog-preview__clock");
    for (const node of surface.mountRoot.querySelectorAll(".game-control")) node.classList.add("ui-catalog-preview__toolbar");
    const fullscreen = surface.mountRoot.querySelector(".game-control--fullscreen");
    fullscreen?.classList.add("ui-catalog-preview__fullscreen");
  }
  setState(state) {
    this.#state = state;
    this.#setClockState?.(state);
    if (state === "hidden") this.#depth.hide();
    else {
      this.#depth.show(5, 2.5, (depth) => { this.#status.textContent = `Контрольна глибина: ${depth.toFixed(1)} м`; });
      if (state === "open") this.#depth.open(); else this.#depth.close();
    }
    const hidden = state === "hidden";
    this.#clock.container.hidden = hidden;
    this.#clock.update(state === "dawn" ? 6 : state === "evening" ? 18 : state === "night" || state === "active" ? 22 : 12);
    this.#chum.setState(["disabled", "empty", "aiming", "moving"].includes(state) ? state : "ready", state === "boat" || state === "moving" ? "boat" : "hand", 12, true, !hidden);
    this.#gameControls.updateNetButtonState(!hidden, state === "active");
    this.#gameControls.updateContinueButtonState(state === "boundary");
    this.#frameScheduler.flush();
    this.#draw();
  }
  setValue(value) { this.#value = value; this.#draw(); }
  resize() { this.#draw(); }
  dispose() {
    this.#depth.dispose(); this.#charges.dispose(); this.#chum.dispose(); this.#clock.dispose();
    this.#gameControls.dispose(); this.#toolbar?.dispose(); this.#frameScheduler.dispose(); this.#documentScope.dispose(); this.#canvas.remove();
  }
  #draw() {
    const context = this.#canvas.getContext("2d");
    context.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    const ratio = this.#state === "boundary" ? 1 : Math.max(0, Math.min(1, this.#value / 100));
    const emptyCharges = this.#state === "charges-empty";
    this.#charges.update({ hasHold: this.#state !== "hidden", max: 3,
      current: emptyCharges ? 0 : this.#state === "active" ? 1 : 2, isActive: this.#state === "active",
      restoring: emptyCharges ? [] : [1000 * (1 - ratio)], restoreMaxTime: 1000 });
    this.#renderer.render({ visible: this.#state !== "hidden", viewportWidth: this.#canvas.width,
      fishCondition: { visible: true, staminaRatio: ratio, staminaValue: `${Math.round(ratio * 100)}%`, exhaustionRatio: 1 - ratio,
        exhaustionValue: `${Math.round((1 - ratio) * 100)}%`, phase: this.#state === "active" ? "exhaustion" : "stamina" },
      rodControl: { visible: true, active: this.#state === "active", ratio, value: `${Math.round(ratio * 100)}%` },
      rodStroke: { visible: true, ratio: .5, value: "50%" },
      tension: { visible: true, ratio, value: `${Math.round(ratio * 100)}%`, pulse: 0, dragMarkerVisible: true, dragMarkerRatio: .67 },
      tackleStress: { visible: true, ratio: .34, label: "TACKLE STRESS", value: "34%" } });
    this.#canvas.setAttribute("aria-label", `HUD: натяг ${Math.round(ratio * 100)}%, контроль ${Math.round(ratio * 100)}%, хід вудилища 50%, навантаження 34%`);
    this.#status.textContent = "Натяг читає реальний HUD gradient. Відкрийте глибину, використайте Arrow/Home/End, wheel або перетягування маркера.";
  }
}
