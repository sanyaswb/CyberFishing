const UI_EXCEPTIONS = {
  tags: ["INPUT", "TEXTAREA", "BUTTON", "SELECT", "A"],
  classes: [],
  ids: [],
};

function initEngineInterface() {
  const style = document.createElement("style");
  style.innerHTML = `
        * {
            -webkit-tap-highlight-color: transparent !important;
            -webkit-touch-callout: none !important;
        }
        body {
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
            touch-action: none;
            overflow: hidden;
        }
        *:focus {
            outline: none !important;
        }
        button, a {
            transition: transform 0.12s ease-out;
            -webkit-user-select: none;
            user-select: none;
        }
        button:active, a:active {
            transform: scale(0.96);
        }
    `;
  document.head.appendChild(style);

  document.addEventListener("touchstart", () => {}, { passive: true });
  document.addEventListener("contextmenu", (e) => {
    const t = e.target;
    const isException =
      UI_EXCEPTIONS.tags.includes(t.tagName) ||
      UI_EXCEPTIONS.classes.some((c) => t.classList.contains(c)) ||
      UI_EXCEPTIONS.ids.includes(t.id);
    if (!isException) e.preventDefault();
  });
}

initEngineInterface();

class UIUtils {
  static makeSolid(element) {
    if (!element) return;

    const eventsToBlock = [
      "pointerdown",
      "pointerup",
      "pointermove",
      "mousedown",
      "mouseup",
      "click",
      "dblclick",
      "touchstart",
      "touchend",
      "touchmove",
      "wheel",
    ];

    eventsToBlock.forEach((evt) => {
      // ВИПРАВЛЕННЯ: Використовуємо capture: false (Bubbling)
      // Це дозволяє дітям (+ / -) та власним обробникам перетягування спрацювати першими.
      element.addEventListener(
        evt,
        (e) => {
          e.stopPropagation();
          // Ми видалили stopImmediatePropagation, щоб не блокувати
          // інші скрипти на цьому ж елементі.
        },
        { capture: false },
      );
    });

    element.addEventListener("contextmenu", (e) => e.preventDefault());
    element.style.touchAction = "none";
    element.style.pointerEvents = "all";
  }
}

class UIDraggableButton {
  #element;
  #onClickCallback;
  #config;
  #options;
  #holdTimer;
  #isDragging;
  #startX;
  #startY;
  #offsetX;
  #offsetY;
  #id; // Унікальний ідентифікатор для кешу

  constructor(element, onClickCallback, config, options = {}) {
    this.#element = element;
    this.#onClickCallback = onClickCallback;
    this.#config = config;
    this.#options = options;

    // Визначаємо ID (пріоритет: options.id -> element.id -> дефолтна назва)
    this.#id = options.id || element.id || "default_draggable";

    this.#holdTimer = null;
    this.#isDragging = false;

    UIUtils.makeSolid(this.#element);

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    this.#initEvents();
    this.#restorePosition(); // Відновлюємо позицію при створенні
  }

  // --- МАГІЯ КЕШУ ---
  #restorePosition() {
    if (typeof CacheManager === "undefined") return;

    const savedPos = CacheManager.get(`drag_pos_${this.#id}`);
    if (savedPos) {
      this.#element.style.position = "absolute";
      this.#element.style.margin = "0";
      this.#element.style.transition = "none";

      // Якщо це старий кеш (де ми зберігали x та y), для сумісності
      if (savedPos.x !== undefined) {
        this.#element.style.left = savedPos.x;
        this.#element.style.top = savedPos.y;
        this.#element.style.right = "auto";
        this.#element.style.bottom = "auto";
      } else {
        // Новий розумний кеш з прив'язкою до країв
        this.#element.style.left = savedPos.left || "auto";
        this.#element.style.right = savedPos.right || "auto";
        this.#element.style.top = savedPos.top || "auto";
        this.#element.style.bottom = savedPos.bottom || "auto";
      }
    }
  }

  #savePosition() {
    if (typeof CacheManager === "undefined") return;

    const rect = this.#element.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    // Рахуємо відстань до всіх чотирьох країв екрана
    const distLeft = rect.left;
    const distRight = winWidth - rect.right;
    const distTop = rect.top;
    const distBottom = winHeight - rect.bottom;

    const pos = {};

    // По горизонталі: прив'язуємо до того краю, який ближче
    if (distLeft <= distRight) {
      pos.left = `${Math.max(0, distLeft)}px`;
      pos.right = "auto";
    } else {
      pos.right = `${Math.max(0, distRight)}px`;
      pos.left = "auto";
    }

    // По вертикалі: прив'язуємо до верху або до низу
    if (distTop <= distBottom) {
      pos.top = `${Math.max(0, distTop)}px`;
      pos.bottom = "auto";
    } else {
      pos.bottom = `${Math.max(0, distBottom)}px`;
      pos.top = "auto";
    }

