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

const PointerAction = Object.freeze({
  IDLE: "idle",
  PENDING: "pending",
  PULL: "pull",
  DRAG_CONTROL: "drag_control",
  ROD_CONTROL_X: "rod_control_x",
});

class InputManager {
  static #activeListenerCount = 0;

  #canvas;
  #isPulling;
  #pullDirection;
  #isDragging;
  #isPointerDown;
  #isDragControlActive;
  #pointerAction;
  #pointerDownAtMs;
  #startX;
  #startY;
  #lastPointerX;
  #lastPointerY;
  #currentPointerX;
  #currentPointerY;
  #releasePointerX;
  #releasePointerY;
  #hasPointerRelease = false;
  #rodControlPointerActive = false;
  #rodControlAnchorX = 0;
  #rodControlCurrentX = 0;
  #rodControlDirectionX = 0;
  #rodControlInputRatio = 0;
  #keyboardRodControlRatio = 0;
  #lastKeyboardRodControlUpdateMs = 0;
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
  #dragControlEnabled = true;
  #fightInputActionComposer = null;
  #stateSnapshot;

  constructor(canvas, anchorX = null) {
    this.#canvas = canvas;
    this.#anchorX = anchorX;
    this.#isPulling = false;
    this.#pullDirection = new Vector2(0, 1);
    this.#isDragging = false;
    this.#isPointerDown = false;
    this.#isDragControlActive = false;
    this.#pointerAction = PointerAction.IDLE;
    this.#pointerDownAtMs = 0;
    this.#startX = 0;
    this.#startY = 0;
    this.#lastPointerX = 0;
    this.#lastPointerY = 0;
    this.#currentPointerX = 0;
    this.#currentPointerY = 0;
    this.#releasePointerX = 0;
    this.#releasePointerY = 0;
    this.#rodControlAnchorX = 0;
    this.#rodControlCurrentX = 0;
    this.#panDeltaX = 0;
    this.#panDeltaY = 0;
    this.#clickPos = null;
    this.#fightInputActionComposer =
      typeof FightInputActionComposer !== "undefined"
        ? new FightInputActionComposer()
        : null;
    this.#stateSnapshot = {
      isPulling: false,
      pullDirection: this.#pullDirection,
      panDeltaX: 0,
      panDeltaY: 0,
      swipeDeltaY: 0,
      toggleHold: false,
      pumpAction: false,
      dragIncrease: false,
      dragDecrease: false,
      castPowerIncrease: false,
      castPowerDecrease: false,
      aimLeft: false,
      aimRight: false,
      retrieve: false,
      clickPos: null,
      isDoubleClick: false,
      longPressPos: null,
      pointerDown: false,
      dragControlActive: false,
      dragControlEnabled: true,
      pointerAction: PointerAction.IDLE,
      pointerStart: { x: 0, y: 0 },
      pointerCurrent: { x: 0, y: 0 },
      pointerDelta: { x: 0, y: 0 },
      pointerReleased: false,
      pointerRelease: { x: 0, y: 0 },
      rodControlActive: false,
      rodControlDirectionX: 0,
      rodControlInputRatio: 0,
      rodControlAnchorX: 0,
      rodControlCurrentX: 0,
      fightActions: null,
    };

