import { UiEventShield } from "../dom/ui_event_shield.js";

export class GameControls {
  #fullscreenBtn;
  #netBtn;
  #isNetReady = false;
  onNetClick;
  #continueBtn;
  onContinueClick;
  #lifecycle;
  #labels;
  #logger;
  #onFullscreenChange = () => {
    if (!this.#fullscreenBtn) return;
    const active = Boolean(document.fullscreenElement);
    this.#fullscreenBtn.classList.toggle("game-control--fullscreen-hidden", active);
    this.#fullscreenBtn.disabled = active;
    this.#fullscreenBtn.setAttribute("aria-hidden", String(active));
  };

  constructor(config, lifecycle, { labels, logger } = {}) {
    this.#labels = labels;
    this.#logger = logger;
    if (lifecycle != null && typeof lifecycle.dispose !== "function") {
      throw new TypeError("GameControls requires devTools");
    }
    this.#initFullscreenBtn();
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

  #initFullscreenBtn() {
    this.#fullscreenBtn = document.createElement("button");
    this.#fullscreenBtn.className = "game-control game-control--fullscreen";
    this.#fullscreenBtn.type = "button";
    this.#fullscreenBtn.innerHTML = "⛶";
    this.#fullscreenBtn.setAttribute("aria-label", this.#labels.fullscreen);
    this.#fullscreenBtn.title = this.#labels.fullscreen;
    this.#fullscreenBtn.hidden = typeof document.documentElement.requestFullscreen !== "function";
    UiEventShield.makeSolid(this.#fullscreenBtn);
    this.#fullscreenBtn.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          this.#logger?.warn(
            `Error attempting to enable full-screen mode: ${err.message}`,
          );
        });
      }
    });

    document.addEventListener(
      "fullscreenchange",
      this.#onFullscreenChange,
    );

    document.body.appendChild(this.#fullscreenBtn);
    this.#onFullscreenChange();
  }

  #initNetBtn() {
    this.#netBtn = document.createElement("button");
    this.#netBtn.className = "game-control game-control--net game-toolbar-button game-toolbar-button--net";
    this.#netBtn.type = "button";
    this.#netBtn.innerHTML = "🕸️";
    this.#netBtn.setAttribute("aria-label", this.#labels.landingNet);
    this.#netBtn.title = this.#labels.landingNet;
    UiEventShield.makeSolid(this.#netBtn);
    this.#netBtn.addEventListener("click", () => {
      if (this.#isNetReady) this.onNetClick?.();
    });

    document.body.appendChild(this.#netBtn);
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
      requestAnimationFrame(() => {
        this.#netBtn?.classList.add("game-control--net-entered");
      });
    }
  }

  #initContinueBtn() {
    this.#continueBtn = document.createElement("button");
    this.#continueBtn.className = "game-control game-control--continue";
    this.#continueBtn.innerHTML = this.#labels.continueAfterOutcome;

    UiEventShield.makeSolid(this.#continueBtn);

    this.#continueBtn.addEventListener("click", () => {
      if (this.onContinueClick) this.onContinueClick();
    });

    document.body.appendChild(this.#continueBtn);
  }

  updateContinueButtonState(isVisible) {
    if (!this.#continueBtn) return;
    this.#continueBtn.classList.toggle("game-control--continue-visible", isVisible);
  }

  // Scouting pointer feedback: dims the page while the pointer is held, flashes the release class for one frame.
  setScoutingPointerDimmed(isDimmed) {
    document.body.classList.toggle("game-shell--pointer-hold", isDimmed);

    if (isDimmed) {
      document.body.classList.remove("game-shell--pointer-release");
      return;
    }

    document.body.classList.add("game-shell--pointer-release");
    requestAnimationFrame(() => {
      document.body.classList.remove("game-shell--pointer-release");
    });
  }

  setOutcomeOverlayActive(isActive) {
    document.body?.classList.toggle(
      "game-shell--outcome-active",
      isActive === true,
    );
  }

  dispose() {
    this.setOutcomeOverlayActive(false);
    document.removeEventListener(
      "fullscreenchange",
      this.#onFullscreenChange,
    );
    this.#lifecycle?.dispose?.();
    this.#lifecycle = null;
    this.#fullscreenBtn?.remove();
    this.#netBtn?.remove();
    this.#continueBtn?.remove();
    this.#fullscreenBtn = null;
    this.#netBtn = null;
    this.#continueBtn = null;
    this.onNetClick = null;
    this.onContinueClick = null;
  }
}