    // Застосовуємо ці "розумні" координати одразу до елемента
    this.#element.style.left = pos.left;
    this.#element.style.right = pos.right;
    this.#element.style.top = pos.top;
    this.#element.style.bottom = pos.bottom;

    // Зберігаємо в кеш
    CacheManager.set(`drag_pos_${this.#id}`, pos);
  }
  // -------------------

  #initEvents() {
    this.#element.addEventListener("pointerdown", this.onPointerDown);

    this.#element.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  onPointerDown(e) {
    e.stopPropagation();

    if (e.button !== 0 && e.pointerType === "mouse") return;

    this.#element.setPointerCapture(e.pointerId);

    this.#isDragging = false;
    this.#startX = e.clientX;
    this.#startY = e.clientY;

    const rect = this.#element.getBoundingClientRect();
    this.#offsetX = e.clientX - rect.left;
    this.#offsetY = e.clientY - rect.top;

    if (this.#config.ui?.draggableButtons) {
      this.#holdTimer = setTimeout(() => {
        this.#startDrag();
      }, this.#config.ui?.dragHoldTimeMs || 1500);
    }

    this.#element.addEventListener("pointermove", this.onPointerMove);
    this.#element.addEventListener("pointerup", this.onPointerUp);
    this.#element.addEventListener("pointercancel", this.onPointerUp);
  }

  #startDrag() {
    this.#isDragging = true;
    if (!this.#options.noTransform) {
      this.#element.style.transform = "scale(1.1)";
      this.#element.style.boxShadow = "0 10px 25px rgba(0,0,0,0.5)";
      this.#element.style.transition = "none";
    }
    this.#element.style.position = "absolute";
    this.#element.style.margin = "0";
    this.#element.style.right = "auto";
    this.#element.style.bottom = "auto";
    this.#updatePosition(this.#startX, this.#startY);
  }

  onPointerMove(e) {
    if (!this.#isDragging) {
      const dist = Math.hypot(
        e.clientX - this.#startX,
        e.clientY - this.#startY,
      );
      if (dist > 10 && this.#holdTimer) {
        clearTimeout(this.#holdTimer);
        this.#holdTimer = null;
      }
      return;
    }
    this.#updatePosition(e.clientX, e.clientY);
  }

  #updatePosition(clientX, clientY) {
    let x = clientX - this.#offsetX;
    let y = clientY - this.#offsetY;
    const rect = this.#element.getBoundingClientRect();
    x = Math.max(0, Math.min(x, window.innerWidth - rect.width));
    y = Math.max(0, Math.min(y, window.innerHeight - rect.height));
    this.#element.style.left = `${x}px`;
    this.#element.style.top = `${y}px`;
  }

  onPointerUp(e) {
    this.#element.releasePointerCapture(e.pointerId);
    this.#element.removeEventListener("pointermove", this.onPointerMove, {
      capture: true,
    });
    this.#element.removeEventListener("pointerup", this.onPointerUp, {
      capture: true,
    });
    this.#element.removeEventListener("pointercancel", this.onPointerUp, {
      capture: true,
    });

    if (this.#holdTimer) {
      clearTimeout(this.#holdTimer);
      this.#holdTimer = null;
    }

    if (this.#isDragging) {
      this.#isDragging = false;
      if (!this.#options.noTransform) {
        this.#element.style.transform = "";
        this.#element.style.boxShadow = "";
        this.#element.style.transition = "";
      }
      // Зберігаємо позицію після того, як кинули кнопку
      this.#savePosition();
    } else {
      const dist = Math.hypot(
        e.clientX - this.#startX,
        e.clientY - this.#startY,
      );
      if (dist < 10 && this.#onClickCallback) this.#onClickCallback(e);
    }
  }
}

class UIManager {
  #config;
  #fullscreenBtn;
  #netBtn;
  #isNetReady = false;
  onNetClick;
  #continueBtn;
  onContinueClick;