    this.#bindEvents();
  }

  setAnchorX(x) {
    this.#anchorX = x;
  }

  setDragControlEnabled(enabled) {
    this.#dragControlEnabled = enabled !== false;
    if (!this.#dragControlEnabled) {
      this.#isDragControlActive = false;
      if (this.#pointerAction === PointerAction.DRAG_CONTROL) {
        this.#pointerAction = this.#isPointerDown ? PointerAction.PENDING : PointerAction.IDLE;
      }
    }
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
    InputManager.#activeListenerCount += 1;
    let active = true;
    this.#eventCleanups.push(() => {
      if (!active) return;
      active = false;
      target.removeEventListener(type, handler, options);
      InputManager.#activeListenerCount = Math.max(
        0,
        InputManager.#activeListenerCount - 1,
      );
    });
  }

  #bindEvents() {
    this.#addEventListener(this.#canvas, "pointerdown", (e) => {
      this.#isPointerDown = true;
      this.#isPulling = false;
      this.#isDragging = false;
      this.#isDragControlActive = false;
      this.#pointerAction = PointerAction.PENDING;
      this.#pointerDownAtMs = Date.now();
      this.#startX = e.clientX;
      this.#startY = e.clientY;
      this.#lastPointerX = e.clientX;
      this.#lastPointerY = e.clientY;
      this.#currentPointerX = e.clientX;
      this.#currentPointerY = e.clientY;
      this.#hasPointerRelease = false;
      this.#rodControlPointerActive = false;
      this.#rodControlAnchorX = e.clientX;
      this.#rodControlCurrentX = e.clientX;
      this.#rodControlDirectionX = 0;
      this.#rodControlInputRatio = 0;
      this.#lastKeyboardRodControlUpdateMs = Date.now();
      this.#swipeDeltaY = 0;
      this.#hasSwipedThisTouch = false;
      this.#hasLongPressed = false;
      this.#updateDirection(e);

      if (this.#longPressTimeout) clearTimeout(this.#longPressTimeout);
      this.#longPressTimeout = setTimeout(() => {
        if (this.#canTriggerLongPress()) {
          this.#longPressPos = {
            x: this.#currentPointerX,
            y: this.#currentPointerY,
          };
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
        if (dist > this.#getLongPressMoveTolerancePx()) {
          this.#clearLongPressTimeout();
        }
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

      this.#updateRodControlPointerState();
      this.#updateDragControlState();
      if (this.#isDragControlActive) this.#clearLongPressTimeout();
      this.#updatePointerPullState(Date.now());
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
          const holdMs = Math.max(0, Number(CONFIG.input?.pullHoldMinMs) || 0);
          const elapsedMs = Math.max(0, now - Number(this.#pointerDownAtMs || now));
          const pointerWasClickCandidate =
            this.#pointerAction === PointerAction.PENDING && elapsedMs < holdMs;
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

          // ВАЖЛИВО: Реєструємо клік ТІЛЬКИ якщо це був короткий pending-click,
          // а не long-hold виважування або drag-control жест.
          if (pointerWasClickCandidate && !this.#isDragging && !this.#hasLongPressed) {
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
        this.#isDragControlActive = false;
        this.#pointerAction = PointerAction.IDLE;
        this.#pointerDownAtMs = 0;
        this.#rodControlPointerActive = false;
        this.#rodControlDirectionX = 0;
        this.#rodControlInputRatio = 0;
      }

      const pullKeys = CONFIG.input?.keys?.pull || ["Space"];
      this.#updatePointerPullState(Date.now());
      this.#isPulling =
        this.#checkKeyHeld(pullKeys) ||
        this.#pointerAction === PointerAction.PULL;

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
      this.#isDragControlActive = false;
      this.#pointerAction = PointerAction.IDLE;
      this.#pointerDownAtMs = 0;
      this.#rodControlPointerActive = false;
      this.#rodControlDirectionX = 0;
      this.#rodControlInputRatio = 0;
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

      if (
        this.#isKeyMatch(e, keys.left) ||
        this.#isKeyMatch(e, keys.right) ||
        this.#isKeyMatch(e, keys.dragIncrease) ||
        this.#isKeyMatch(e, keys.dragDecrease) ||
        this.#isKeyMatch(e, keys.retrieve)
      ) {
        e.preventDefault();
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
          this.#updatePointerPullState(Date.now());
          this.#isPulling = this.#pointerAction === PointerAction.PULL;
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
    if (e && e.clientX !== undefined) {
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

  #updateDragControlState() {
    if (!this.#dragControlEnabled) return;
    if (!this.#isPointerDown || this.#isDragControlActive) return;
    if (this.#pointerAction === PointerAction.PULL) return;
    if (this.#rodControlPointerActive) return;

    const dx = this.#currentPointerX - this.#startX;
    const dy = this.#currentPointerY - this.#startY;
    const threshold =
      Number(CONFIG.input?.dragControlActivationPx) ||
      Number(
        CONFIG.fightPhysicsConfig?.getReelDragConfig?.()
          ?.pointerActivationPx,
      ) ||
      30;

    if (Math.abs(dy) >= threshold && Math.abs(dy) >= Math.abs(dx)) {
      this.#isDragControlActive = true;
      this.#pointerAction = PointerAction.DRAG_CONTROL;
      this.#isPulling = false;
    }
  }

  #getLongPressMoveTolerancePx() {
    return Math.max(
      5,
      Number(CONFIG.input?.longPressMoveTolerancePx) ||
        Number(CONFIG.input?.dragControlActivationPx) ||
        30,
    );
  }

  #canTriggerLongPress() {
    if (!this.#isPointerDown || this.#isDragControlActive) return false;
    if (this.#rodControlPointerActive) return false;

    const dx = this.#currentPointerX - this.#startX;
    const dy = this.#currentPointerY - this.#startY;
    return Math.hypot(dx, dy) <= this.#getLongPressMoveTolerancePx();
  }

  #clearLongPressTimeout() {
    if (!this.#longPressTimeout) return;
    clearTimeout(this.#longPressTimeout);
    this.#longPressTimeout = null;
  }

  #updatePointerPullState(now = Date.now()) {
    if (!this.#isPointerDown) {
      if (this.#pointerAction !== PointerAction.IDLE) {
        this.#pointerAction = PointerAction.IDLE;
      }
      return;
    }

    if (
      this.#rodControlPointerActive ||
      this.#pointerAction === PointerAction.ROD_CONTROL_X
    ) {
      this.#pointerAction = PointerAction.ROD_CONTROL_X;
      return;
    }

    if (this.#isDragControlActive || this.#pointerAction === PointerAction.DRAG_CONTROL) {
      this.#pointerAction = PointerAction.DRAG_CONTROL;
      this.#isPulling = false;
      return;
    }

    if (this.#pointerAction === PointerAction.PULL) {
      this.#isPulling = true;
      return;
    }

    if (this.#pointerAction !== PointerAction.PENDING) return;

    const holdMs = Math.max(0, Number(CONFIG.input?.pullHoldMinMs) || 0);
    const elapsedMs = Math.max(0, Number(now) - Number(this.#pointerDownAtMs || now));
    if (elapsedMs >= holdMs) {
      this.#pointerAction = PointerAction.PULL;
      this.#isPulling = true;
    } else {
      this.#isPulling = false;
    }
  }

  #isPointerHoldActive(now = Date.now()) {
    if (!this.#isPointerDown) return false;
    if (this.#pointerAction === PointerAction.PULL) return true;
    if (
      this.#rodControlPointerActive ||
      this.#pointerAction === PointerAction.ROD_CONTROL_X
    ) {
      const holdMs = Math.max(0, Number(CONFIG.input?.pullHoldMinMs) || 0);
      const elapsedMs = Math.max(
        0,
        Number(now) - Number(this.#pointerDownAtMs || now),
      );
      return elapsedMs >= holdMs;
    }
    return false;
  }

  #updateRodControlPointerState() {
    if (!this.#isPointerDown) return;
    if (this.#pointerAction === PointerAction.DRAG_CONTROL) return;

    const dx = this.#currentPointerX - this.#startX;
    const dy = this.#currentPointerY - this.#startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const config = this.#getRodControlInputConfig();
    const minLock = Math.max(1, Number(config.minLockDistancePx) || 8);
    const dominance = Math.max(
      1,
      Number(config.horizontalDominanceRatio) || 1.15,
    );

    if (!this.#rodControlPointerActive) {
      if (absX < minLock && absY < minLock) return;
      if (absX >= absY * dominance) {
        this.#rodControlPointerActive = true;
        this.#isDragControlActive = false;
        this.#pointerAction = PointerAction.ROD_CONTROL_X;
        this.#clearLongPressTimeout();
      }
    }

    if (!this.#rodControlPointerActive) return;

    this.#rodControlCurrentX = this.#currentPointerX;
    const anchorX = Number(this.#rodControlAnchorX) || this.#startX;
    const controlDx = this.#rodControlCurrentX - anchorX;
    const fullPowerDistance = this.#getRodControlFullPowerDistancePx(config);
    this.#rodControlDirectionX = this.#resolveRodControlPointerDirection(
      controlDx,
      config,
    );
    const deadZone = Math.max(0, Number(config.directionDeadZonePx) || 12);
    this.#rodControlInputRatio = Math.max(
      0,
      Math.min(
        1,
        Math.abs(controlDx) < deadZone
          ? 0
          : Math.abs(controlDx) / fullPowerDistance,
      ),
    );
  }

  #resolveRodControlPointerDirection(deltaX, config) {
    const value = Number(deltaX) || 0;
    const abs = Math.abs(value);
    const deadZone = Math.max(0, Number(config.directionDeadZonePx) || 12);
    const switchDeadZone = Math.max(
      deadZone,
      Number(config.directionSwitchDeadZonePx) || 24,
    );
    const nextDirection = Math.sign(value);
    if (abs < deadZone) return this.#rodControlDirectionX || 0;
    if (
      this.#rodControlDirectionX !== 0 &&
      nextDirection !== this.#rodControlDirectionX &&
      abs < switchDeadZone
    ) {
      return this.#rodControlDirectionX;
    }
    return nextDirection;
  }

  #getRodControlInputConfig() {
    return (
      CONFIG.fightPhysicsConfig?.getRodControlConfig?.()?.input ||
      CONFIG.physics?.fight?.rodControl?.input ||
      {}
    );
  }

  #getRodControlFullPowerDistancePx(config) {
    const width =
      Number(this.#canvas?.clientWidth) ||
      Number(this.#canvas?.width) ||
      0;
    const ratio = Math.max(
      0,
      Number(config.screenWidthRatioForFullPower) || 0.1,
    );
    const fallback = Math.max(
      1,
      Number(config.fallbackFullPowerPx) || 50,
    );
    return Math.max(fallback, width * ratio);
  }

  consumeSwipe() {
    this.#hasSwipedThisTouch = true;
    this.#swipeDeltaY = 0;
  }

  getState() {
    const keys = CONFIG.input?.keys || {};
    const keyboardPulling = this.#checkKeyHeld(keys.pull);
    let keyboardRodDirectionX = 0;
    if (this.#checkKeyHeld(keys.left)) keyboardRodDirectionX -= 1;
    if (this.#checkKeyHeld(keys.right)) keyboardRodDirectionX += 1;
    const keyboardRodControlX = keyboardRodDirectionX !== 0;
    const keyboardRodRatio = this.#updateKeyboardRodControlRatio(
      keyboardRodControlX,
    );

    // Space/інша pull-клавіша має гарантовано працювати кожен кадр,
    // pointer-pull стартує тільки після pullHoldMinMs, якщо жест не став drag-control.
    const now = Date.now();
    this.#updatePointerPullState(now);
    const pointerHoldActive = this.#isPointerHoldActive(now);
    this.#isPulling = keyboardPulling || pointerHoldActive;

    if (keyboardPulling && !this.#isPointerDown) {
      this.#pullDirection.set(0, 1);
    }

    const state = this.#stateSnapshot;
    const rodControlActive =
      keyboardRodControlX || this.#rodControlPointerActive;
    state.isPulling = this.#isPulling;
    state.pointerHoldActive = pointerHoldActive;
    state.pullDirection = this.#pullDirection;
    state.panDeltaX = this.#panDeltaX;
    state.panDeltaY = this.#panDeltaY;
    state.swipeDeltaY = this.#swipeDeltaY;
    state.toggleHold = this.#holdToggleFlag;
    state.pumpAction = this.#pumpFlag;
    state.dragIncrease =
      !rodControlActive && this.#checkKeyHeld(keys.dragIncrease);
    state.dragDecrease =
      !rodControlActive && this.#checkKeyHeld(keys.dragDecrease);
    state.castPowerIncrease = state.dragIncrease;
    state.castPowerDecrease = state.dragDecrease;
    state.aimLeft = this.#checkKeyHeld(keys.left);
    state.aimRight = this.#checkKeyHeld(keys.right);

    // retrieve/recover не має бути активним у той самий кадр, що й pull.
    // На PC: Space = pull, відпускання Space = автоматичний recover.
    state.retrieve = !state.isPulling && this.#checkKeyHeld(keys.retrieve);
    state.clickPos = this.#clickPos;
    state.isDoubleClick = this.#isDoubleClick;
    state.longPressPos = this.#longPressPos;
    state.pointerDown = this.#isPointerDown;
    state.dragControlActive = this.#dragControlEnabled && this.#isDragControlActive;
    state.dragControlEnabled = this.#dragControlEnabled;
    state.pointerAction = this.#pointerAction;
    state.pointerStart.x = this.#startX;
    state.pointerStart.y = this.#startY;
    state.pointerCurrent.x = this.#currentPointerX;
    state.pointerCurrent.y = this.#currentPointerY;
    state.pointerDelta.x = this.#currentPointerX - this.#startX;
    state.pointerDelta.y = this.#currentPointerY - this.#startY;
    state.pointerReleased = this.#hasPointerRelease;
    state.pointerRelease.x = this.#releasePointerX;
    state.pointerRelease.y = this.#releasePointerY;
    state.rodControlActive = rodControlActive;
    state.rodControlDirectionX = keyboardRodControlX
      ? Math.sign(keyboardRodDirectionX)
      : this.#rodControlDirectionX;
    state.rodControlInputRatio = keyboardRodControlX
      ? keyboardRodRatio
      : this.#rodControlInputRatio;
    state.rodControlAnchorX = this.#rodControlAnchorX;
    state.rodControlCurrentX = this.#rodControlCurrentX;
    state.keys = this.#keys;
    state.fightActions = this.#composeFightActions(state);

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

  #composeFightActions(state) {
    const composer = this.#fightInputActionComposer;
    if (!composer?.compose) return null;
    const rodControlConfig = this.#getRodControlInputConfig();
    const previousFightActions = state.fightActions;
    state.fightActions = null;
    const nextFightActions = composer.compose(state, {
      keys: CONFIG.input?.keys || {},
      rodControlInput: rodControlConfig,
    });
    state.fightActions = previousFightActions;
    return nextFightActions;
  }

  #updateKeyboardRodControlRatio(active) {
    const now = Date.now();
    const previous = this.#lastKeyboardRodControlUpdateMs || now;
    const dtSec = Math.max(0, now - previous) / 1000;
    this.#lastKeyboardRodControlUpdateMs = now;
    const config = this.#getRodControlInputConfig();
    const upSeconds = Math.max(
      0.001,
      Number(config.keyboardRampUpSeconds) || 0.25,
    );
    const downSeconds = Math.max(
      0.001,
      Number(config.keyboardRampDownSeconds) || 0.18,
    );
    const rate = active ? 1 / upSeconds : 1 / downSeconds;
    const direction = active ? 1 : -1;
    this.#keyboardRodControlRatio = Math.max(
      0,
      Math.min(1, this.#keyboardRodControlRatio + direction * rate * dtSec),
    );
    return this.#keyboardRodControlRatio;
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

  static getActiveListenerCount() {
    return InputManager.#activeListenerCount;
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
