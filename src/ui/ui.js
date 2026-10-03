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
    if (!this.#options.cache) return;

    const savedPos = this.#options.cache.get(`drag_pos_${this.#id}`);
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
    if (!this.#options.cache) return;

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
    this.#options.cache.set(`drag_pos_${this.#id}`, pos);
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





class ChumUI {
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
    // 1. Форматуємо потрібний текст залежно від стану та методу
    let text = "";
    if (state === "empty") {
      text = "🔘";
    } else if (state === "moving") {
      text = "⏩";
    } else if (state === "aiming") {
      text = "🚫";
    } else {
      // Якщо кораблик - показуємо ТІЛЬКИ емодзі. Якщо рука - емодзі + кількість.
      if (method === "boat") {
        text = "🚤";
      } else {
        text = `🍞(${count})`;
      }
    }

    // 2. Перевіряємо, чи потрібно взагалі оновлювати кнопку (оптимізація)
    if (
      this.currentState === state &&
      this.currentMethod === method &&
      this.button.innerText === text
    ) {
      return;
    }

    // 3. Зберігаємо нові стани та оновлюємо текст
    this.currentState = state;
    this.currentMethod = method;
    this.button.innerText = text;

    // 4. Оновлюємо стилі
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



class InventoryUI {
  #inventoryManager;
  #slotConfig;
  #inventoryCategories;
  #subfilterMapping;
  #equipTargetPolicy;
  #rarityDomAdapter;
  #progressionDomAdapter;
  #conditionDomAdapter;
  #isOpen = false;
  #warningTimeout;

  #activeCategory = "all";
  #activeSubFilters = new Set();
  #isFunnelOpen = false;
  #viewingBuildId = null; // Для перегляду вмісту конкретного ящика

  #containerNode;
  #powerValueNode;
  #warningBoxNode;
  #leftPanelNode;
  #saveBuildContainerNode;
  #categoryContainerNode;
  #subFilterContainerNode;
  #inventoryGridNode;
  #tooltipNode;
  #selectedInstanceId = null;
  #dynamicCapacityElapsedMs = 0;
  #dynamicCapacitySignature = null;
  #backpackButtonNode = null;
  #onInventoryChanged = () => {
    if (this.#isOpen) this.refreshUI();
  };
  #onProgressionUpdated = () => {
    if (this.#isOpen) this.refreshUI();
  };

  #saveInputNode;
  #saveBtnNode;

  #highlightedSlotId = null;

  constructor(
    inventoryManager,
    {
      rarityDomAdapter = null,
      progressionDomAdapter = null,
      conditionDomAdapter = null,
      slotConfig = {},
      inventoryCategories = [],
      subfilterMapping = {},
    } = {},
  ) {
    this.#inventoryManager = inventoryManager;
    this.#rarityDomAdapter = rarityDomAdapter;
    this.#progressionDomAdapter = progressionDomAdapter;
    this.#conditionDomAdapter = conditionDomAdapter;
    this.#slotConfig = slotConfig;
    this.#inventoryCategories = inventoryCategories;
    this.#subfilterMapping = subfilterMapping;
    this.#equipTargetPolicy = new InventoryEquipTargetSelectionPolicy(
      this.#slotConfig,
    );
    this.#initBackpackButton();
    this.#initModal();
    this.#setupEventListeners();
  }

  #enableHorizontalDrag(element) {
    new HorizontalScrollController().attach(element);
  }

  #initBackpackButton() {
    const btn = document.createElement("button");
    btn.innerHTML = "🎒";
    btn.className = "inv-backpack-btn";
    if (typeof UIUtils !== "undefined") {
      UIUtils.makeSolid(btn);
    }
    btn.addEventListener("click", () => this.toggle());
    document.body.appendChild(btn);
    this.#backpackButtonNode = btn;
  }

  #initModal() {
    this.#containerNode = document.createElement("div");
    this.#containerNode.className = "inv-modal";

    const topBar = document.createElement("div");
    topBar.className = "inv-top-bar";

    const powerLabelWrapper = document.createElement("div");
    powerLabelWrapper.innerHTML = `🧱 Макс. навантаження снасті: <span style="color: #00ff80;">0.0</span> кг`;
    this.#powerValueNode = powerLabelWrapper.querySelector("span");

    const closeBtn = document.createElement("button");
    closeBtn.innerText = "❌ Закрити";
    closeBtn.className = "inv-close-btn";
    closeBtn.onclick = () => this.toggle();

    topBar.append(powerLabelWrapper, closeBtn);

    this.#warningBoxNode = document.createElement("div");
    this.#warningBoxNode.style.cssText =
      "color: #ff4444; background: rgba(255, 0, 0, 0.1); border: 1px solid #ff4444; border-radius: 5px; padding: 10px; margin-bottom: 15px; text-align: center; font-weight: bold; display: none;";

    const mainArea = document.createElement("div");
    mainArea.className = "inv-main-area";

    // Обгортка для лівої панелі + кнопки збереження
    const leftWrapper = document.createElement("div");
    leftWrapper.style.cssText =
      "display: flex; flex-direction: column; flex: 1; gap: 10px;";

    this.#saveBuildContainerNode = document.createElement("div");
    this.#saveBuildContainerNode.style.cssText =
      "display: flex; gap: 5px; margin-bottom: 10px;";

    this.#saveInputNode = document.createElement("input");
    this.#saveInputNode.type = "text";
    this.#saveInputNode.maxLength = 10;
    this.#saveInputNode.placeholder = "Назва збірки...";
    this.#saveInputNode.style.cssText =
      "flex: 1; background: #0b1520; color: #00ff80; border: 1px solid #4a5b6c; border-radius: 4px; padding: 5px; font-family: monospace;";

    this.#saveBtnNode = document.createElement("button");
    this.#saveBtnNode.innerText = "💾 Зберегти";
    this.#saveBtnNode.style.cssText =
      "background: #00ff80; color: #000; border: none; border-radius: 4px; padding: 5px 10px; cursor: pointer; font-weight: bold;";

    this.#saveBuildContainerNode.append(this.#saveInputNode, this.#saveBtnNode);

    this.#leftPanelNode = document.createElement("div");
    this.#leftPanelNode.className = "inv-left-panel";
    this.#leftPanelNode.style.cssText =
      "display: flex; flex-direction: column; gap: 15px; flex: 1; overflow-y: auto;";

    leftWrapper.append(this.#saveBuildContainerNode, this.#leftPanelNode);

    const rightWrapperNode = document.createElement("div");
    rightWrapperNode.className = "inv-right-panel";

    this.#categoryContainerNode = document.createElement("div");
    this.#categoryContainerNode.className = "inv-categories";
    this.#enableHorizontalDrag(this.#categoryContainerNode);

    this.#subFilterContainerNode = document.createElement("div");
    this.#subFilterContainerNode.className = "inv-subfilters";
    this.#enableHorizontalDrag(this.#subFilterContainerNode);

    this.#inventoryGridNode = document.createElement("div");
    this.#inventoryGridNode.className = "inv-grid";

    rightWrapperNode.append(
      this.#categoryContainerNode,
      this.#subFilterContainerNode,
      this.#inventoryGridNode,
    );
    mainArea.append(leftWrapper, rightWrapperNode);
    this.#containerNode.append(topBar, this.#warningBoxNode, mainArea);
    document.body.appendChild(this.#containerNode);

    this.#tooltipNode = document.createElement("div");
    this.#tooltipNode.className = "inv-tooltip";
    document.body.appendChild(this.#tooltipNode);
  }

  #setupEventListeners() {
    document.addEventListener(
      "inventory-changed",
      this.#onInventoryChanged,
    );
    document.addEventListener(
      "item-progression-updated",
      this.#onProgressionUpdated,
    );
  }

  toggle() {
    this.#isOpen = !this.#isOpen;
    this.#containerNode.classList.toggle("active", this.#isOpen);
    if (this.#isOpen) {
      this.#viewingBuildId = null;
      this.#highlightedSlotId = null; // <-- ДОДАНО
      this.refreshUI();
    }
  }

  open() {
    if (!this.#isOpen) this.toggle();
  }

  showWarning(message) {
    this.#warningBoxNode.innerText = message;
    this.#warningBoxNode.style.display = "block";
    if (this.#warningTimeout) clearTimeout(this.#warningTimeout);
    this.#warningTimeout = setTimeout(() => {
      this.#warningBoxNode.style.display = "none";
    }, 5000);
  }

  #hideTooltip() {
    if (!this.#tooltipNode) return;
    this.#tooltipNode.style.display = "none";
    this.#tooltipNode.innerHTML = "";
    delete this.#tooltipNode.dataset.instanceId;
    this.#rarityDomAdapter?.clear(this.#tooltipNode);
    this.#progressionDomAdapter?.clear(this.#tooltipNode);
  }

  updateDynamicProgression(dt = 0) {
    if (!this.#isOpen || !this.#progressionDomAdapter) {
      this.#dynamicCapacityElapsedMs = 0;
      return;
    }
    this.#dynamicCapacityElapsedMs += Math.max(0, Number(dt) || 0);
    if (this.#dynamicCapacityElapsedMs < 100) return;
    this.#dynamicCapacityElapsedMs = 0;

    const equippedLine = this.#inventoryManager.getEquipped()?.line;
    if (!equippedLine?.instanceId) return;
    const currentLine = this.#inventoryManager.hydrateInstance(
      equippedLine.instanceId,
    );
    const capacity = currentLine?.progression?.capacity;
    if (!capacity?.available) return;
    const signature = [
      equippedLine.instanceId,
      capacity.current,
      capacity.maximum,
      capacity.source,
    ].join(":");
    if (signature === this.#dynamicCapacitySignature) return;
    this.#dynamicCapacitySignature = signature;

    for (const slot of this.#containerNode.querySelectorAll(
      ".inv-slot[data-instance-id]",
    )) {
      if (slot.dataset.instanceId !== equippedLine.instanceId) continue;
      this.#progressionDomAdapter.updateCapacity(
        slot,
        currentLine.progression,
      );
    }
    if (this.#tooltipNode.dataset.instanceId === equippedLine.instanceId) {
      this.#progressionDomAdapter.updateCapacity(
        this.#tooltipNode,
        currentLine.progression,
      );
    }
  }

  refreshUI() {
    this.#hideTooltip();
    this.#dynamicCapacitySignature = null;
    this.#powerValueNode.innerText = this.#inventoryManager
      .getTotalPower()
      .toFixed(1);
    this.#renderEquipment();

    // --- ДОДАНО: Перевірка на конфлікт збірок для кнопки Зберегти ---
    const equippedItems = this.#inventoryManager.getEquipped();
    let conflictItem = null;

    const checkConflict = (item) => {
      if (item && item.buildId && !conflictItem) conflictItem = item;
    };

    checkConflict(equippedItems.rod);
    checkConflict(equippedItems.reel);
    checkConflict(equippedItems.line);
    checkConflict(equippedItems.float);
    checkConflict(equippedItems.feederRig);
    checkConflict(equippedItems.net);
    checkConflict(equippedItems.delivery);
    if (equippedItems.hooks) equippedItems.hooks.forEach(checkConflict);

    if (conflictItem) {
      // Якщо є конфлікт - кнопка стає неактивною
      const box = this.#inventoryManager._hydrateInstance(conflictItem.buildId);
      const boxName = box ? box.name : "Невідомий ящик";

      this.#saveBtnNode.style.opacity = "0.5";
      this.#saveBtnNode.style.background = "#8a9bac";
      this.#saveBtnNode.style.cursor = "not-allowed";
      this.#saveInputNode.disabled = true;
      this.#saveInputNode.placeholder = "Заблоковано";

      this.#saveBtnNode.onclick = () => {
        this.showWarning(
          `Річ "${conflictItem.name}" вже знаходиться в ящику "${boxName}"!`,
        );
      };
    } else {
      // Якщо все чисто - кнопка активна
      this.#saveBtnNode.style.opacity = "1";
      this.#saveBtnNode.style.background = "#00ff80";
      this.#saveBtnNode.style.cursor = "pointer";
      this.#saveInputNode.disabled = false;
      this.#saveInputNode.placeholder = "Назва збірки...";

      this.#saveBtnNode.onclick = () => {
        if (this.#inventoryManager.isLocked) {
          this.showWarning("Витягніть снасть з води, щоб зберегти збірку!");
          return;
        }
        const name = this.#saveInputNode.value.trim() || "Збірка";
        const res = this.#inventoryManager.saveBuild(name);
        if (res.success) {
          this.#saveInputNode.value = "";
          this.refreshUI();
        } else {
          this.showWarning(res.reason);
        }
      };
    }

    if (this.#viewingBuildId) {
      this.#renderBuildControls();
    } else {
      this.#renderCategories();
    }

    this.#renderInventory();
  }

  #getAvailableSlots(equipped) {
    const groups = [];

    const rodGroup = { groupName: "Вудлище", slots: [] };
    rodGroup.slots.push({ id: "rod", label: "Вудлище", type: "rod" });

    const rod = equipped.rod;
    if (rod) {
      const hasReelProp = rod.effectiveStats?.hasReel;
      const canHaveReel = hasReelProp ?? rod.variant !== "pole";
      if (canHaveReel)
        rodGroup.slots.push({ id: "reel", label: "Котушка", type: "reel" });
      const canHaveLine = !canHaveReel || !!equipped.reel;
      if (canHaveLine)
        rodGroup.slots.push({ id: "line", label: "Ліска", type: "line" });
    }
    groups.push(rodGroup);

    if (rod) {
      const rigGroup = { groupName: "Оснастка", slots: [] };
      if (rod.variant === "spinning") {
        rigGroup.slots.push({ id: "baits_0", label: "Приманка", type: "lure" });
      } else if (rod.variant === "float" || rod.variant === "pole") {
        rigGroup.slots.push({ id: "float", label: "Поплавок", type: "float" });
        const maxHooks = rod.effectiveStats?.maxHooks || 1;
        for (let i = 0; i < maxHooks; i++) {
          rigGroup.slots.push({
            id: `hooks_${i}`,
            label: `Гачок ${i + 1}`,
            type: "hook",
          });
          if (equipped.hooks && equipped.hooks[i]) {
            rigGroup.slots.push({
              id: `baits_${i}`,
              label: `Наживка ${i + 1}`,
              type: "bait",
            });
          }
        }
      } else if (rod.variant === "feeder") {
        rigGroup.slots.push({
          id: "feederRig",
          label: "Фідерна оснастка",
          type: "feeder_rig",
        });
        const feederRigCaps =
          equipped.feederRig?.capabilities ||
          [];
        const hasChumSlot =
          feederRigCaps.includes("chum_mix") ||
          equipped.feederRig?.effectiveStats?.hasChumSlot;
        if (hasChumSlot)
          rigGroup.slots.push({
            id: "feederChum",
            label: "Прикормка",
            type: "chum_mix",
          });
        const maxHooks =
          equipped.feederRig?.effectiveStats?.hooksCount ||
          rod.effectiveStats?.maxHooks ||
          1;
        for (let i = 0; i < maxHooks; i++) {
          rigGroup.slots.push({
            id: `hooks_${i}`,
            label: `Гачок ${i + 1}`,
            type: "hook",
          });
          if (equipped.hooks && equipped.hooks[i]) {
            rigGroup.slots.push({
              id: `baits_${i}`,
              label: `Наживка ${i + 1}`,
              type: "bait",
            });
          }
        }
      }
      if (rigGroup.slots.length > 0) groups.push(rigGroup);
    }

    const extraGroup = { groupName: "Додатково", slots: [] };
    extraGroup.slots.push({ id: "net", label: "Підсака", type: "net" });
    extraGroup.slots.push({
      id: "delivery",
      label: "Кораблик",
      type: "delivery",
    });

    if (equipped.delivery) {
      const sections =
        equipped.delivery.effectiveStats?.sections ||
        1;
      for (let i = 0; i < sections; i++) {
        extraGroup.slots.push({
          id: `deliveryChums_${i}`,
          label: `Бункер ${i + 1}`,
          type: "chum_mix",
        });
      }
    }
    groups.push(extraGroup);

    return groups;
  }

  #renderEquipment() {
    const fragment = document.createDocumentFragment();
    const equipped = this.#inventoryManager.getEquipped();
    const dynamicLayout = this.#getAvailableSlots(equipped);

    dynamicLayout.forEach((groupConfig) => {
      const groupNode = this.#createGroupContainer(groupConfig.groupName);
      let hasSlots = false;

      groupConfig.slots.forEach((slotConfig) => {
        let item = null;
        if (slotConfig.id.includes("_")) {
          const [baseId, indexStr] = slotConfig.id.split("_");
          const index = parseInt(indexStr, 10);
          if (equipped[baseId] && Array.isArray(equipped[baseId])) {
            item = equipped[baseId][index];
          }
        } else {
          item = equipped[slotConfig.id];
        }

        groupNode.appendChild(
          this.#createSlotDOM(slotConfig.id, slotConfig.label, item, false),
        );
        hasSlots = true;
      });

      if (hasSlots) fragment.appendChild(groupNode);
    });

    this.#leftPanelNode.innerHTML = "";
    this.#leftPanelNode.appendChild(fragment);
  }

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

  #createSlotDOM(
    slotId,
    label,
    item,
    isInventory = false,
    instanceId = null,
    isBuildPlaceholder = false,
  ) {
    const slotDiv = document.createElement("div");
    slotDiv.className = `inv-slot ${isInventory ? "inventory" : ""}`;

    if (
      !isInventory &&
      slotId &&
      this.#isSelectedItemValidForSlot(slotId)
    ) {
      slotDiv.classList.add("highlight-target");
    }

    // Якщо це пуста заглушка для речі, яка лежить у ящику, але зараз одягнена
    if (isBuildPlaceholder) {
      slotDiv.innerHTML = `<span style="font-size: 10px; color: #00ff80;">Екіпір.</span>`;
      slotDiv.style.borderColor = "#00ff80";
      return slotDiv;
    }

    if (isInventory && instanceId === this.#selectedInstanceId) {
      slotDiv.classList.add("selected");
    }

    if (item) {
      const resolvedInstanceId = instanceId || item.instanceId;
      if (resolvedInstanceId) {
        slotDiv.dataset.instanceId = String(resolvedInstanceId);
      }
      this.#rarityDomAdapter?.apply(slotDiv, item.rarity);
      this.#conditionDomAdapter?.apply(slotDiv, item.condition);
      if (!isInventory) {
        slotDiv.classList.add("equipped");
        // Додаємо фіолетову крапку, якщо річ зі збірки
        if (item.buildId) {
          const badge = document.createElement("div");
          badge.style.cssText =
            "position: absolute; top: -5px; left: -5px; background: #b066ff; width: 8px; height: 8px; border-radius: 50%;";
          slotDiv.appendChild(badge);
        }
      }

      const contentNode = document.createElement("div");
      contentNode.className = "inv-slot__content";
      contentNode.textContent = item.icon || "📦";
      slotDiv.appendChild(contentNode);
      if (isInventory && item.quantity > 1) {
        const quantityNode = document.createElement("span");
        quantityNode.className = "qty";
        quantityNode.textContent = String(item.quantity);
        slotDiv.appendChild(quantityNode);
      }
      this.#progressionDomAdapter?.apply(slotDiv, item.progression);

      this.#addTooltip(
        slotDiv,
        item,
        slotId,
        !isInventory,
        instanceId || item.instanceId,
      );
    } else {
      slotDiv.innerHTML = `<span style="font-size: 10px; color: #555;">✖</span>`;
      slotDiv.title = label;

      // --- ДОДАНО: Візуальне виділення активного пустого слота ---
      if (this.#highlightedSlotId === slotId) {
        slotDiv.classList.add("highlight-active-empty");
      }
      // -----------------------------------------------------------

      slotDiv.addEventListener("click", () => {
        if (this.#inventoryManager.isLocked) {
          this.showWarning(
            "Витягніть снасть з води, щоб змінити екіпірування!",
          );
          return;
        }

        if (this.#tryEquipSelectedItemToSlot(slotId)) return;

        if (!this.#viewingBuildId) {
          // --- ДОДАНО: Логіка перемикання підсвітки сумісних речей ---
          if (this.#highlightedSlotId === slotId) {
            this.#highlightedSlotId = null; // Якщо клікнули повторно - вимикаємо
          } else {
            this.#highlightedSlotId = slotId; // Вмикаємо пошук для цього слота
            this.#selectedInstanceId = null; // Скидаємо виділений предмет у рюкзаку, якщо був
          }
          this.refreshUI();
          // ---------------------------------------------------------
        }
      });
    }

    return slotDiv;
  }

  #resolveEquipInteraction(item) {
    return this.#equipTargetPolicy.resolve({
      item,
      slotGroups: this.#getAvailableSlots(
        this.#inventoryManager.getEquipped(),
      ),
      validateSlot: (slotId, candidate) =>
        this.#inventoryManager.validateEquipToSlot(slotId, candidate),
    });
  }

  #isSelectedItemValidForSlot(slotId) {
    if (!this.#selectedInstanceId) return false;
    const selectedItem = this.#inventoryManager._hydrateInstance(
      this.#selectedInstanceId,
    );
    if (!selectedItem) return false;
    return this.#inventoryManager.validateEquipToSlot(
      slotId,
      selectedItem,
    ).isValid;
  }

  #tryEquipSelectedItemToSlot(slotId) {
    if (!this.#selectedInstanceId) return false;

    const selectedItem = this.#inventoryManager._hydrateInstance(
      this.#selectedInstanceId,
    );
    if (!selectedItem) {
      this.#selectedInstanceId = null;
      return false;
    }

    const validation = this.#inventoryManager.validateEquipToSlot(
      slotId,
      selectedItem,
    );
    if (!validation.isValid) {
      this.showWarning(validation.reason);
      return true;
    }

    const equipped = this.#inventoryManager.equipItem(
      slotId,
      this.#selectedInstanceId,
    );
    if (!equipped) {
      this.showWarning("Не вдалося спорядити предмет у вибраний слот.");
      return true;
    }

    this.#selectedInstanceId = null;
    this.#highlightedSlotId = null;
    this.refreshUI();
    return true;
  }

  #tryEquipInventoryItemToHighlightedSlot(instanceId, item) {
    if (!this.#highlightedSlotId) return false;

    const validation = this.#inventoryManager.validateEquipToSlot(
      this.#highlightedSlotId,
      item,
    );
    if (!validation.isValid) return false;

    const equipped = this.#inventoryManager.equipItem(
      this.#highlightedSlotId,
      instanceId,
    );
    if (!equipped) {
      this.showWarning("Не вдалося спорядити предмет у вибраний слот.");
      return true;
    }

    this.#selectedInstanceId = null;
    this.#highlightedSlotId = null;
    this.refreshUI();
    return true;
  }

  #handleInventoryItemClick(instanceId) {
    const item = this.#inventoryManager._hydrateInstance(instanceId);
    if (!item) {
      this.showWarning("Предмет не знайдено.");
      return;
    }

    if (this.#tryEquipInventoryItemToHighlightedSlot(instanceId, item)) {
      return;
    }

    this.#highlightedSlotId = null;

    if (this.#selectedInstanceId === instanceId) {
      const result = this.#inventoryManager.autoEquipItem(instanceId);
      if (!result.success) this.showWarning(result.reason);
      this.#selectedInstanceId = null;
      this.refreshUI();
      return;
    }

    const interaction = this.#resolveEquipInteraction(item);
    if (interaction.shouldEquipImmediately) {
      const equipped = this.#inventoryManager.equipItem(
        interaction.validSlotIds[0],
        instanceId,
      );
      if (!equipped) {
        this.showWarning("Не вдалося спорядити предмет.");
      }
      this.#selectedInstanceId = null;
    } else if (interaction.requiresSlotChoice) {
      this.#selectedInstanceId = instanceId;
    } else {
      const validation = this.#inventoryManager.validateEquip(item);
      this.#selectedInstanceId = null;
      this.showWarning(
        interaction.rejectionReason ||
          validation.reason ||
          "Для цього предмета немає доступного слота.",
      );
    }

    this.refreshUI();
  }

  #addTooltip(element, item, slotId, isEquipped, instanceId) {
    element.addEventListener("mouseenter", () => {
      if (!window.matchMedia("(hover: hover)").matches) return;

      const currentItem = instanceId
        ? this.#inventoryManager.hydrateInstance(instanceId) || item
        : item;
      this.#rarityDomAdapter?.apply(this.#tooltipNode, currentItem.rarity);

      const titleHtml = `<div class="inv-tooltip-title">${currentItem.icon} ${currentItem.name}</div>`;
      let detailsHtml = "";
      const renderedLabels = new Set();
      const displayStats = currentItem.displayStats || {};
      for (const [label, value] of Object.entries(displayStats)) {
        if (value === undefined || value === null) continue;
        renderedLabels.add(label);
        detailsHtml += `<div class="inv-tooltip-stat" style="color: #aaa;"><b>${label}:</b> <span style="color: #fff;">${value}</span></div>`;
      }

      const internalKeys = new Set([
        "id",
        "name",
        "icon",
        "itemType",
        "variant",
        "instanceId",
        "quantity",
        "buildId",
        "buildName",
        "displayStats",
        "displayStatsSchema",
        "gameplayStats",
        "effectiveStats",
        "statOverrides",
        "rarityProfile",
        "rarity",
        "progressionProfile",
        "progression",
        "requiresTag",
        "level",
        "basePower",
        "compensation",
        "maxDistance",
        "durabilityMaxLoadLossPerPercent",
        "hasReel",
        "capabilities",
        "line",
      ]);

      for (const key of Object.keys(currentItem.effectiveStats || {})) {
        internalKeys.add(key);
      }

      for (const [key, val] of Object.entries(currentItem)) {
        if (internalKeys.has(key) || renderedLabels.has(key)) continue;

        if (typeof val !== "object" && typeof val !== "function") {
          detailsHtml += `<div class="inv-tooltip-stat" style="color: #aaa;"><b>${key}:</b> <span style="color: #fff;">${val}</span></div>`;
        }
      }
      detailsHtml += this.#buildCompatibilityTooltip(currentItem);

      this.#tooltipNode.innerHTML = titleHtml;
      this.#progressionDomAdapter?.appendTooltip(
        this.#tooltipNode,
        currentItem.progression,
      );
      this.#tooltipNode.insertAdjacentHTML("beforeend", detailsHtml);
      this.#tooltipNode.style.display = "block";
      if (currentItem.instanceId) {
        this.#tooltipNode.dataset.instanceId = String(currentItem.instanceId);
      }

      const rect = element.getBoundingClientRect();
      this.#tooltipNode.style.left = `${rect.right + 10}px`;
      this.#tooltipNode.style.top = `${rect.top}px`;
    });

    element.addEventListener("mouseleave", () => {
      this.#hideTooltip();
    });

    element.addEventListener("click", () => {
      this.#hideTooltip();

      if (this.#inventoryManager.isLocked) {
        this.showWarning("Витягніть снасть з води, щоб змінити екіпірування!");
        return;
      }

      if (this.#warningBoxNode.style.display === "block") {
        this.#warningBoxNode.style.display = "none";
      }

      if (item.itemType === "build_box") {
        this.#viewingBuildId = item.instanceId;
        this.refreshUI();
        return;
      }

      if (isEquipped && slotId) {
        if (this.#tryEquipSelectedItemToSlot(slotId)) return;
        this.#highlightedSlotId = null;
        this.#inventoryManager.unequipItem(slotId);
      } else if (!isEquipped && instanceId) {
        this.#handleInventoryItemClick(instanceId);
      }
    });
  }

  #buildCompatibilityTooltip(item) {
    const compatibility = this.#inventoryManager.getCompatibilityInfo(item);
    if (!compatibility?.hasCompatibility) return "";

    const requiredLabel = this.#getRequiredTagLabel(compatibility.requiredTag);
    const rodLabel = this.#getRodTypeLabel(
      compatibility.rodType,
      compatibility.rodHasReel,
    );
    const statusClass = compatibility.isCompatible
      ? "compatible"
      : "incompatible";
    const statusText = compatibility.isCompatible ? "Сумісно" : "Не сумісно";

    return `
      <div class="inv-tooltip-section">
        <div class="inv-tooltip-section-title">Сумісність</div>
        <div class="inv-tooltip-stat"><b>Для вудки:</b> <span>${requiredLabel}</span></div>
        <div class="inv-tooltip-stat"><b>Поточна:</b> <span>${rodLabel}</span></div>
        <div class="inv-tooltip-compat ${statusClass}">${statusText}</div>
      </div>
    `;
  }

  #getRequiredTagLabel(tag) {
    const labels = {
      bait: "Гачок або фідерна оснастка",
      chum_mix: "Фідер / підгодовування",
      feeder_rig: "Фідер",
      float: "Поплавкова: болонська або махова",
      hook: "Поплавкова / фідерна",
      lure: "Спінінг",
      line: "Ліска потрібної довжини",
      reel: "Вудка з котушкою",
    };
    return labels[tag] || tag || "Не вказано";
  }

  #getRodTypeLabel(type, hasReel) {
    const labels = {
      feeder: "Фідер",
      spinning: "Спінінг",
    };
    if (type === "float" || type === "pole") {
      return hasReel ? "Болонська" : "Махова";
    }
    return labels[type] || "Не споряджена";
  }

  #renderBuildControls() {
    this.#categoryContainerNode.innerHTML = "";
    this.#subFilterContainerNode.classList.remove("active");

    const backBtn = document.createElement("button");
    backBtn.innerText = "🔙 Назад";
    backBtn.style.cssText =
      "background: #34495e; color: #fff; border: 1px solid #73c2fb; border-radius: 5px; padding: 5px 10px; cursor: pointer; margin-right: 15px;";
    backBtn.onclick = () => {
      this.#viewingBuildId = null;
      this.refreshUI();
    };

    const equipBtn = document.createElement("button");
    equipBtn.innerText = "✅ Екіпірувати все";
    equipBtn.style.cssText =
      "background: #00ff80; color: #000; border: none; border-radius: 5px; padding: 5px 10px; cursor: pointer; font-weight: bold; margin-right: 10px;";
    equipBtn.onclick = () => {
      if (this.#inventoryManager.isLocked) {
        this.showWarning("Витягніть снасть з води!");
        return;
      }
      this.#inventoryManager.equipBuild(this.#viewingBuildId);
      this.#viewingBuildId = null;
      this.refreshUI();
    };

    const breakBtn = document.createElement("button");
    breakBtn.innerText = "🔨 Розібрати";
    breakBtn.style.cssText =
      "background: #ff4444; color: #fff; border: none; border-radius: 5px; padding: 5px 10px; cursor: pointer; font-weight: bold;";
    breakBtn.onclick = () => {
      if (this.#inventoryManager.isLocked) {
        this.showWarning("Витягніть снасть з води!");
        return;
      }
      this.#inventoryManager.disassembleBuild(this.#viewingBuildId);
      this.#viewingBuildId = null;
      this.refreshUI();
    };

    this.#categoryContainerNode.append(backBtn, equipBtn, breakBtn);
  }

  #renderCategories() {
    const fragment = document.createDocumentFragment();

    const funnelBtn = document.createElement("button");
    funnelBtn.className = `inv-funnel-btn ${this.#isFunnelOpen ? "active" : ""}`;
    funnelBtn.innerHTML = "🔽";
    funnelBtn.onclick = () => {
      this.#isFunnelOpen = !this.#isFunnelOpen;
      this.#renderSubFilters();
    };
    fragment.appendChild(funnelBtn);

    this.#inventoryCategories.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = `inv-category-btn ${this.#activeCategory === cat.id ? "active" : ""}`;
      btn.innerText = cat.label;
      btn.onclick = () => {
        this.#activeCategory = cat.id;
        this.#activeSubFilters.clear();
        this.#highlightedSlotId = null;
        this.refreshUI();
      };
      fragment.appendChild(btn);
    });

    this.#categoryContainerNode.innerHTML = "";
    this.#categoryContainerNode.appendChild(fragment);
    this.#renderSubFilters();
  }

  #renderSubFilters() {
    if (!this.#isFunnelOpen) {
      this.#subFilterContainerNode.classList.remove("active");
      const funnelBtn =
        this.#categoryContainerNode.querySelector(".inv-funnel-btn");
      if (funnelBtn) funnelBtn.classList.remove("active");
      return;
    }

    this.#subFilterContainerNode.classList.add("active");
    const funnelBtn =
      this.#categoryContainerNode.querySelector(".inv-funnel-btn");
    if (funnelBtn) funnelBtn.classList.add("active");

    this.#subFilterContainerNode.innerHTML = "";

    const items = this.#inventoryManager.getInventoryItems();
    const catConfig = this.#inventoryCategories.find(
      (c) => c.id === this.#activeCategory,
    );

    const availableGroups = new Set();

    items.forEach((invItem) => {
      if (invItem.buildId && !this.#viewingBuildId) return;
      const itemData = this.#inventoryManager._hydrateInstance(
        invItem.instanceId,
      );
      if (!itemData) return;

      // --- НОВА ЛОГІКА ДЛЯ ЗБІРОК ---
      if (this.#activeCategory === "builds") {
        if (itemData.itemType === "build_box") {
          availableGroups.add(itemData.name); // Чекбокси отримують імена збірок!
        }
        return;
      }

      // Для всіх інших категорій ховаємо ящики з лійки
      if (itemData.itemType === "build_box") return;

      if (
        catConfig.acceptTypes === "ALL" ||
        catConfig.acceptTypes.includes(itemData.itemType)
      ) {
        const filterType = itemData.variant || itemData.itemType;
        const groupLabel = this.#subfilterMapping[filterType] || filterType;
        availableGroups.add(groupLabel);
      }
    });

    if (availableGroups.size === 0) {
      this.#subFilterContainerNode.innerHTML =
        "<span style='color: #888; font-size: 12px;'>Немає предметів для сортування</span>";
      return;
    }

    const fragment = document.createDocumentFragment();
    Array.from(availableGroups)
      .sort()
      .forEach((groupLabel) => {
        const labelNode = document.createElement("label");
        labelNode.className = "inv-subfilter-label";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = this.#activeSubFilters.has(groupLabel);
        cb.onchange = (e) => {
          if (e.target.checked) this.#activeSubFilters.add(groupLabel);
          else this.#activeSubFilters.delete(groupLabel);
          this.#renderInventory();
        };

        labelNode.appendChild(cb);
        labelNode.appendChild(document.createTextNode(groupLabel));
        fragment.appendChild(labelNode);
      });

    this.#subFilterContainerNode.appendChild(fragment);
  }

  #renderInventory() {
    const fragment = document.createDocumentFragment();
    const items = this.#inventoryManager.getInventoryItems();

    const equippedItems = this.#inventoryManager.getEquipped();
    const equippedCounts = {};
    const countItem = (item) => {
      if (item && item.instanceId) {
        equippedCounts[item.instanceId] =
          (equippedCounts[item.instanceId] || 0) + 1;
      }
    };

    countItem(equippedItems.rod);
    countItem(equippedItems.reel);
    countItem(equippedItems.line);
    countItem(equippedItems.float);
    countItem(equippedItems.feederRig);
    countItem(equippedItems.feederChum);
    countItem(equippedItems.net);
    countItem(equippedItems.delivery);
    if (equippedItems.deliveryChums)
      equippedItems.deliveryChums.forEach(countItem);
    if (equippedItems.hooks) equippedItems.hooks.forEach(countItem);
    if (equippedItems.baits) equippedItems.baits.forEach(countItem);

    if (this.#viewingBuildId) {
      items.forEach((invItem) => {
        if (invItem.buildId !== this.#viewingBuildId) return;

        const itemData = this.#inventoryManager._hydrateInstance(
          invItem.instanceId,
        );
        if (!itemData) return;

        const eqCount = equippedCounts[invItem.instanceId] || 0;

        if (eqCount >= itemData.quantity) {
          fragment.appendChild(
            this.#createSlotDOM(null, null, null, true, null, true),
          );
        } else {
          const displayItemData = {
            ...itemData,
            quantity: itemData.quantity - eqCount,
          };
          fragment.appendChild(
            this.#createSlotDOM(
              null,
              null,
              displayItemData,
              true,
              invItem.instanceId,
            ),
          );
        }
      });
    } else {
      const catConfig = this.#inventoryCategories.find(
        (c) => c.id === this.#activeCategory,
      );

      items.forEach((invItem) => {
        if (invItem.buildId) return;

        const itemData = this.#inventoryManager._hydrateInstance(
          invItem.instanceId,
        );
        if (!itemData) return;

        if (
          catConfig.acceptTypes !== "ALL" &&
          !catConfig.acceptTypes.includes(itemData.itemType)
        )
          return;

        // --- ВИПРАВЛЕНО: Роздільна фільтрація ---
        if (this.#activeCategory === "builds") {
          // У вкладці Збірки фільтруємо за назвами ящиків
          if (
            this.#activeSubFilters.size > 0 &&
            !this.#activeSubFilters.has(itemData.name)
          )
            return;
        } else {
          // У всіх інших вкладках фільтруємо за типом (а ящик тепер зникає, якщо не вибраний)
          const filterType = itemData.variant || itemData.itemType;
          const groupLabel = this.#subfilterMapping[filterType] || filterType;
          if (
            this.#activeSubFilters.size > 0 &&
            !this.#activeSubFilters.has(groupLabel)
          )
            return;
        }

        const eqCount = equippedCounts[invItem.instanceId] || 0;
        const remainingQty = itemData.quantity - eqCount;
        if (remainingQty <= 0 && itemData.itemType !== "build_box") return;

        const displayItemData = { ...itemData, quantity: remainingQty };

        // 1. Створюємо DOM-елемент слота
        const slotDom = this.#createSlotDOM(
          null,
          null,
          displayItemData,
          true,
          invItem.instanceId,
        );

        // 2. ДОДАНО: Перевіряємо, чи є зараз активний пустий слот для підсвітки
        if (this.#highlightedSlotId) {
          const baseSlot = this.#highlightedSlotId.split("_")[0];
          const config =
            this.#slotConfig[baseSlot] || null;

          // Спочатку груба перевірка за типом слота
          if (
            config &&
            config.acceptTypes &&
            config.acceptTypes.includes(itemData.itemType)
          ) {
            // Потім глибока перевірка валідатором (на наявність вудки/гачка)
            const validation = this.#inventoryManager.validateEquipToSlot(
              this.#highlightedSlotId,
              itemData,
            );
            if (validation.isValid) {
              slotDom.classList.add("highlight-compatible");
            }
          }
        }

        // 3. Тепер додаємо готовий слот (з підсвіткою або без) у фрагмент
        fragment.appendChild(slotDom);
      });
    }

    this.#inventoryGridNode.innerHTML = "";
    this.#inventoryGridNode.appendChild(fragment);
  }

  dispose() {
    document.removeEventListener(
      "inventory-changed",
      this.#onInventoryChanged,
    );
    document.removeEventListener(
      "item-progression-updated",
      this.#onProgressionUpdated,
    );
    if (this.#warningTimeout) {
      clearTimeout(this.#warningTimeout);
      this.#warningTimeout = null;
    }
    this.#backpackButtonNode?.remove();
    this.#containerNode?.remove();
    this.#tooltipNode?.remove();
    this.#backpackButtonNode = null;
    this.#containerNode = null;
    this.#tooltipNode = null;
    this.#isOpen = false;
  }
}
