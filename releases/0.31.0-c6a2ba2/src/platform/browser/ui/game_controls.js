import { DraggableButton } from "../dom/draggable_button.js";
import { UiEventShield } from "../dom/ui_event_shield.js";

export class GameControls {
  #config;
  #cache;
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
    this.#fullscreenBtn.innerHTML = document.fullscreenElement ? "🗗" : "⛶";
  };

  constructor(config, lifecycle, { cache, labels, logger } = {}) {
    this.#cache = cache;
    this.#labels = labels;
    this.#logger = logger;
    if (lifecycle != null && typeof lifecycle.dispose !== "function") {
      throw new TypeError("GameControls requires devTools");
    }
    this.#config = config;
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
    this.#fullscreenBtn.innerHTML = "⛶";

    new DraggableButton(
      this.#fullscreenBtn,
      () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch((err) => {
            this.#logger.warn(
              `Error attempting to enable full-screen mode: ${err.message}`,
            );
          });
        } else {
          document.exitFullscreen();
        }
      },
      this.#config,
      { id: "btn_fullscreen", cache: this.#cache },
    );

    document.addEventListener(
      "fullscreenchange",
      this.#onFullscreenChange,
    );

    document.body.appendChild(this.#fullscreenBtn);
  }

  #initNetBtn() {
    this.#netBtn = document.createElement("button");
    this.#netBtn.className = "game-control game-control--net";
    this.#netBtn.innerHTML = "🕸️";

    new DraggableButton(
      this.#netBtn,
      () => {
        if (this.#isNetReady && this.onNetClick) {
          this.onNetClick();
        }
      },
      this.#config,
      { id: "btn_net", cache: this.#cache },
    );

    document.body.appendChild(this.#netBtn);
  }

  updateNetButtonState(hasNet, isReady) {
    if (!this.#netBtn) return;

    this.#isNetReady = isReady;

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

