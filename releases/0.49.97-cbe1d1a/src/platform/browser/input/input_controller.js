import { Vector2 } from "../../../engine/math/vector2.js";

export const PointerAction = Object.freeze({
  IDLE: "idle",
  PENDING: "pending",
  PAN: "pan",
  PULL: "pull",
  DRAG_CONTROL: "drag_control",
  ROD_CONTROL_X: "rod_control_x",
});

export class InputController {
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
  #pointerReleaseCancelled = false;
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
  #pointerGestureId;
  #keys = {};
  #isDoubleClick = false;
  #longPressPos = null;
  #hasLongPressed = false;
  #lastClickTime = 0;
  #longPressTimeout = null;
  #listeners;
  #dragControlEnabled = true;
  #fightInputActionComposer = null;
  #stateSnapshot;
  #runtimeConfig;
  #pointerPanEnabled = false;
  #pointerPanGesture = false;
  #panGestureX = 0;
  #activePointerId = null;
  #getOriginX;

  // getOriginX: the canvas left edge in page pixels (the landscape split strip, spec 098); world input is canvas-relative.
  constructor(canvas, anchorX = null, { runtimeConfig, listeners, fightInputActionComposer = null, getOriginX = () => 0 } = {}) {
    this.#getOriginX = getOriginX;
    this.#listeners = listeners;
    this.#runtimeConfig = runtimeConfig;
    this.#canvas = canvas;
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
    this.#pointerGestureId = 0;
    this.#fightInputActionComposer = fightInputActionComposer;
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
      pointerPanning: false,
      dragControlActive: false,
      dragControlEnabled: true,
      pointerAction: PointerAction.IDLE,
      pointerStart: { x: 0, y: 0 },
      pointerCurrent: { x: 0, y: 0 },
      pointerDelta: { x: 0, y: 0 },
      pointerGestureId: 0,
      pointerReleased: false,
      pointerReleaseCancelled: false,
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

  setDragControlEnabled(enabled) {
    this.#dragControlEnabled = enabled !== false;
    if (!this.#dragControlEnabled) {
      this.#isDragControlActive = false;
      if (this.#pointerAction === PointerAction.DRAG_CONTROL) {
        this.#pointerAction = this.#isPointerDown ? PointerAction.PENDING : PointerAction.IDLE;
      }
    }
  }

  setPointerPanEnabled(enabled) {
    this.#pointerPanEnabled = enabled === true;
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

  #eventX(e) {
    return e.clientX - this.#getOriginX();
  }

  #addEventListener(target, type, handler, options) {
    this.#listeners.add(target, type, handler, options);
  }