  constructor(config) {
    this.#config = config;
    this.#initFullscreenBtn();
    this.#initNetBtn();
    this.#initContinueBtn();

    new DevTools(this.#config);
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
      { id: "btn_fullscreen" },
    );

    document.addEventListener("fullscreenchange", () => {
      this.#fullscreenBtn.innerHTML = document.fullscreenElement ? "🗗" : "⛶";
    });

    document.body.appendChild(this.#fullscreenBtn);
  }

  #initNetBtn() {
    this.#netBtn = document.createElement("button");
    this.#netBtn.innerHTML = "🕸️";

    Object.assign(this.#netBtn.style, {
      position: "absolute",
      bottom: "20px",
      right: "20px",
      padding: "12px 24px",
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
      { id: "btn_net" },
    );

    document.body.appendChild(this.#netBtn);
  }

  updateNetButtonState(config, isReady) {
    if (!this.#netBtn) return;

    this.#isNetReady = isReady;

    if (!config.net || !config.net.active) {
      this.hideNetButton(); // Перевикористовуємо новий метод
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
      // requestAnimationFrame надійніший за setTimeout(..., 10) для CSS анімацій
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
}

class DepthSelectorUI {
  constructor() {
    this.container = document.createElement("div");
    this.container.innerHTML = `
            <style>
                #ds-container {
                    position: fixed; top: 0; right: 0; width: 140px; height: 100%;
                    display: none; justify-content: center; align-items: center; padding-right: 5%;
                    font-family: sans-serif; pointer-events: none; z-index: 9999;
                }
                #ds-wrapper {
                    display: flex; align-items: center; gap: 15px; height: 50vh; position: relative;
                    pointer-events: none;
                }
                #ds-input-container {
                    position: absolute; left: -90px;
                }
                #ds-input {
                    background: #73c2fb; color: #000; font-size: 18px; font-weight: bold;
                    border: 2px solid #000; border-radius: 4px; padding: 4px;
                    width: 60px; text-align: center; outline: none;
                    pointer-events: auto;
                }
                #ds-input::after {
                    content: ''; position: absolute; right: -12px; top: 50%; transform: translateY(-50%);
                    width: 12px; height: 2px; background: #fff;
                }
                #ds-slider-container {
                    height: 100%; display: flex; align-items: center;
                }
                #ds-slider {
                    writing-mode: vertical-lr; width: 8px; height: 100%; margin: 0; cursor: pointer;
                    background: linear-gradient(to bottom, #002233, #73c2fb); border-radius: 4px; outline: none;
                    pointer-events: auto;
                }
                #ds-labels {
                    display: flex; flex-direction: column; justify-content: space-between;
                    height: 100%; color: #fff; font-size: 14px; font-weight: bold; margin-left: 5px;
                }
            </style>
            <div id="ds-container">
                <div id="ds-wrapper">
                    <div id="ds-input-container">
                        <input type="text" id="ds-input" value="1.5">
                    </div>
                    <div id="ds-slider-container">
                        <input type="range" id="ds-slider" min="0.1" step="0.1">
                    </div>
                    <div id="ds-labels">
                        <span id="ds-min">0.1</span>
                        <span></span>
                        <span id="ds-max">8.0</span>
                    </div>
                </div>
            </div>
        `;
    document.body.appendChild(this.container);

    this.mainContainer = document.getElementById("ds-container");
    this.slider = document.getElementById("ds-slider");
    this.input = document.getElementById("ds-input");
    this.maxLabel = document.getElementById("ds-max");
    this.inputContainer = document.getElementById("ds-input-container");

    this.onChange = null;
    this.isActive = false;

    this.#bindEvents();
  }

  #bindEvents() {
    this.slider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      this.input.value = val.toFixed(2);
      this.#updateInputPosition();
      if (this.onChange) this.onChange(val);
    });

    this.input.addEventListener("input", (e) => {
      let val = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
      if ((val.match(/\./g) || []).length > 1) {
        val = val.substring(0, val.lastIndexOf("."));
      }
      e.target.value = val;
    });

    this.input.addEventListener("change", (e) => {
      let val = parseFloat(e.target.value);
      if (isNaN(val)) val = 0.1;
      val = Math.max(0.1, Math.min(parseFloat(this.slider.max), val));
      this.input.value = val.toFixed(2);
      this.slider.value = val;
      this.#updateInputPosition();
      if (this.onChange) this.onChange(val);
    });
  }

  #updateInputPosition() {
    const min = parseFloat(this.slider.min);
    const max = parseFloat(this.slider.max);
    const val = parseFloat(this.slider.value);

    const percent = (val - min) / (max - min);
    const sliderHeight = this.slider.clientHeight;
    const offset = percent * sliderHeight;

    this.inputContainer.style.top = `calc(${offset}px - 18px)`;
  }

