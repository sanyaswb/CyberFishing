import { UiEventShield } from "../dom/ui_event_shield.js";

export class GameControls {
  #fullscreenControl;
  #netBtn;
  #isNetReady = false;
  onNetClick;
  #continueBtn;
  onContinueClick;
  #lifecycle;
  #labels;
  #mount;
  #toolbarMount;
  #document;
  #frameScheduler;
  #pendingFrames = new Set();

  constructor(config, lifecycle, { labels, documentRef = document,
    mountNode = documentRef.body, toolbarMountNode = mountNode, frameScheduler = null, fullscreenControl = null } = {}) {
    this.#labels = labels;
    this.#mount = mountNode;
    this.#toolbarMount = toolbarMountNode;
    this.#document = documentRef;
    this.#frameScheduler = frameScheduler;
    this.#fullscreenControl = fullscreenControl;
    if (lifecycle != null && typeof lifecycle.dispose !== "function") {
      throw new TypeError("GameControls requires devTools");
    }
    this.#initNetBtn();
    this.#initContinueBtn();

    this.#lifecycle = lifecycle;
  }

  hideNetButton() {
    if (this.#netBtn) {
      this.#netBtn.classList.remove("game-control--net-visible");
      // Reset the state so the entrance animation can run again.
      this.#netBtn.classList.remove("game-control--net-entered");
    }
  }

  #initNetBtn() {
    this.#netBtn = this.#document.createElement("button");
    this.#netBtn.className = "game-control game-control--net game-toolbar-button game-toolbar-button--net";
    this.#netBtn.type = "button";
    this.#netBtn.innerHTML = "🕸️";
    this.#netBtn.setAttribute("aria-label", this.#labels.landingNet);
    this.#netBtn.title = this.#labels.landingNet;
    UiEventShield.makeSolid(this.#netBtn);
    this.#netBtn.addEventListener("click", () => {
      if (this.#isNetReady) this.onNetClick?.();
    });

    this.#toolbarMount.appendChild(this.#netBtn);
  }

  updateNetButtonState(hasNet, isReady) {
    if (!this.#netBtn) return;

    this.#isNetReady = isReady;
    this.#netBtn.setAttribute("aria-disabled", String(!isReady));

    if (!hasNet) {
      this.hideNetButton();
      return;
    }

    const isAppearing = !this.#netBtn.classList.contains("game-control--net-visible");
    this.#netBtn.classList.add("game-control--net-visible");
    this.#netBtn.classList.toggle("game-control--net-ready", isReady);
    this.#netBtn.classList.toggle("game-control--net-unready", !isReady);
    if (isAppearing) {
      this.#netBtn.classList.remove("game-control--net-entered");
      this.#scheduleFrame(() => {
        this.#netBtn?.classList.add("game-control--net-entered");
      });
    }
  }

  #initContinueBtn() {
    this.#continueBtn = this.#document.createElement("button");
    this.#continueBtn.className = "game-control game-control--continue";
    this.#continueBtn.innerHTML = this.#labels.continueAfterOutcome;

    UiEventShield.makeSolid(this.#continueBtn);

    this.#continueBtn.addEventListener("click", () => {
      if (this.onContinueClick) this.onContinueClick();
    });

    this.#mount.appendChild(this.#continueBtn);
  }

  updateContinueButtonState(isVisible) {
    if (!this.#continueBtn) return;
    this.#continueBtn.classList.toggle("game-control--continue-visible", isVisible);
  }

  // Scouting pointer feedback: dims the page while the pointer is held, flashes the release class for one frame.
  setScoutingPointerDimmed(isDimmed) {
    this.#document.body.classList.toggle("game-shell--pointer-hold", isDimmed);

    if (isDimmed) {
      this.#document.body.classList.remove("game-shell--pointer-release");
      return;
    }

    this.#document.body.classList.add("game-shell--pointer-release");
    this.#scheduleFrame(() => {
      this.#document.body.classList.remove("game-shell--pointer-release");
    });
  }

  setOutcomeOverlayActive(isActive) {
    this.#document.body?.classList.toggle(
      "game-shell--outcome-active",
      isActive === true,
    );
    if (this.#mount !== this.#document.body) this.#mount.inert = isActive === true;
  }

  dispose() {
    this.setOutcomeOverlayActive(false);
    this.#fullscreenControl?.dispose();
    this.#fullscreenControl = null;
    this.#lifecycle?.dispose?.();
    this.#lifecycle = null;
    this.#netBtn?.remove();
    this.#continueBtn?.remove();
    this.#netBtn = null;
    this.#continueBtn = null;
    this.onNetClick = null;
    this.onContinueClick = null;
    for (const id of this.#pendingFrames) {
      if (this.#frameScheduler) this.#frameScheduler.cancelAnimationFrame(id);
      else if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
    }
    this.#pendingFrames.clear();
  }

  #scheduleFrame(callback) {
    let id;
    const run = () => { this.#pendingFrames.delete(id); callback(); };
    id = this.#frameScheduler ? this.#frameScheduler.requestAnimationFrame(run) : requestAnimationFrame(run);
    this.#pendingFrames.add(id);
  }
}

