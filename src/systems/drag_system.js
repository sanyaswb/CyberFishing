class DragSystem {
  #value = 0;
  #targetValue = 0;
  #changeSpeed = 1.5;
  #config;
  #gestureActive = false;
  #dragSupported = false;
  #gestureStartY = 0;
  #gestureStartValue = 0;

  constructor(config = {}, reel = null) {
    this.#config = config || {};
    this.updateEquipment(reel);
  }

  updateEquipment(reel) {
    this.#dragSupported = !!reel?.hasReel?.() && reel?.hasDrag?.() !== false;
    const reelSpeed =
      reel?.getDragChangeSpeedPerSec?.() ??
      reel?.dragChangeSpeedPerSec ??
      reel?.engineStats?.dragChangeSpeedPerSec;

    this.#changeSpeed =
      Number(reelSpeed) || Number(this.#config.changeSpeedPerSec) || 1.5;

    this.#value = this.#clamp(this.#value);
    this.#targetValue = this.#clamp(this.#targetValue);
  }

  update(input, dtSec) {
    if (!this.#dragSupported) {
      this.#resetGesture();
      this.#targetValue = this.#clamp(this.#targetValue);
      this.#value = this.#targetValue;
      return this.#value;
    }

    this.#updateFromPointer(input, dtSec);
    this.#updateFromKeyboard(input, dtSec);

    this.#value = this.#targetValue;
    return this.#value;
  }

  applySwipe(deltaY, thresholdPx = 80) {
    // Backward-compatible fallback for older callers. The main path now uses
    // update(input, dtSec) and pointerStart / pointerCurrent, exactly like cast power.
    if (!deltaY || Math.abs(deltaY) < thresholdPx) return false;

    const swipePx = this.#swipePx();
    const normalizedDelta = -Number(deltaY) / swipePx;
    this.#targetValue = this.#clamp(this.#targetValue + normalizedDelta);
    this.#value = this.#targetValue;
    return true;
  }

  setValue(value) {
    this.#targetValue = this.#clamp(value);
    this.#value = this.#targetValue;
    this.#resetGesture();
  }

  get value() {
    return this.#value;
  }

  get targetValue() {
    return this.#targetValue;
  }

  isSupported() {
    return this.#dragSupported;
  }

  getDebugData() {
    return {
      dragSupported: this.#dragSupported,
      dragRatio: this.#value,
      dragPercent: this.#value * 100,
      dragGestureActive: this.#gestureActive,
    };
  }

  #updateFromKeyboard(input, dtSec) {
    let direction = 0;
    if (input?.dragIncrease) direction += 1;
    if (input?.dragDecrease) direction -= 1;
    if (direction === 0) return;

    const step = Math.max(0, this.#changeSpeed) * Math.max(0, Number(dtSec) || 0);
    if (step <= 0) return;

    this.#targetValue = this.#clamp(this.#targetValue + direction * step);
    this.#gestureStartValue = this.#targetValue;
  }

  #updateFromPointer(input, dtSec) {
    if (this.#config.pointerControlEnabled === false) {
      this.#resetGesture();
      return;
    }

    if (!input?.dragControlActive) {
      this.#resetGesture();
      return;
    }

    const currentY = Number(input.pointerCurrent?.y ?? input.pointerStart?.y);
    if (!Number.isFinite(currentY)) return;

    if (!this.#gestureActive) {
      this.#gestureActive = true;
      this.#gestureStartY = Number(input.pointerStart?.y ?? currentY) || currentY;
      this.#gestureStartValue = this.#targetValue;
    }

    this.#updateGestureAnchor(currentY, dtSec);

    const deltaRatio = this.#calculateDragDeltaRatio(currentY);
    this.#targetValue = this.#clamp(this.#gestureStartValue + deltaRatio);
  }

  #calculateDragDeltaRatio(screenY) {
    const swipePx = this.#swipePx();
    const deadzonePx = this.#deadzonePx(swipePx);
    const dragPx = Number(screenY) - this.#gestureStartY;

    if (Math.abs(dragPx) <= deadzonePx) return 0;

    if (dragPx > 0) {
      return (dragPx - deadzonePx) / swipePx;
    }

    return (dragPx + deadzonePx) / swipePx;
  }

  #updateGestureAnchor(screenY, dtSec) {
    const swipePx = this.#swipePx();
    const deadzonePx = this.#deadzonePx(swipePx);
    const speed = Math.max(
      0,
      Number(this.#config.powerAnchorReturnPxPerSecond) || swipePx * 6,
    );
    const dt = Math.min(0.1, Math.max(0, Number(dtSec) || 0));
    const maxStep = speed * dt;

    const minValue = this.#min();
    const maxValue = this.#max();
    const upLimitY =
      this.#gestureStartY - deadzonePx - swipePx * (this.#gestureStartValue - minValue);
    const downLimitY =
      this.#gestureStartY + deadzonePx + swipePx * (maxValue - this.#gestureStartValue);

    if (screenY > downLimitY) {
      const overshoot = screenY - downLimitY;
      const shift = maxStep > 0 ? Math.min(overshoot, maxStep) : overshoot;
      this.#gestureStartY += shift;
      this.#gestureStartValue = maxValue;
      return;
    }

    if (screenY < upLimitY) {
      const overshoot = upLimitY - screenY;
      const shift = maxStep > 0 ? Math.min(overshoot, maxStep) : overshoot;
      this.#gestureStartY -= shift;
      this.#gestureStartValue = minValue;
    }
  }

  #resetGesture() {
    this.#gestureActive = false;
  }

  #swipePx() {
    return Math.max(
      1,
      Number(this.#config.powerSwipePx) || Number(this.#config.dragSwipePx) || 200,
    );
  }

  #deadzonePx(swipePx) {
    const explicitPx = Number(this.#config.powerDeadzonePx);
    if (Number.isFinite(explicitPx) && explicitPx >= 0) return explicitPx;

    const ratio = Number(this.#config.powerDeadzoneRatio ?? 0);
    if (!Number.isFinite(ratio) || ratio <= 0) return 0;
    return swipePx * this.#clamp01(ratio);
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  #min() {
    return Number(this.#config.minRatio) || 0;
  }

  #max() {
    return Number.isFinite(Number(this.#config.maxRatio))
      ? Number(this.#config.maxRatio)
      : 1;
  }

  #clamp(value) {
    return Math.max(this.#min(), Math.min(this.#max(), Number(value) || 0));
  }
}
