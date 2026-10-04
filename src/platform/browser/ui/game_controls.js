import { UIDraggableButton } from "../dom/draggable_button.js";
import { UIUtils } from "../dom/ui_event_shield.js";

export class UIManager {
  #config;
  #cache;
  #fullscreenBtn;
  #netBtn;
  #isNetReady = false;
  onNetClick;
  #continueBtn;
  onContinueClick;
  #lifecycle;
  #onFullscreenChange = () => {
    if (!this.#fullscreenBtn) return;
    this.#fullscreenBtn.innerHTML = document.fullscreenElement ? "🗗" : "⛶";
  };

  constructor(config, lifecycle, { cache } = {}) {
    this.#cache = cache;
    if (!lifecycle || typeof lifecycle.dispose !== "function") {
      throw new TypeError("UIManager requires devTools");
    }
    this.#config = config;
    this.#initFullscreenBtn();
    this.#initNetBtn();
    this.#initContinueBtn();

    this.#lifecycle = lifecycle;
  }

  hideNetButton() {
    if (this.#netBtn) {
      this.#netBtn.style.display = "none";
      // Важливо скинути стан, щоб анімація появи спрацювала наступного разу
      this.#netBtn.style.transform = "scale(0)";
    }
  }

  #initFullscreenBtn() {
    this.#fullscreenBtn = document.createElement("button");
    this.#fullscreenBtn.className = "ui-fade-target";
    this.#fullscreenBtn.innerHTML = "⛶";

    Object.assign(this.#fullscreenBtn.style, {
      position: "absolute",
      top: "15px",
      right: "15px",
      padding: "8px 16px",
      backgroundColor: "rgba(15, 23, 30, 0.8)",
      color: "#00ff80",
      border: "1px solid #00ff80",
      borderRadius: "4px",
      fontFamily: "monospace",
      fontWeight: "bold",
      cursor: "pointer",
      zIndex: "9999",
      transition: "all 0.2s ease",
      touchAction: "none",
    });

    this.#fullscreenBtn.addEventListener("mouseenter", () => {
      this.#fullscreenBtn.style.backgroundColor = "rgba(0, 255, 128, 0.2)";
    });

    this.#fullscreenBtn.addEventListener("mouseleave", () => {
      this.#fullscreenBtn.style.backgroundColor = "rgba(15, 23, 30, 0.8)";
    });

    new UIDraggableButton(
      this.#fullscreenBtn,
      () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch((err) => {
            console.warn(
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
    this.#netBtn.className = "ui-fade-target";
    this.#netBtn.innerHTML = "🕸️";

    Object.assign(this.#netBtn.style, {
      position: "absolute",
      bottom: "20px",
      right: "100px",
      padding: "12px",
      borderRadius: "8px",
      fontFamily: "monospace",
      fontWeight: "bold",
      fontSize: "16px",
      zIndex: "9999",
      display: "none",
      touchAction: "none",
      transition: "all 0.2s ease",
      color: "#fff",
      borderWidth: "2px",
      borderStyle: "solid",
    });

    new UIDraggableButton(
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

    const isAppearing =
      this.#netBtn.style.display === "none" ||
      this.#netBtn.style.display === "";

    this.#netBtn.style.display = "flex";
    this.#netBtn.style.justifyContent = "center";
    this.#netBtn.style.alignItems = "center";

    if (isAppearing) {
      this.#netBtn.style.transform = "scale(0)";
      requestAnimationFrame(() => {
        this.#netBtn.style.transition =
          "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), background-color 0.2s, box-shadow 0.2s";
        this.#netBtn.style.transform = "scale(1)";
      });
    }

    if (isReady) {
      this.#netBtn.style.backgroundColor = "rgba(0, 255, 128, 0.7)";
      this.#netBtn.style.borderColor = "#00ff80";
      this.#netBtn.style.cursor = "pointer";
      this.#netBtn.style.boxShadow = "0 0 15px rgba(0, 255, 128, 0.5)";
    } else {
      this.#netBtn.style.backgroundColor = "rgba(128, 128, 128, 0.3)";
      this.#netBtn.style.borderColor = "#aaa";
      this.#netBtn.style.cursor = "not-allowed";
      this.#netBtn.style.boxShadow = "none";
    }
  }

  #initContinueBtn() {
    this.#continueBtn = document.createElement("button");
    this.#continueBtn.className = "ui-fade-target";
    this.#continueBtn.innerHTML = "ПРОДОВЖИТИ";

    Object.assign(this.#continueBtn.style, {
      position: "absolute",
      top: "80%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      padding: "15px 40px",
      borderRadius: "8px",
      fontFamily: "monospace",
      fontWeight: "bold",
      fontSize: "24px",
      zIndex: "9999",
      display: "none",
      backgroundColor: "rgba(0, 204, 255, 0.8)",
      color: "#fff",
      border: "2px solid #00ccff",
      cursor: "pointer",
      boxShadow: "0 0 15px rgba(0, 204, 255, 0.4)",
      transition: "all 0.2s ease",
    });

    this.#continueBtn.addEventListener("mouseenter", () => {
      this.#continueBtn.style.backgroundColor = "rgba(0, 204, 255, 1)";
      this.#continueBtn.style.transform = "translate(-50%, -50%) scale(1.05)";
    });

    this.#continueBtn.addEventListener("mouseleave", () => {
      this.#continueBtn.style.backgroundColor = "rgba(0, 204, 255, 0.8)";
      this.#continueBtn.style.transform = "translate(-50%, -50%) scale(1)";
    });

    UIUtils.makeSolid(this.#continueBtn);

    this.#continueBtn.addEventListener("click", () => {
      if (this.onContinueClick) this.onContinueClick();
    });

    document.body.appendChild(this.#continueBtn);
  }

  updateContinueButtonState(isVisible) {
    if (!this.#continueBtn) return;
    this.#continueBtn.style.display = isVisible ? "block" : "none";
  }

  // Scouting pointer feedback: dims the page while the pointer is held, flashes the release class for one frame.
  setScoutingPointerDimmed(isDimmed) {
    document.body.classList.toggle("scouting-pointer-hold", isDimmed);

    if (isDimmed) {
      document.body.classList.remove("scouting-pointer-release");
      return;
    }

    document.body.classList.add("scouting-pointer-release");
    requestAnimationFrame(() => {
      document.body.classList.remove("scouting-pointer-release");
    });
  }

  setOutcomeOverlayActive(isActive) {
    document.body?.classList.toggle(
      "victory-outcome-active",
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