  #bindEvents() {
    this.#addEventListener(this.#canvas, "pointerdown", (e) => {
      if (this.#isPointerDown || (e.button !== undefined && e.button !== 0)) return;
      this.#activePointerId = e.pointerId ?? null;
      this.#pointerPanGesture = this.#pointerPanEnabled;
      this.#panGestureX = 0;
      // A gesture that starts on the scene keeps its pointer over HUD controls,
      // for aiming and fighting as well as map navigation.
      if (this.#activePointerId !== null) {
        this.#canvas.setPointerCapture?.(this.#activePointerId);
      }
      this.#pointerGestureId += 1;
      this.#isPointerDown = true;
      this.#isPulling = false;
      this.#isDragging = false;
      this.#isDragControlActive = false;
      this.#pointerAction = PointerAction.PENDING;
      this.#pointerDownAtMs = Date.now();
      this.#startX = this.#eventX(e);
      this.#startY = e.clientY;
      this.#lastPointerX = this.#eventX(e);
      this.#lastPointerY = e.clientY;
      this.#currentPointerX = this.#eventX(e);
      this.#currentPointerY = e.clientY;
      this.#hasPointerRelease = false;
      this.#pointerReleaseCancelled = false;
      this.#rodControlPointerActive = false;
      this.#rodControlAnchorX = this.#eventX(e);
      this.#rodControlCurrentX = this.#eventX(e);
      this.#rodControlDirectionX = 0;
      this.#rodControlInputRatio = 0;
      this.#lastKeyboardRodControlUpdateMs = Date.now();
      this.#swipeDeltaY = 0;
      this.#hasSwipedThisTouch = false;
      this.#hasLongPressed = false;
      this.#updateDirection(e);

      this.#clearLongPressTimeout();
      if (this.#pointerPanGesture) return;
      this.#longPressTimeout = setTimeout(() => {
        if (this.#canTriggerLongPress()) {
          this.#longPressPos = {
            x: this.#currentPointerX,
            y: this.#currentPointerY,
          };
          this.#hasLongPressed = true;
        }
      }, this.#runtimeConfig.input?.longPressMs ?? 650);
    });

    this.#addEventListener(this.#canvas, "pointermove", (e) => {
      if (!this.#isPointerDown) return;
      if (this.#activePointerId !== null && e.pointerId !== undefined && e.pointerId !== this.#activePointerId) return;

      if (this.#pointerPanGesture) {
        this.#updateMapPointer(this.#eventX(e), e.clientY);
        return;
      }

      this.#currentPointerX = this.#eventX(e);
      this.#currentPointerY = e.clientY;

      const dist = Math.hypot(
        this.#eventX(e) - this.#startX,
        e.clientY - this.#startY,
      );
      if (dist > 5) {
        this.#isDragging = true;
        if (dist > this.#getLongPressMoveTolerancePx()) {
          this.#clearLongPressTimeout();
        }
      }

      if (this.#isDragging) {
        this.#panDeltaX += this.#lastPointerX - this.#eventX(e);
        this.#panDeltaY += this.#lastPointerY - e.clientY;

        if (!this.#hasSwipedThisTouch) {
          this.#swipeDeltaY = this.#startY - e.clientY;
        }

        this.#lastPointerX = this.#eventX(e);
        this.#lastPointerY = e.clientY;
      }

      this.#updateRodControlPointerState();
      this.#updateDragControlState();
      if (this.#isDragControlActive) this.#clearLongPressTimeout();
      this.#updatePointerPullState(Date.now());
      this.#updateDirection(e);
    });

    const resetInput = (e) => {
      if (this.#activePointerId !== null && e?.pointerId !== undefined && e.pointerId !== this.#activePointerId) return;
      // Pointer Events own captured touch gestures; another finger's touchend
      // must not finish the primary pointer's navigation.
      if (this.#pointerPanGesture && this.#activePointerId !== null && e?.type === "touchend") return;
      if (this.#longPressTimeout) clearTimeout(this.#longPressTimeout);

      const isPointerEvent =
        e &&
        (e.type === "pointerup" ||
          e.type === "touchend" ||
          e.type === "pointercancel");

      if (isPointerEvent) {
        this.#pointerReleaseCancelled = e.type === "pointercancel";
        if (this.#isPointerDown) {
          const now = Date.now();
          const holdMs = Math.max(0, Number(this.#runtimeConfig.input?.pullHoldMinMs) || 0);
          const elapsedMs = Math.max(0, now - Number(this.#pointerDownAtMs || now));
          const pointerWasClickCandidate =
            this.#pointerAction === PointerAction.PENDING &&
            (this.#pointerPanGesture || elapsedMs < holdMs);
          const rawClientX =
            e.clientX ?? (e.changedTouches && e.changedTouches[0]?.clientX);
          const clientX = rawClientX === undefined ? undefined : rawClientX - this.#getOriginX();
          const clientY =
            e.clientY ?? (e.changedTouches && e.changedTouches[0]?.clientY);

          if (clientX !== undefined && clientY !== undefined) {
            if (this.#pointerPanGesture && !this.#pointerReleaseCancelled) {
              this.#updateMapPointer(clientX, clientY);
            }
            this.#releasePointerX = clientX;
            this.#releasePointerY = clientY;
            this.#currentPointerX = clientX;
            this.#currentPointerY = clientY;
            this.#hasPointerRelease = true;
          }

          // A stationary navigation press can become a click regardless of its
          // duration; fishing holds, drags and cancellations cannot.
          if (pointerWasClickCandidate && !this.#pointerReleaseCancelled && !this.#isDragging && !this.#hasLongPressed) {
            if (now - this.#lastClickTime < 300) {
              this.#isDoubleClick = true;
            } else {

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
        this.#releasePointerCapture();
      }

      const pullKeys = this.#runtimeConfig.input?.keys?.pull || ["Space"];
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
      this.#pointerPanGesture = false;
      this.#panDeltaX = 0;
      this.#panDeltaY = 0;
      this.#clickPos = null;
      this.#isDoubleClick = false;
      this.#longPressPos = null;
      this.#hasPointerRelease = false;
      this.#releasePointerCapture();
      resetInput();
    });

    this.#addEventListener(this.#canvas, "wheel", (e) => {
      if (!this.#pointerPanEnabled || this.#isPointerDown || e.ctrlKey) return;
      const config = this.#runtimeConfig.input?.mapPan || {};
      const unit = e.deltaMode === 1
        ? Math.max(0, Number(config.wheelStepPx ?? 40) || 0)
        : e.deltaMode === 2 ? this.#canvas.clientWidth : 1;
      const delta = e.deltaX || e.deltaY || 0;
      this.#panDeltaX += delta * unit * this.#getPanSensitivity() * (config.inverted === false ? -1 : 1);
      e.preventDefault();
    }, { passive: false });

    this.#addEventListener(window, "keydown", (e) => {
      this.#keys[e.code] = true;
      this.#keys[e.key] = true;

      const keys = this.#runtimeConfig.input?.keys || {};

      if (this.#isKeyMatch(e, keys.pull)) {
        this.#isPulling = true;
        if (e.code === "Space" || e.key === " ") e.preventDefault();
      }

      if (this.#isKeyMatch(e, keys.hold)) {
        if (!e.repeat) this.#holdToggleFlag = true;
      }

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

      const keys = this.#runtimeConfig.input?.keys || {};

      if (this.#isKeyMatch(e, keys.pull)) {
        // Keep pulling while another pull key is still pressed.
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
        const dx = this.#eventX(e) - this.#startX;

        const dy = this.#runtimeConfig.input?.swipeResistanceY ?? 200;

        const length = Math.hypot(dx, dy);
        if (length > 0) {
          this.#pullDirection.set(dx / length, dy / length);
        }
      } else {
        this.#pullDirection.set(0, 1);
      }
    }
  }

  #getPanSensitivity() {
    const value = Number(this.#runtimeConfig.input?.mapPan?.sensitivity ?? 1);
    return Number.isFinite(value) ? Math.max(0, value) : 1;
  }

  #updateMapPointer(x, y) {
    this.#currentPointerX = x;
    this.#currentPointerY = y;
    const configuredThreshold = Number(this.#runtimeConfig.input?.pointerThreshold ?? 10);
    const threshold = Number.isFinite(configuredThreshold) ? Math.max(0, configuredThreshold) : 10;
    if (!this.#isDragging && Math.hypot(x - this.#startX, y - this.#startY) > threshold) {
      this.#isDragging = true;
      this.#pointerAction = PointerAction.PAN;
      this.#clearLongPressTimeout();
    }
    if (!this.#isDragging) return;
    const config = this.#runtimeConfig.input?.mapPan || {};
    let distance = (x - this.#startX) * this.#getPanSensitivity() * (config.inverted === false ? 1 : -1);
    const limit = Math.max(0, Number(config.maxDistancePx) || 0);
    if (limit > 0) distance = Math.max(-limit, Math.min(limit, distance));
    this.#panDeltaX += distance - this.#panGestureX;
    this.#panGestureX = distance;
  }

  #releasePointerCapture() {
    if (this.#activePointerId !== null && this.#canvas.hasPointerCapture?.(this.#activePointerId)) {
      this.#canvas.releasePointerCapture(this.#activePointerId);
    }
    this.#activePointerId = null;
  }

  #updateDragControlState() {
    if (!this.#dragControlEnabled) return;
    if (!this.#isPointerDown || this.#isDragControlActive) return;
    if (this.#pointerAction === PointerAction.PULL) return;
    if (this.#rodControlPointerActive) return;

    const dx = this.#currentPointerX - this.#startX;
    const dy = this.#currentPointerY - this.#startY;
    const threshold =
      Number(this.#runtimeConfig.input?.dragControlActivationPx) ||
      Number(
        this.#runtimeConfig.fightPhysicsConfig?.getReelDragConfig?.()
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
      Number(this.#runtimeConfig.input?.longPressMoveTolerancePx) ||
        Number(this.#runtimeConfig.input?.dragControlActivationPx) ||
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

    if (this.#pointerPanGesture) {
      this.#isPulling = false;
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

    const holdMs = Math.max(0, Number(this.#runtimeConfig.input?.pullHoldMinMs) || 0);
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
      const holdMs = Math.max(0, Number(this.#runtimeConfig.input?.pullHoldMinMs) || 0);
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
      this.#runtimeConfig.fightPhysicsConfig?.getRodControlConfig?.()?.input ||
      this.#runtimeConfig.physics?.fight?.rodControl?.input ||
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

  getPointerGestureId() {
    return this.#pointerGestureId;
  }

  getState() {
    const keys = this.#runtimeConfig.input?.keys || {};
    const keyboardPulling = this.#checkKeyHeld(keys.pull);
    let keyboardRodDirectionX = 0;
    if (this.#checkKeyHeld(keys.left)) keyboardRodDirectionX -= 1;
    if (this.#checkKeyHeld(keys.right)) keyboardRodDirectionX += 1;
    const keyboardRodControlX = keyboardRodDirectionX !== 0;
    const keyboardRodRatio = this.#updateKeyboardRodControlRatio(
      keyboardRodControlX,
    );

    // Keyboard pull stays active each frame;
    // pointer pull waits for pullHoldMinMs unless the gesture becomes drag control.
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

    // Retrieve/recover must not overlap pull in the same frame.
    // On PC, Space pulls; releasing it enables automatic recovery.
    state.retrieve = !state.isPulling && this.#checkKeyHeld(keys.retrieve);
    state.clickPos = this.#clickPos;
    state.isDoubleClick = this.#isDoubleClick;
    state.longPressPos = this.#longPressPos;
    state.pointerDown = this.#isPointerDown;
    state.pointerPanning = this.#pointerPanGesture;
    state.dragControlActive = this.#dragControlEnabled && this.#isDragControlActive;
    state.dragControlEnabled = this.#dragControlEnabled;
    state.pointerAction = this.#pointerAction;
    state.pointerStart.x = this.#startX;
    state.pointerStart.y = this.#startY;
    state.pointerCurrent.x = this.#currentPointerX;
    state.pointerCurrent.y = this.#currentPointerY;
    state.pointerDelta.x = this.#currentPointerX - this.#startX;
    state.pointerDelta.y = this.#currentPointerY - this.#startY;
    state.pointerGestureId = this.#pointerGestureId;
    state.pointerReleased = this.#hasPointerRelease;
    state.pointerReleaseCancelled = this.#pointerReleaseCancelled;
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
    this.#pointerReleaseCancelled = false;
    if (!this.#isPointerDown) this.#pointerPanGesture = false;

    return state;
  }

  #composeFightActions(state) {
    const composer = this.#fightInputActionComposer;
    if (!composer?.compose) return null;
    const rodControlConfig = this.#getRodControlInputConfig();
    const previousFightActions = state.fightActions;
    state.fightActions = null;
    const nextFightActions = composer.compose(state, {
      keys: this.#runtimeConfig.input?.keys || {},
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
    this.#releasePointerCapture();
    if (this.#longPressTimeout) {
      clearTimeout(this.#longPressTimeout);
      this.#longPressTimeout = null;
    }
    this.#listeners.dispose();
  }
}

