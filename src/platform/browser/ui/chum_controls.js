import { UiEventShield } from "../dom/ui_event_shield.js";

export class ChumControls {
  constructor(onClickCallback) {
    this.button = document.createElement("button");
    this.button.className = "ui-fade-target";
    this.button.innerText = "🍞";

    this.currentState = "idle";
    this.currentMethod = "hand";

    Object.assign(this.button.style, {
      position: "absolute",
      bottom: "20px",
      right: "190px",
      padding: "12px",
      fontSize: "16px",
      fontWeight: "bold",
      backgroundColor: "#ffaa00",
      color: "#ffd000",
      border: "2px solid #ffcc00",
      borderRadius: "8px",
      cursor: "pointer",
      zIndex: "100",
      boxShadow: "0 4px 6px rgba(0,0,0,0.5)",
      transition: "all 0.2s ease",
      touchAction: "none",
    });

    UiEventShield.makeSolid(this.button);

    this.button.addEventListener("click", (e) => {
      console.log(
        "--- DEBUG 1: ChumControls клік! Поточний стан:",
        this.currentState,
      );
      if (
        this.currentState === "disabled" ||
        this.currentState === "empty" ||
        this.currentState === "moving"
      ) {
        return;
      }
      if (onClickCallback) onClickCallback(e);
    });

    document.body.appendChild(this.button);
  }

  setState(state, method = "hand", count = 0, isManual = false) {

    let text = "";
    if (state === "empty") {
      text = "🔘";
    } else if (state === "moving") {
      text = "⏩";
    } else if (state === "aiming") {
      text = "🚫";
    } else {
      // The boat shows only its icon; hand chum also shows the remaining amount.
      if (method === "boat") {
        text = "🚤";
      } else {
        text = `🍞(${count})`;
      }
    }

    // Skip DOM updates when the displayed state has not changed.
    if (
      this.currentState === state &&
      this.currentMethod === method &&
      this.button.innerText === text
    ) {
      return;
    }


    this.currentState = state;
    this.currentMethod = method;
    this.button.innerText = text;


    switch (state) {
      case "disabled":
        this.button.style.backgroundColor = "#555555";
        this.button.style.borderColor = "#444444";
        this.button.style.color = "#aaaaaa";
        this.button.style.opacity = "0.6";
        this.button.style.cursor = "not-allowed";
        break;
      case "empty":
        this.button.style.backgroundColor = "#2c3e50";
        this.button.style.borderColor = "#34495e";
        this.button.style.color = "#95a5a6";
        this.button.style.opacity = "0.9";
        this.button.style.cursor = "not-allowed";
        break;
      case "aiming":
        this.button.style.backgroundColor = "#ff4444";
        this.button.style.borderColor = "#ff8888";
        this.button.style.color = "#fff";
        this.button.style.opacity = "1";
        this.button.style.cursor = "pointer";
        break;
      case "moving":
        this.button.style.backgroundColor = "#6c7a89";
        this.button.style.borderColor = "#8a9bac";
        this.button.style.color = "#fff";
        this.button.style.opacity = "0.7";
        this.button.style.cursor = "wait";
        break;
      case "ready":
        this.button.style.backgroundColor = "#00ff80";
        this.button.style.borderColor = "#55ffaa";
        this.button.style.color = "#000";
        this.button.style.opacity = "1";
        this.button.style.cursor = "pointer";
        break;
      case "idle":
      default:
        this.button.style.backgroundColor = "#0000007e";
        this.button.style.borderColor = "#ffcc00";
        this.button.style.color = "#ffcc00";
        this.button.style.opacity = "1";
        this.button.style.cursor = "pointer";
        break;
    }
  }

  dispose() {
    this.button?.remove();
    this.button = null;
  }
}