  show(maxDepth, currentDepth, changeCallback) {
    this.isActive = true;
    this.onChange = changeCallback;

    this.slider.max = maxDepth;
    this.maxLabel.innerText = maxDepth.toFixed(1);

    this.slider.value = currentDepth;
    this.input.value = currentDepth.toFixed(2);

    this.mainContainer.style.display = "flex";

    requestAnimationFrame(() => this.#updateInputPosition());
  }

  updateMax(maxDepth) {
    if (!this.isActive || parseFloat(this.slider.max) === maxDepth) return;

    this.slider.max = maxDepth;
    this.maxLabel.innerText = maxDepth.toFixed(1);

    // Якщо поточна глибина стала більшою за новий ліміт - обрізаємо її
    let val = parseFloat(this.input.value);
    if (val > maxDepth) {
      val = maxDepth;
      this.input.value = val.toFixed(2);
      this.slider.value = val;
      if (this.onChange) this.onChange(val);
    }

    requestAnimationFrame(() => this.#updateInputPosition());
  }

  hide() {
    this.isActive = false;
    this.mainContainer.style.display = "none";
  }
}

class TimeDisplayUI {
  constructor() {
    this.container = document.createElement("div");
    this.container.style.cssText = `
            position: fixed;
            top: 15px;
            left: 15px;
            background: rgba(11, 21, 32, 0.85);
            border: 2px solid #4a5b6c;
            border-radius: 8px;
            padding: 6px 16px;
            color: #fff;
            font-family: monospace;
            font-size: 20px;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 9998;
            pointer-events: none;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        `;

    this.emojiSpan = document.createElement("span");
    this.timeSpan = document.createElement("span");
    this.timeSpan.style.color = "#00ccff";

    this.container.appendChild(this.emojiSpan);
    this.container.appendChild(this.timeSpan);
    document.body.appendChild(this.container);
  }

  update(gameTimeHours) {
    const h = Math.floor(gameTimeHours);
    const m = Math.floor((gameTimeHours % 1) * 60);
    const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;

    let emoji = "☀️";
    if (gameTimeHours >= 21 || gameTimeHours < 5) {
      emoji = "🌙";
    } else if (gameTimeHours >= 5 && gameTimeHours < 8) {
      emoji = "🌅";
    } else if (gameTimeHours >= 18 && gameTimeHours < 21) {
      emoji = "🌇";
    }

    if (this.timeSpan.innerText !== timeStr) {
      this.timeSpan.innerText = timeStr;
      this.emojiSpan.innerText = emoji;
    }
  }
}

class ChumUI {
  constructor(onClickCallback) {
    this.button = document.createElement("button");
    this.button.innerText = "🍞(7)";

    this.currentState = "idle";
    this.currentMethod = "hand";

    Object.assign(this.button.style, {
      position: "absolute",
      bottom: "20px",
      right: "150px",
      padding: "12px 24px",
      fontSize: "16px",
      fontWeight: "bold",
      backgroundColor: "#ffaa00",
      color: "#1a1a1a",
      border: "2px solid #ffcc00",
      borderRadius: "8px",
      cursor: "pointer",
      zIndex: "100",
      boxShadow: "0 4px 6px rgba(0,0,0,0.5)",
      transition: "all 0.2s ease",
      touchAction: "none",
    });

    if (typeof UIUtils !== "undefined") {
      UIUtils.makeSolid(this.button);
    }

    this.button.addEventListener("click", (e) => {
      console.log(
        "--- DEBUG 1: ChumUI клік! Поточний стан:",
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
    if (this.currentState === state && this.button.innerText.includes(count))
      return;
    this.currentState = state;
    this.currentMethod = method;

    // Форматування тексту на кнопці
    let text = "";
    if (state === "empty") {
      text = "🔘";
    } else if (state === "moving") {
      text = "⏩";
    } else if (state === "aiming") {
      text = "🚫";
    } else if (state === "ready") {
      text = `🍞(${count})`;
    } else {
      if (method === "boat") text = `🚤(${count})`;
      else text = `🍞(${count})`;
    }

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
        this.button.style.backgroundColor = "#ffaa00";
        this.button.style.borderColor = "#ffcc00";
        this.button.style.color = "#000";
        this.button.style.opacity = "1";
        this.button.style.cursor = "pointer";
        break;
    }
  }
}

class HoldChargesUI {
  constructor() {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      position: fixed;
      bottom: 25vh; /* Можеш змінити висоту, щоб не перекривало інші кнопки */
      left: 50%;
      transform: translateX(-50%);
      display: none; /* За замовчуванням приховано */
      gap: 12px;
      z-index: 9998;
      pointer-events: none;
      align-items: center;
      flex-direction: row;
    `;

    // Текст "УТРИМАННЯ", який з'являється при активації
    this.textLabel = document.createElement("div");
    this.textLabel.style.cssText = `
      position: absolute;
      top: -25px;
      left: 50%;
      transform: translateX(-50%);
      color: #00ff80;
      font-family: monospace;
      font-size: 14px;
      font-weight: bold;
      text-shadow: 0 0 5px #00ff80;
      display: none;
    `;

    this.container.appendChild(this.textLabel);
    document.body.appendChild(this.container);

    this.circles = [];
    this.maxCharges = 0;
  }

  update(holdState) {
    // Якщо стану немає, утримання немає або заряди = 0 -> ховаємо весь UI
    if (!holdState || !holdState.hasHold || holdState.max <= 0) {
      this.container.style.display = "none";
      return;
    }

    this.container.style.display = "flex";

    // Якщо змінилася максимальна кількість зарядів (наприклад, гравець змінив котушку)
    if (this.maxCharges !== holdState.max) {
      this.circles.forEach((c) => c.remove());
      this.circles = [];
      for (let i = 0; i < holdState.max; i++) {
        const circle = document.createElement("div");
        circle.style.cssText = `
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid #00ff80;
          transition: box-shadow 0.2s ease, border-color 0.2s ease;
          box-sizing: border-box;
          background: transparent;
        `;
        this.container.appendChild(circle);
        this.circles.push(circle);
      }
      this.maxCharges = holdState.max;
    }

    let available = holdState.current;
    let active = holdState.isActive ? 1 : 0;
    let restoringCount = holdState.restoring.length;

    // Показуємо або ховаємо текст
    if (holdState.isActive) {
      this.textLabel.innerText = "УТРИМАННЯ";
      this.textLabel.style.display = "block";
    } else {
      this.textLabel.style.display = "none";
    }

    // Оновлюємо стан кожного кружечка
    for (let i = 0; i < this.maxCharges; i++) {
      const circle = this.circles[i];

      if (active > 0) {
        // АКТИВНИЙ БЛОК: пустий всередині, світиться неоном
        circle.style.background = "transparent";
        circle.style.borderColor = "#00ff80";
        circle.style.boxShadow = "0 0 12px #00ff80, inset 0 0 8px #00ff80";
        active--;
      } else if (available > 0) {
        // ДОСТУПНИЙ БЛОК: повністю зафарбований зеленим
        circle.style.background = "#00ff80";
        circle.style.borderColor = "#00cc66";
        circle.style.boxShadow = "none";
        available--;
      } else if (restoringCount > 0) {
        // ВІДНОВЛЮЄТЬСЯ: червоний, заповнюється знизу
        const timer = holdState.restoring[restoringCount - 1];
        let progress = 1.0 - timer / holdState.restoreMaxTime;
        progress = Math.max(0, Math.min(1, progress));
        const percent = (progress * 100).toFixed(1); // До 1 знака після коми для плавності

        // Магія CSS: градієнт, який робить чітку межу заповнення
        circle.style.background = `linear-gradient(to top, rgba(255, 0, 85, 0.8) ${percent}%, transparent ${percent}%)`;
        circle.style.borderColor = "#ff0055";
        circle.style.boxShadow = "none";
        restoringCount--;
      }
    }
  }
}

class InventoryUI {
  #container;
  #inventoryManager;
  #isOpen = false;

  #equipmentSlots = [
    { id: "rod", name: "Вудилище", type: ["spinning", "float", "feeder"] },
    { id: "reel", name: "Котушка", type: ["spinning_reel"] },
    { id: "float", name: "Поплавок", type: ["float_tackle"] },
    { id: "hook", name: "Гачок", type: ["hook"] },
    {
      id: "baits",
      name: "Наживка",
      type: ["float", "spinner", "wobbler", "jig"],
    },
    { id: "sinker", name: "Грузило", type: ["sinker"] },
    { id: "net", name: "Підсака", type: ["net"] },
    { id: "feeder", name: "Прикормка", type: ["chum_mix"] },
  ];

  #activeFilters = new Set();

  constructor(inventoryManager) {
    this.#inventoryManager = inventoryManager;
    this.#initBackpackButton();
    this.#initModal();
  }

  #initBackpackButton() {
    this.backpackBtn = document.createElement("button");
    this.backpackBtn.innerHTML = "🎒";
    this.backpackBtn.className = "inv-backpack-btn"; // Використовуємо CSS клас

    if (typeof UIUtils !== "undefined") {
      UIUtils.makeSolid(this.backpackBtn);
    }

    this.backpackBtn.addEventListener("click", () => this.toggle());
    document.body.appendChild(this.backpackBtn);
  }

  #initModal() {
    this.#container = document.createElement("div");
    this.#container.className = "inv-modal";

    const topBar = document.createElement("div");
    topBar.className = "inv-top-bar";

    this.powerLabel = document.createElement("div");
    this.powerLabel.innerHTML = `💪 Загальна сила: <span id="inv-total-power" style="color: #00ff80;">0</span> / 1000`;

    const closeBtn = document.createElement("button");
    closeBtn.innerText = "❌ Закрити";
    closeBtn.className = "inv-close-btn";
    closeBtn.onclick = () => this.toggle();

    topBar.append(this.powerLabel, closeBtn);

    this.warningBox = document.createElement("div");
    this.warningBox.style.cssText = `
    color: #ff4444; background: rgba(255, 0, 0, 0.1); 
    border: 1px solid #ff4444; border-radius: 5px;
    padding: 10px; margin-bottom: 15px; text-align: center;
    font-weight: bold; display: none;
  `;
    this.#container.appendChild(topBar);
    this.#container.appendChild(this.warningBox);

    const mainArea = document.createElement("div");
    mainArea.className = "inv-main-area";

    this.leftPanel = document.createElement("div");
    this.leftPanel.className = "inv-left-panel";

    const rightWrapper = document.createElement("div");
    rightWrapper.className = "inv-right-panel";

    this.filterContainer = document.createElement("div");
    this.filterContainer.className = "inv-filters";

    this.inventoryGrid = document.createElement("div");
    this.inventoryGrid.className = "inv-grid";

    rightWrapper.append(this.filterContainer, this.inventoryGrid);
    mainArea.append(this.leftPanel, rightWrapper);
    this.#container.append(topBar, mainArea);
    document.body.appendChild(this.#container);

    this.tooltip = document.createElement("div");
    this.tooltip.className = "inv-tooltip";
    document.body.appendChild(this.tooltip);
  }

  showWarning(message) {
    this.warningBox.innerText = message;
    this.warningBox.style.display = "block";

    // Скидаємо попередній таймер, якщо є
    if (this.warningTimeout) clearTimeout(this.warningTimeout);

    // Ховаємо через 5 секунд
    this.warningTimeout = setTimeout(() => {
      this.warningBox.style.display = "none";
    }, 5000);
  }

  toggle() {
    this.#isOpen = !this.#isOpen;
    this.#container.classList.toggle("active", this.#isOpen);
    if (this.#isOpen) this.refreshUI();
  }

  refreshUI() {
    this.#renderEquipment();
    this.#renderFilters();
    this.#renderInventory();
    this.#updateTotalPower();
  }

  #renderEquipment() {
    this.leftPanel.innerHTML = "";

    // Перемикаємо панель у Flexbox, щоб групи йшли одна під одною
    this.leftPanel.style.display = "flex";
    this.leftPanel.style.flexDirection = "column";
    this.leftPanel.style.gap = "15px";

    const eq = this.#inventoryManager.getEquipped();
    const rod = eq.rod;
    const rodType = rod?.type;

    // === ГРУПА 1: ВУДИЛИЩЕ (Завжди зверху) ===
    const rodGroup = this.#createGroupContainer("Основне");
    rodGroup.appendChild(
      this.#createSlotDOM(
        { id: "rod", name: "Вудилище", type: ["spinning", "float", "feeder"] },
        rod,
      ),
    );
    this.leftPanel.appendChild(rodGroup);

    // === ГРУПА 2: ОСНАЩЕННЯ (З'являється лише якщо є вудка) ===
    if (rod) {
      const tackleGroup = this.#createGroupContainer("Оснащення");

      // Котушка (Зникає, якщо махова вудка)
      if (rod.hasReel !== false) {
        tackleGroup.appendChild(
          this.#createSlotDOM(
            { id: "reel", name: "Котушка", type: ["spinning_reel"] },
            eq.reel,
          ),
        );
      }

      // Динамічні слоти залежно від типу вудки
      if (rodType === "spinning") {
        // Спінінг: Лише приманка (блешня, воблер, джиг)
        let baitItem =
          eq.baits?.length > 0
            ? this.#inventoryManager._hydrateItem(eq.baits[0], "baits")
            : null;
        tackleGroup.appendChild(
          this.#createSlotDOM(
            {
              id: "baits",
              name: "Приманка",
              type: ["spinner", "wobbler", "jig"],
            },
            baitItem,
          ),
        );
      } else if (rodType === "float" || rodType === "float_match") {
        // Поплавкова: Поплавок, Грузило, Гачок, Наживка
        tackleGroup.appendChild(
          this.#createSlotDOM(
            { id: "float", name: "Поплавок", type: ["float_tackle"] },
            eq.float,
          ),
        );
        tackleGroup.appendChild(
          this.#createSlotDOM(
            { id: "sinker", name: "Грузило", type: ["sinker"] },
            eq.sinker,
          ),
        );
        tackleGroup.appendChild(
          this.#createSlotDOM(
            { id: "hook", name: "Гачок", type: ["hook"] },
            eq.hook,
          ),
        );

        let baitItem =
          eq.baits?.length > 0
            ? this.#inventoryManager._hydrateItem(eq.baits[0], "baits")
            : null;
        tackleGroup.appendChild(
          this.#createSlotDOM(
            { id: "baits", name: "Наживка", type: ["float"] },
            baitItem,
          ),
        );
      } else if (rodType === "feeder") {
        // Фідер: Гачок, Наживка + Ланцюжок з годівницею та прикормкою
        tackleGroup.appendChild(
          this.#createSlotDOM(
            { id: "hook", name: "Гачок", type: ["hook"] },
            eq.hook,
          ),
        );

        let baitItem =
          eq.baits?.length > 0
            ? this.#inventoryManager._hydrateItem(eq.baits[0], "baits")
            : null;
        tackleGroup.appendChild(
          this.#createSlotDOM(
            { id: "baits", name: "Наживка", type: ["float"] },
            baitItem,
          ),
        );

        // Створюємо "ланцюжок" 🔗 для фідера
        const chainDiv = document.createElement("div");
        chainDiv.style.cssText =
          "display: flex; align-items: center; gap: 5px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 8px;";

        // Використовуємо слот sinker як "Годівницю"
        chainDiv.appendChild(
          this.#createSlotDOM(
            {
              id: "sinker",
              name: "Годівниця",
              type: ["sinker", "feeder_basket"],
            },
            eq.sinker,
          ),
        );

        const linkIcon = document.createElement("span");
        linkIcon.innerText = "🔗";
        chainDiv.appendChild(linkIcon);

        let chumItem = eq.feeder?.chumId
          ? this.#inventoryManager._hydrateItem(eq.feeder.chumId, "chums")
          : null;
        chainDiv.appendChild(
          this.#createSlotDOM(
            { id: "feeder", name: "Прикормка (Фідер)", type: ["chum_mix"] },
            chumItem,
          ),
        );

        tackleGroup.appendChild(chainDiv);
      }

      this.leftPanel.appendChild(tackleGroup);
    }

    // === ГРУПА 3: НЕЗАЛЕЖНЕ СПОРЯДЖЕННЯ (Підсака, Кораблик) ===
    const indGroup = this.#createGroupContainer("Додатково");

    indGroup.appendChild(
      this.#createSlotDOM(
        { id: "net", name: "Підсака", type: ["net"] },
        eq.net,
      ),
    );

    // Кораблик та його прикормка (через ланцюжок 🔗)
    const boatChain = document.createElement("div");
    boatChain.style.cssText =
      "display: flex; align-items: center; gap: 5px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 8px;";

    // Слот доставки (Кораблик/Рогатка)
    let deliveryItem = eq.feeder?.deliveryMethodId
      ? this.#inventoryManager._hydrateItem(
          eq.feeder.deliveryMethodId,
          "deliveryMethods",
        )
      : null;
    boatChain.appendChild(
      this.#createSlotDOM(
        { id: "delivery", name: "Доставка", type: ["chum_delivery"] },
        deliveryItem,
      ),
    );

    // Якщо кораблик встановлено - показуємо слот для його прикормки
    if (deliveryItem && deliveryItem.type === "boat") {
      const linkIcon = document.createElement("span");
      linkIcon.innerText = "🔗";
      boatChain.appendChild(linkIcon);

      // (Тимчасово використовуємо chumId, але в майбутньому сюди краще додати boatChumId)
      let boatChumItem = eq.feeder?.chumId
        ? this.#inventoryManager._hydrateItem(eq.feeder.chumId, "chums")
        : null;
      boatChain.appendChild(
        this.#createSlotDOM(
          { id: "feeder", name: "Прикормка (Кораблик)", type: ["chum_mix"] },
          boatChumItem,
        ),
      );
    }

    indGroup.appendChild(boatChain);
    this.leftPanel.appendChild(indGroup);
  }

  // --- ДОПОМІЖНИЙ МЕТОД: Створює контейнер для групи слотів ---
  #createGroupContainer(titleText) {
    const group = document.createElement("div");
    group.style.cssText =
      "display: flex; flex-wrap: wrap; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);";

    const title = document.createElement("div");
    title.innerText = titleText;
    title.style.cssText =
      "width: 100%; font-size: 12px; color: #888; text-transform: uppercase; margin-bottom: -5px;";

    group.appendChild(title);
    return group;
  }

  // --- ДОПОМІЖНИЙ МЕТОД: Створює саму ячейку (Slot) ---
  #createSlotDOM(slotDef, item) {
    const slotDiv = document.createElement("div");
    slotDiv.className = "inv-slot";

    if (item) {
      slotDiv.classList.add("equipped");
      slotDiv.innerHTML = item.icon || "📦";
      this.#addTooltip(slotDiv, item, slotDef.id, true);
    } else {
      slotDiv.innerHTML = `<span style="font-size: 10px; color: #555;">✖</span>`;
      slotDiv.title = slotDef.name;

      // Якщо гравець клікає на порожній слот, показуємо підказку!
      slotDiv.addEventListener("click", () => {
        this.showWarning(`Оберіть ${slotDef.name} у правій панелі`);
      });
    }
    return slotDiv;
  }

  #renderFilters() {
    this.filterContainer.innerHTML = "";
    const items = this.#inventoryManager.getInventoryItems();

    const types = new Set(
      items
        .map((i) => {
          const fullItem = this.#inventoryManager._hydrateItem(
            i.itemId,
            this.#getCategoryByType(i.itemId),
          );
          return fullItem ? fullItem.type : null;
        })
        .filter(Boolean),
    );

    this.filterContainer.appendChild(
      this.#createFilterBtn("All", "🎛️ Усі", this.#activeFilters.size === 0),
    );

    types.forEach((type) => {
      const isActive = this.#activeFilters.has(type);
      this.filterContainer.appendChild(
        this.#createFilterBtn(type, type, isActive),
      );
    });
  }

  #createFilterBtn(type, label, isActive) {
    const btn = document.createElement("button");
    btn.className = `inv-filter-btn ${isActive ? "active" : ""}`;
    btn.innerText = label;
    btn.onclick = () => {
      if (type === "All") {
        this.#activeFilters.clear();
      } else {
        this.#activeFilters.has(type)
          ? this.#activeFilters.delete(type)
          : this.#activeFilters.add(type);
      }
      this.refreshUI();
    };
    return btn;
  }

  #renderInventory() {
    this.inventoryGrid.innerHTML = "";
    const items = this.#inventoryManager.getInventoryItems();

    items.forEach((invItem) => {
      const category = this.#getCategoryByType(invItem.itemId);
      const item = this.#inventoryManager._hydrateItem(
        invItem.itemId,
        category,
      );
      if (!item) return;

      if (this.#activeFilters.size > 0 && !this.#activeFilters.has(item.type))
        return;

      const slotDiv = document.createElement("div");
      slotDiv.className = "inv-slot inventory";
      slotDiv.innerHTML = item.icon || "📦";

      if (invItem.quantity > 1) {
        const qty = document.createElement("span");
        qty.className = "qty";
        qty.innerText = invItem.quantity;
        slotDiv.appendChild(qty);
      }

      this.#addTooltip(slotDiv, item, null, false, invItem.instanceId);
      this.inventoryGrid.appendChild(slotDiv);
    });
  }

  #addTooltip(element, item, slotId, isEquipped, instanceId = null) {
    element.addEventListener("mouseenter", () => {
      let html = `<div style="font-size: 16px; font-weight: bold; margin-bottom: 5px; color: #00ccff;">${item.icon} ${item.name}</div>`;
      for (let [key, val] of Object.entries(item)) {
        if (["id", "name", "icon", "type"].includes(key)) continue;
        if (typeof val !== "object") {
          // Стало (використовуємо клас inv-tooltip-stat):
          html += `<div class="inv-tooltip-stat"><b>${key}:</b> ${val}</div>`;
        }
      }

      this.tooltip.innerHTML = html;
      this.tooltip.style.display = "block";

      const rect = element.getBoundingClientRect();
      this.tooltip.style.left = `${rect.right + 10}px`;
      this.tooltip.style.top = `${rect.top}px`;
    });

    element.addEventListener("mouseleave", () => {
      this.tooltip.style.display = "none";
    });

    element.addEventListener("click", () => {
      if (isEquipped) {
        if (slotId === "baits") this.#inventoryManager.unequipBait();
        else if (slotId === "feeder") this.#inventoryManager.unequipFeeder();
        else if (slotId === "delivery")
          this.#inventoryManager.unequipDelivery(); // ДОДАНО
        else this.#inventoryManager.unequipItem(slotId);
      } else {
        const validation = this.#inventoryManager.validateEquip(item);

        if (!validation.isValid) {
          this.showWarning(validation.reason);
          return;
        }

        if (this.warningBox) this.warningBox.style.display = "none";

        const targetSlot = this.#equipmentSlots.find((s) =>
          s.type.includes(item.type),
        );

        if (targetSlot) {
          if (targetSlot.id === "baits")
            this.#inventoryManager.equipBait(item.id);
          else if (targetSlot.id === "feeder")
            this.#inventoryManager.equipFeeder(item.id);
          else if (targetSlot.id === "delivery")
            this.#inventoryManager.equipDelivery(item.id); // ДОДАНО
          else this.#inventoryManager.equipItem(targetSlot.id, item.id);
        }
      }
      this.refreshUI();
    });
  }

  #updateTotalPower() {
    const eq = this.#inventoryManager.getEquipped();
    let power = 0;
    if (eq.rod) power += eq.rod.basePower * eq.rod.level || 0;
    if (eq.reel) power += eq.reel.basePower * eq.reel.level || 0;

    const powerEl = document.getElementById("inv-total-power");
    if (powerEl) powerEl.innerText = power.toFixed(1);
  }

  #getCategoryByType(itemId) {
    if (itemId.includes("rod")) return "rods";
    if (itemId.includes("reel")) return "reels";
    if (itemId.includes("hook")) return "hooks";
    if (itemId.includes("net")) return "nets";
    if (itemId.includes("sinker")) return "sinkers";
    if (itemId.includes("mix")) return "chums";
    if (itemId.includes("float")) return "floats";
    return "baits";
  }
}
