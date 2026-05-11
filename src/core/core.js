class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  // ДОДАНО: Потрібен для скидання або встановлення значень без створення нового об'єкта
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  // ДОДАНО: Копіювання значень з іншого вектора (дуже корисно для оптимізації)
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  // ДОДАНО: Віднімання (часто потрібне у фізиці)
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  multiplyScalar(s) {
    this.x *= s;
    this.y *= s;
    return this;
  }

  normalize() {
    const length = Math.hypot(this.x, this.y);
    if (length > 0) {
      this.x /= length;
      this.y /= length;
    }
    return this;
  }

  length() {
    return Math.hypot(this.x, this.y);
  }

  clone() {
    return new Vector2(this.x, this.y);
  }
}

class InputManager {
  #canvas;
  #isPulling;
  #pullDirection;
  #isDragging;
  #isPointerDown;
  #startX;
  #startY;
  #lastPointerX;
  #lastPointerY;
  #currentPointerX;
  #currentPointerY;
  #releasePointerX;
  #releasePointerY;
  #hasPointerRelease = false;
  #panDeltaX;
  #panDeltaY;
  #swipeDeltaY = 0;
  #holdToggleFlag = false;
  #pumpFlag = false;
  #hasSwipedThisTouch = false;
  #clickPos;
  #anchorX;
  #keys = {};
  #isDoubleClick = false;
  #longPressPos = null;
  #hasLongPressed = false;
  #lastClickTime = 0;
  #longPressTimeout = null;
  #eventCleanups = [];
  #stateSnapshot;

  constructor(canvas, anchorX = null) {
    this.#canvas = canvas;
    this.#anchorX = anchorX;
    this.#isPulling = false;
    this.#pullDirection = new Vector2(0, 1);
    this.#isDragging = false;
    this.#isPointerDown = false;
    this.#startX = 0;
    this.#startY = 0;
    this.#lastPointerX = 0;
    this.#lastPointerY = 0;
    this.#currentPointerX = 0;
    this.#currentPointerY = 0;
    this.#releasePointerX = 0;
    this.#releasePointerY = 0;
    this.#panDeltaX = 0;
    this.#panDeltaY = 0;
    this.#clickPos = null;
    this.#stateSnapshot = {
      isPulling: false,
      pullDirection: this.#pullDirection,
      panDeltaX: 0,
      panDeltaY: 0,
      swipeDeltaY: 0,
      toggleHold: false,
      pumpAction: false,
      clickPos: null,
      isDoubleClick: false,
      longPressPos: null,
      pointerDown: false,
      pointerStart: { x: 0, y: 0 },
      pointerCurrent: { x: 0, y: 0 },
      pointerDelta: { x: 0, y: 0 },
      pointerReleased: false,
      pointerRelease: { x: 0, y: 0 },
    };

