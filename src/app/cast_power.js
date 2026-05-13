class CastPowerAim {
  #config;
  #projector;
  #getViewportSize;
  #panViewport;
  #rng;
  #active = false;
  #startX = 0;
  #startY = 0;
  #initialStartY = 0;
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
        this.#initialStartY = input.pointerStart.y;
        this.#screenX = this.#clampScreenX(input.pointerStart.x);
        this.#screenY = input.pointerStart.y;
        this.#active = true;
      }

      this.#screenX = this.#clampScreenX(input.pointerCurrent.x);
      this.#screenY = input.pointerCurrent.y;
      this.#updateStartY(this.#screenY, dt);
      this.#power = this.#calculatePower(this.#screenY);
      this.#applyEdgeScroll(this.#screenX, dt);
      this.#updateVisual(mode);
      return null;
    }

    if (this.#active && input?.pointerReleased) {
      this.#screenX = this.#clampScreenX(input.pointerRelease.x);
      this.#screenY = input.pointerRelease.y;
      this.#updateStartY(this.#screenY, 0);
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

  getAccuracyPreview(
    bounds,
    maxDistance,
    accuracyPx,
    accuracyPercent = null,
    accuracyMultiplier = null,
  ) {
    if (!this.#visual.active) return null;
    const resolvedMaxDistance = this.#resolveMaxDistance(maxDistance, bounds);
    const distance =
      resolvedMaxDistance * Math.max(0, Math.min(1, this.#visual.power));
    const baseRadiusPx =
      this.#resolveAccuracyDiameter(
        accuracyPx,
        accuracyPercent,
        distance,
        accuracyMultiplier,
      ) / 2;
    const area = this.#getAccuracyAreaScreen(
      bounds,
      maxDistance,
      this.#visual.power,
      this.#visual.screenX,
      baseRadiusPx,
    );
    return {
      active: true,
      x: area.x,
      y: area.y,
      radiusPx: baseRadiusPx,
      radiusX: area.radiusX,
      radiusY: area.radiusY,
      mode: this.#visual.mode,
    };
  }

  resolveTarget(release, options) {
    if (!release?.active) return null;

    const bounds = options.bounds;
    const checkWater = options.checkWater;
    const canCastAnywhere = options.canCastAnywhere === true;
    const maxDistance = this.#resolveMaxDistance(options.maxDistance, bounds);
    const distance = maxDistance * Math.max(0, Math.min(1, release.power));
    const accuracyPx = this.#resolveAccuracyDiameter(
      options.accuracyPx,
      options.accuracyPercent,
      distance,
      options.accuracyMultiplier,
    );
    const origin = this.#projector.screenToVirtual(
      release.screenX,
      0,
      this.#scratchA,
    );
    const originX = origin.x;

    const baseRadiusPx = accuracyPx / 2;
    const area = this.#getAccuracyAreaScreen(
      bounds,
      maxDistance,
      release.power,
      release.screenX,
      baseRadiusPx,
    );
    const centerX = area.x;
    const centerY = area.y;

    const attempts = Math.max(1, this.#cfg().accuracyAttempts ?? 10);
    for (let i = 0; i < attempts; i++) {
      const sample = this.#sampleAccuracy(
        centerX,
        centerY,
        area.radiusX,
        area.radiusY,
      );
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
          originX,
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
        originX,
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
    const ratio =
      maxDistance > 0 ? Math.max(0, Math.min(1, distance / maxDistance)) : 0;
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
    const deadzonePx = this.#resolvePowerDeadzonePx(swipePx);
    const dragPx = screenY - this.#startY;
    if (dragPx <= deadzonePx) return 0;
    return this.#clamp((dragPx - deadzonePx) / swipePx, 0, 1);
  }

  #updateStartY(screenY, dt) {
    if (screenY < this.#startY) {
      this.#startY = screenY;
      return;
    }

    if (this.#startY >= this.#initialStartY) return;

    const swipePx = Math.max(1, this.#cfg().powerSwipePx ?? 200);
    const deadzonePx = this.#resolvePowerDeadzonePx(swipePx);
    const fullPowerY = this.#startY + deadzonePx + swipePx;
    if (screenY <= fullPowerY) return;

    const overshootPx = screenY - fullPowerY;
    const targetY = Math.min(this.#initialStartY, this.#startY + overshootPx);
    const speed = Math.max(
      0,
      Number(this.#cfg().powerAnchorReturnPxPerSecond) || swipePx * 6,
    );
    const dtSec = Math.min(0.1, Math.max(0, dt / 1000));
    const maxStep = dtSec > 0 ? speed * dtSec : targetY - this.#startY;
    this.#startY = Math.min(targetY, this.#startY + maxStep);
  }

  #resolvePowerDeadzonePx(swipePx) {
    const cfg = this.#cfg();
    const explicitPx = Number(cfg.powerDeadzonePx);
    if (Number.isFinite(explicitPx) && explicitPx >= 0) return explicitPx;

    const ratio = Number(cfg.powerDeadzoneRatio ?? 0);
    if (!Number.isFinite(ratio) || ratio <= 0) return 0;
    return swipePx * this.#clamp(ratio, 0, 1);
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

  #sampleAccuracy(centerX, centerY, radiusX, radiusY) {
    if (radiusX <= 0 || radiusY <= 0) return { x: centerX, y: centerY };
    const angle = this.#next() * Math.PI * 2;
    const radius = Math.sqrt(this.#next());
    return {
      x: centerX + Math.cos(angle) * radius * radiusX,
      y: centerY + Math.sin(angle) * radius * radiusY,
    };
  }

  #resolveMaxDistance(maxDistance, bounds) {
    let resolved = Number(maxDistance);
    if (!Number.isFinite(resolved)) resolved = bounds.bottom - bounds.top;
    return Math.max(0, Math.min(resolved, bounds.bottom - bounds.top));
  }

  #getAccuracyAreaScreen(bounds, maxDistance, power, screenX, baseRadiusPx) {
    const resolvedMaxDistance = this.#resolveMaxDistance(maxDistance, bounds);
    const distance = resolvedMaxDistance * Math.max(0, Math.min(1, power));
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

    const initialRadii = this.#getPerspectiveRadii(targetTopY, baseRadiusPx);
    let minCenterY = mapTopScreenY + initialRadii.radiusY;
    let maxCenterY = mapBottomScreenY - initialRadii.radiusY;
    let centerY =
      maxCenterY >= minCenterY
        ? this.#clamp(
            targetTopScreenY + initialRadii.radiusY,
            minCenterY,
            maxCenterY,
          )
        : (mapTopScreenY + mapBottomScreenY) / 2;

    const centerVirtual = this.#projector.screenToVirtual(
      screenX,
      centerY,
      this.#scratchA,
    );
    const radii = this.#getPerspectiveRadii(centerVirtual.y, baseRadiusPx);
    minCenterY = mapTopScreenY + radii.radiusY;
    maxCenterY = mapBottomScreenY - radii.radiusY;
    centerY =
      maxCenterY >= minCenterY
        ? this.#clamp(targetTopScreenY + radii.radiusY, minCenterY, maxCenterY)
        : (mapTopScreenY + mapBottomScreenY) / 2;

    return {
      x: screenX,
      y: centerY,
      radiusX: radii.radiusX,
      radiusY: radii.radiusY,
    };
  }

  #getPerspectiveRadii(virtualY, baseRadiusPx) {
    const perspective = this.#projector.getPerspective?.(virtualY) || {
      scale: 1,
      squashY: 1,
    };
    const scale = Math.max(0, Number(perspective.scale) || 0);
    const squashY = Math.max(0, Number(perspective.squashY) || 0);
    const radiusX = baseRadiusPx * scale * this.#projector.getScale();
    return {
      radiusX,
      radiusY: radiusX * squashY,
    };
  }

  #resolveAccuracyDiameter(
    fallbackPx,
    percentValue,
    distance,
    multiplierValue,
  ) {
    const percent = this.#normalizePercent(
      percentValue ?? this.#cfg().accuracyDistancePercent,
    );
    const multiplier = this.#normalizeMultiplier(
      multiplierValue ?? this.#cfg().accuracyDistanceMultiplier,
    );
    if (percent !== null) return Math.max(0, distance * percent * multiplier);
    return Math.max(0, Number(fallbackPx) || 0);
  }

  #normalizeMultiplier(value) {
    const raw = Number(value);
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  }

  #normalizePercent(value) {
    const raw = Number(value);
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return raw > 1 ? raw / 100 : raw;
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
