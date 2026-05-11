class CastPowerAim {
  #config;
  #projector;
  #getViewportSize;
  #panViewport;
  #rng;
  #active = false;
  #startX = 0;
  #startY = 0;
  #screenX = 0;
  #screenY = 0;
  #power = 0;
  #release = {
    active: false,
    screenX: 0,
    screenY: 0,
    startX: 0,
    startY: 0,
    power: 0,
    mode: "rod",
  };
  #visual = {
    active: false,
    screenX: 0,
    power: 0,
    mode: "rod",
  };
  #scratchA = new Vector2(0, 0);
  #scratchB = new Vector2(0, 0);
  #scratchC = new Vector2(0, 0);

  constructor({ config, projector, getViewportSize, panViewport, rng }) {
    this.#config = config;
    this.#projector = projector;
    this.#getViewportSize = getViewportSize;
    this.#panViewport = panViewport;
    this.#rng = rng;
  }

  reset() {
    this.#active = false;
    this.#power = 0;
    this.#release.active = false;
    this.#visual.active = false;
  }

  update(input, _bounds, dt, options = {}) {
    const cfg = this.#cfg();
    const mode = options.mode || "rod";
    this.#release.active = false;

    if (cfg.enabled === false) {
      this.reset();
      return null;
    }

    if (input?.pointerDown) {
      if (!this.#active) {
        this.#startX = input.pointerStart.x;
        this.#startY = input.pointerStart.y;
        this.#screenX = this.#clampScreenX(input.pointerStart.x);
        this.#screenY = input.pointerStart.y;
        this.#active = true;
      }

      this.#screenX = this.#clampScreenX(input.pointerCurrent.x);
      this.#screenY = input.pointerCurrent.y;
      this.#power = this.#calculatePower(this.#screenY);
      this.#applyEdgeScroll(this.#screenX, dt);
      this.#updateVisual(mode);
      return null;
    }

    if (this.#active && input?.pointerReleased) {
      this.#screenX = this.#clampScreenX(input.pointerRelease.x);
      this.#screenY = input.pointerRelease.y;
      this.#power = this.#calculatePower(this.#screenY);

      this.#release.active = true;
      this.#release.screenX = this.#screenX;
      this.#release.screenY = this.#screenY;
      this.#release.startX = this.#startX;
      this.#release.startY = this.#startY;
      this.#release.power = this.#power;
      this.#release.mode = mode;

      this.#active = false;
      this.#visual.active = false;
      return this.#release;
    }

    if (!input?.pointerReleased) {
      this.#visual.active = false;
    }
    return null;
  }

  getVisualState() {
    return this.#visual.active ? this.#visual : null;
  }

  resolveTarget(release, options) {
    if (!release?.active) return null;

    const bounds = options.bounds;
    const checkWater = options.checkWater;
    const canCastAnywhere = options.canCastAnywhere === true;
    const accuracyPx = Math.max(0, Number(options.accuracyPx) || 0);
    const maxDistance = this.#resolveMaxDistance(options.maxDistance, bounds);
    const distance = maxDistance * Math.max(0, Math.min(1, release.power));
    const origin = this.#projector.screenToVirtual(
      release.screenX,
      0,
      this.#scratchA,
    );

    const radiusPx = accuracyPx / 2;
    const mapTopScreenY = this.#projector.virtualToScreen(
      0,
      bounds.top,
      this.#scratchB,
    ).y;
    const mapBottomScreenY = this.#projector.virtualToScreen(
      0,
      bounds.bottom,
      this.#scratchC,
    ).y;
    const targetTopY = Math.max(bounds.top, bounds.bottom - distance);
    const targetTopScreenY = this.#projector.virtualToScreen(
      0,
      targetTopY,
      this.#scratchB,
    ).y;

    const minCenterY = mapTopScreenY + radiusPx;
    const maxCenterY = mapBottomScreenY - radiusPx;
    const centerY =
      maxCenterY >= minCenterY
        ? this.#clamp(targetTopScreenY + radiusPx, minCenterY, maxCenterY)
        : (mapTopScreenY + mapBottomScreenY) / 2;
    const centerX = release.screenX;

    const attempts = Math.max(1, this.#cfg().accuracyAttempts ?? 10);
    for (let i = 0; i < attempts; i++) {
      const sample = this.#sampleAccuracy(centerX, centerY, radiusPx);
      const virtualPos = this.#projector.screenToVirtual(
        sample.x,
        sample.y,
        this.#scratchB,
      );
      const cell = checkWater?.(virtualPos.x, virtualPos.y);
      if (cell || canCastAnywhere) {
        return this.#targetResult({
          virtualPos,
          cell,
          bounds,
          originX: origin.x,
          screenX: release.screenX,
          power: release.power,
          distance,
          maxDistance,
          canCastAnywhere,
        });
      }
    }

    const centerVirtual = this.#projector.screenToVirtual(
      centerX,
      centerY,
      this.#scratchB,
    );
    const centerCell = checkWater?.(centerVirtual.x, centerVirtual.y);
    if (centerCell || canCastAnywhere) {
      return this.#targetResult({
        virtualPos: centerVirtual,
        cell: centerCell,
        bounds,
        originX: origin.x,
        screenX: release.screenX,
        power: release.power,
        distance,
        maxDistance,
        canCastAnywhere,
      });
    }

    return {
      success: false,
      screenX: release.screenX,
      screenY: centerY,
      power: release.power,
    };
  }

  #targetResult({
    virtualPos,
    cell,
    bounds,
    originX,
    screenX,
    power,
    distance,
    maxDistance,
    canCastAnywhere,
  }) {
    const ratio = maxDistance > 0 ? Math.max(0, Math.min(1, distance / maxDistance)) : 0;
    return {
      success: true,
      x: virtualPos.x,
      y: virtualPos.y,
      depth: cell?.depth ?? (canCastAnywhere ? 2.0 : 0),
      originVirtualX: originX,
      originVirtualY: bounds.bottom,
      rodScreenX: screenX,
      power,
      castDistanceRatio: ratio,
      travelDelayMs: this.#travelDelayMs(ratio),
    };
  }

  #updateVisual(mode) {
    this.#visual.active = true;
    this.#visual.screenX = this.#screenX;
    this.#visual.power = this.#power;
    this.#visual.mode = mode;
  }

  #calculatePower(screenY) {
    const swipePx = Math.max(1, this.#cfg().powerSwipePx ?? 200);
    return this.#clamp((screenY - this.#startY) / swipePx, 0, 1);
  }

  #applyEdgeScroll(screenX, dt) {
    if (!this.#panViewport) return;
    const viewport = this.#getViewportSize?.();
    const width = Math.max(1, viewport?.width || 1);
    const cfg = this.#cfg();
    const centerRatio = this.#clamp(cfg.edgeScrollCenterRatio ?? 0.7, 0.1, 1);
    const edgeWidth = (width * (1 - centerRatio)) / 2;
    if (edgeWidth <= 0) return;

    let direction = 0;
    let edgeRatio = 0;
    if (screenX < edgeWidth) {
      direction = -1;
      edgeRatio = (edgeWidth - screenX) / edgeWidth;
    } else if (screenX > width - edgeWidth) {
      direction = 1;
      edgeRatio = (screenX - (width - edgeWidth)) / edgeWidth;
    }

    if (direction === 0) return;

    const easePower = Math.max(0.1, cfg.edgeScrollEasePower ?? 1.6);
    const maxSpeed = Math.max(0, cfg.edgeScrollMaxPxPerSecond ?? 900);
    const dtSec = Math.min(0.1, Math.max(0, dt / 1000));
    const delta =
      direction * maxSpeed * Math.pow(this.#clamp(edgeRatio, 0, 1), easePower) * dtSec;
    this.#panViewport(delta);
  }

  #sampleAccuracy(centerX, centerY, radiusPx) {
    if (radiusPx <= 0) return { x: centerX, y: centerY };
    const angle = this.#next() * Math.PI * 2;
    const radius = Math.sqrt(this.#next()) * radiusPx;
    return {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  }

  #resolveMaxDistance(maxDistance, bounds) {
    let resolved = Number(maxDistance);
    if (!Number.isFinite(resolved)) resolved = bounds.bottom - bounds.top;
    return Math.max(0, Math.min(resolved, bounds.bottom - bounds.top));
  }

  #travelDelayMs(ratio) {
    const cfg = this.#cfg();
    const min = Math.max(0, cfg.travelDelayMinMs ?? 180);
    const max = Math.max(min, cfg.travelDelayMaxMs ?? 950);
    return min + Math.max(0, Math.min(1, ratio)) * (max - min);
  }

  #clampScreenX(value) {
    const viewport = this.#getViewportSize?.();
    const width = Math.max(1, viewport?.width || 1);
    return this.#clamp(Number(value) || 0, 0, width);
  }

  #cfg() {
    return this.#config?.casting || {};
  }

  #next() {
    return this.#rng?.next ? this.#rng.next() : Math.random();
  }

  #clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}