    this.#bindEvents();
  }

  setAnchorX(x) {
    this.#anchorX = x;
  }

  #isKeyMatch(e, actionArray) {
    if (!actionArray) return false;
    return actionArray.includes(e.code) || actionArray.includes(e.key);
  }

  #checkKeyHeld(actionArray) {
    if (!actionArray) return false;
    for (let i = 0; i < actionArray.length; i++) {
      if (this.#keys[actionArray[i]] === true) return true;
    }
    return false;
  }

  #addEventListener(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.#eventCleanups.push(() =>
      target.removeEventListener(type, handler, options),
    );
  }

  #bindEvents() {
    this.#addEventListener(this.#canvas, "pointerdown", (e) => {
      this.#isPointerDown = true;
      this.#isPulling = true;
      this.#isDragging = false;
      this.#startX = e.clientX;
      this.#startY = e.clientY;
      this.#lastPointerX = e.clientX;
      this.#lastPointerY = e.clientY;
      this.#currentPointerX = e.clientX;
      this.#currentPointerY = e.clientY;
      this.#hasPointerRelease = false;
      this.#swipeDeltaY = 0;
      this.#hasSwipedThisTouch = false;
      this.#hasLongPressed = false;
      this.#updateDirection(e);

      if (this.#longPressTimeout) clearTimeout(this.#longPressTimeout);
      this.#longPressTimeout = setTimeout(() => {
        if (!this.#isDragging) {
          this.#longPressPos = { x: e.clientX, y: e.clientY };
          this.#hasLongPressed = true;
        }
      }, CONFIG.input?.longPressMs ?? 650);
    });

    this.#addEventListener(this.#canvas, "pointermove", (e) => {
      if (!this.#isPointerDown) return;

      this.#currentPointerX = e.clientX;
      this.#currentPointerY = e.clientY;

      const dist = Math.hypot(
        e.clientX - this.#startX,
        e.clientY - this.#startY,
      );
      if (dist > 5) {
        this.#isDragging = true;
        if (this.#longPressTimeout) clearTimeout(this.#longPressTimeout);
      }

      if (this.#isDragging) {
        this.#panDeltaX = this.#lastPointerX - e.clientX;
        this.#panDeltaY = this.#lastPointerY - e.clientY;

        if (!this.#hasSwipedThisTouch) {
          this.#swipeDeltaY = this.#startY - e.clientY;
        }

        this.#lastPointerX = e.clientX;
        this.#lastPointerY = e.clientY;
      }

      this.#updateDirection(e);
    });

    const resetInput = (e) => {
      if (this.#longPressTimeout) clearTimeout(this.#longPressTimeout);

      const isPointerEvent =
        e &&
        (e.type === "pointerup" ||
          e.type === "touchend" ||
          e.type === "pointercancel");

      if (isPointerEvent) {
        if (this.#isPointerDown) {
          const now = Date.now();
          const clientX =
            e.clientX ?? (e.changedTouches && e.changedTouches[0]?.clientX);
          const clientY =
            e.clientY ?? (e.changedTouches && e.changedTouches[0]?.clientY);

          if (clientX !== undefined && clientY !== undefined) {
            this.#releasePointerX = clientX;
            this.#releasePointerY = clientY;
            this.#currentPointerX = clientX;
            this.#currentPointerY = clientY;
            this.#hasPointerRelease = true;
          }

          // ВАЖЛИВО: Реєструємо клік ТІЛЬКИ якщо гравець не рухав пальцем (не свайпав)
          if (!this.#isDragging && !this.#hasLongPressed) {
            if (now - this.#lastClickTime < 300) {
              this.#isDoubleClick = true;
            } else {
              // Записуємо позицію кліку!
              if (clientX !== undefined && clientY !== undefined) {
                this.#clickPos = { x: clientX, y: clientY };
              }
            }
            this.#lastClickTime = now;
          }
        }
        this.#isPointerDown = false;
      }

      const pullKeys = CONFIG.input?.keys?.pull || ["Space"];
      this.#isPulling =
        this.#checkKeyHeld(pullKeys) || this.#isPointerDown === true;

      if (!this.#isPulling) {
        this.#pullDirection.set(0, 1);
      }
      this.#isDragging = false;
      this.#swipeDeltaY = 0;
    };

    this.#addEventListener(window, "pointerup", resetInput, { capture: true });
    this.#addEventListener(window, "pointercancel", resetInput, {
      capture: true,
    });
    this.#addEventListener(window, "touchend", resetInput, { capture: true });
    this.#addEventListener(window, "blur", () => {
      this.#keys = {};
      this.#isPointerDown = false;
      resetInput();
    });

    // === КЛАВІАТУРА ===
    this.#addEventListener(window, "keydown", (e) => {
      this.#keys[e.code] = true;
      this.#keys[e.key] = true;

      const keys = CONFIG.input?.keys || {};

      // 1. Тяга
      if (this.#isKeyMatch(e, keys.pull)) {
        this.#isPulling = true;
        if (e.code === "Space" || e.key === " ") e.preventDefault();
      }

      // 2. Блокування
      if (this.#isKeyMatch(e, keys.hold)) {
        if (!e.repeat) this.#holdToggleFlag = true;
      }

      // 3. Підтяжка
      if (this.#isKeyMatch(e, keys.pump)) {
        if (!e.repeat) this.#pumpFlag = true;
      }
    });

    this.#addEventListener(window, "keyup", (e) => {
      this.#keys[e.code] = false;
      this.#keys[e.key] = false;

      const keys = CONFIG.input?.keys || {};

      // Якщо відпустили кнопку тяги
      if (this.#isKeyMatch(e, keys.pull)) {
        // Перевіряємо, чи не затиснута інша кнопка тяги
        if (!this.#checkKeyHeld(keys.pull)) {
          this.#isPulling = this.#isPointerDown;
          if (!this.#isPulling) {
            this.#pullDirection.set(0, 1);
          }
        }
      }
    });

    this.#addEventListener(this.#canvas, "contextmenu", (e) =>
      e.preventDefault(),
    );
  }

  #updateDirection(e) {
    let keyX = 0;
    const keys = CONFIG.input?.keys || {};

    // ЗМІНЕНО: Читаємо стрілки з конфігу
    if (this.#checkKeyHeld(keys.left)) keyX = -1;
    if (this.#checkKeyHeld(keys.right)) keyX = 1;

    if (keyX !== 0) {
      this.#pullDirection.set(keyX, 1).normalize();
    } else if (e && e.clientX !== undefined) {
      if (this.#isDragging) {
        const dx = e.clientX - this.#startX;
        // ЗМІНЕНО: Читаємо чутливість із конфігу (за замовчуванням 200)
        const dy = CONFIG.input?.swipeResistanceY ?? 200;

        const length = Math.hypot(dx, dy);
        if (length > 0) {
          this.#pullDirection.set(dx / length, dy / length);
        }
      } else {
        this.#pullDirection.set(0, 1);
      }
    }
  }

  consumeSwipe() {
    this.#hasSwipedThisTouch = true;
    this.#swipeDeltaY = 0;
  }

  getState() {
    const keys = CONFIG.input?.keys || {};

    // ЗМІНЕНО: Читаємо клавіші руху з конфігу
    if (this.#checkKeyHeld(keys.left) || this.#checkKeyHeld(keys.right)) {
      this.#updateDirection();
    }

    const state = this.#stateSnapshot;
    state.isPulling = this.#isPulling;
    state.pullDirection = this.#pullDirection;
    state.panDeltaX = this.#panDeltaX;
    state.panDeltaY = this.#panDeltaY;
    state.swipeDeltaY = this.#swipeDeltaY;
    state.toggleHold = this.#holdToggleFlag;
    state.pumpAction = this.#pumpFlag;
    state.clickPos = this.#clickPos;
    state.isDoubleClick = this.#isDoubleClick;
    state.longPressPos = this.#longPressPos;
    state.pointerDown = this.#isPointerDown;
    state.pointerStart.x = this.#startX;
    state.pointerStart.y = this.#startY;
    state.pointerCurrent.x = this.#currentPointerX;
    state.pointerCurrent.y = this.#currentPointerY;
    state.pointerDelta.x = this.#currentPointerX - this.#startX;
    state.pointerDelta.y = this.#currentPointerY - this.#startY;
    state.pointerReleased = this.#hasPointerRelease;
    state.pointerRelease.x = this.#releasePointerX;
    state.pointerRelease.y = this.#releasePointerY;

    this.#panDeltaX = 0;
    this.#panDeltaY = 0;
    this.#clickPos = null;
    this.#isDoubleClick = false;
    this.#holdToggleFlag = false;
    this.#pumpFlag = false;
    this.#longPressPos = null;
    this.#hasPointerRelease = false;

    return state;
  }

  dispose() {
    if (this.#longPressTimeout) {
      clearTimeout(this.#longPressTimeout);
      this.#longPressTimeout = null;
    }
    for (let i = this.#eventCleanups.length - 1; i >= 0; i--) {
      this.#eventCleanups[i]();
    }
    this.#eventCleanups.length = 0;
  }
}

class EventLogger {
  #endpoint;
  #enabled;

  constructor(endpoint, enabled = true) {
    this.#endpoint = endpoint;
    this.#enabled = enabled;
  }

  async logEvent(eventType, eventData) {
    if (!this.#enabled || !this.#endpoint) return;

    const payload = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      timestamp: new Date().toISOString(),
      event: eventType,
      ...eventData,
    };

    try {
      const response = await fetch(this.#endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log(`[EventLogger] Event ${eventType} successfully sent.`);
      }
    } catch (error) {
      console.error("[EventLogger] Failed to send event.", error);
    }
  }
}

class CacheManager {
  static PREFIX = "fishing_game_";

  static set(key, value) {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn(
        "[CacheManager] Помилка збереження в кеш. Можливо, перевищено ліміт 5MB:",
        e,
      );
    }
  }

  static get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(this.PREFIX + key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.warn("[CacheManager] Помилка читання з кешу:", e);
      return defaultValue;
    }
  }

  static remove(key) {
    localStorage.removeItem(this.PREFIX + key);
  }

  static clearAll() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    console.log("[CacheManager] Весь кеш гри очищено.");
  }

  static printStorageUsage() {
    let totalBytes = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);

      totalBytes += (key.length + value.length) * 2;
    }

    const kb = (totalBytes / 1024).toFixed(2);
    const mb = (totalBytes / (1024 * 1024)).toFixed(3);
    const limitMb = 5.0;
    const percentage = ((totalBytes / (limitMb * 1024 * 1024)) * 100).toFixed(
      2,
    );

    let color = "#00ff80";
    if (percentage > 70) color = "#ffaa00";
    if (percentage > 90) color = "#ff4444";

    console.log(
      `%c💾 [CacheManager] Використано: ${kb} KB (${mb} MB) з ~${limitMb} MB | Заповнено на ${percentage}%`,
      `color: ${color}; font-weight: bold; font-family: monospace;`,
    );
  }
}
