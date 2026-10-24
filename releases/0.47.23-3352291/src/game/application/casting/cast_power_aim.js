import { Vector2 } from "../../../engine/math/vector2.js";

export class CastPowerAim {
  #config;
  #projector;
  #getWaterMetric;
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
  #keyboardActive = false;
  #leadSource;
  #rampSource;
  #maxLeadPx = 80;
  #rampDistancePx = 100;
  // TK-091: where the pointer was when this gesture's own edge pan stopped the camera at a limit; null = viewport centre.
  #leftLeadOriginX = null;
  #rightLeadOriginX = null;
  #leadOriginWidth = 0;
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

  constructor({ config, projector, getWaterMetric, getViewportSize, panViewport, rng }) {
    this.#config = config;
    this.#projector = projector;
    this.#getWaterMetric = getWaterMetric;
    this.#getViewportSize = getViewportSize;
    this.#panViewport = panViewport;
    this.#rng = rng;
  }

  reset() {
    this.#active = false;
    this.#keyboardActive = false;
    this.#power = 0;
    this.#release.active = false;
    this.#visual.active = false;
    this.#clearLeadOrigins();
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
        this.#clearLeadOrigins();
        this.#screenX = this.#clampScreenX(input.pointerStart.x);
        this.#screenY = input.pointerStart.y;
        this.#active = true;
      }

      this.#screenX = this.#pointerScreenX(input.pointerCurrent.x);
      this.#screenY = input.pointerCurrent.y;
      this.#updateStartY(this.#screenY, dt);
      this.#power = this.#calculatePower(this.#screenY);
      if (this.#applyEdgeScroll(this.#screenX, dt)) {
        this.#screenX = this.#pointerScreenX(input.pointerCurrent.x);
      }
      this.#updateVisual(mode);
      return null;
    }

    if (this.#active && input?.pointerReleased) {
      this.#screenX = this.#pointerScreenX(input.pointerRelease.x);
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
      this.#keyboardActive = false;
      this.#visual.active = false;
      return this.#release;
    }

    const keyboardHeld = !!input?.isPulling;
    if (keyboardHeld) {
      if (!this.#active || !this.#keyboardActive) {
        this.#startKeyboardAim();
      }

      this.#keyboardActive = true;
      this.#applyKeyboardControls(input, dt);
      this.#applyEdgeScroll(this.#screenX, dt);
      this.#updateVisual(mode);
      return null;
    }

    if (this.#active && this.#keyboardActive) {
      this.#release.active = true;
      this.#release.screenX = this.#screenX;
      this.#release.screenY = this.#screenY;
      this.#release.startX = this.#startX;
      this.#release.startY = this.#startY;
      this.#release.power = this.#power;
      this.#release.mode = mode;

      this.#active = false;
      this.#keyboardActive = false;
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
    const metric = this.#getWaterMetric();
    const resolvedMaxDistance = this.#resolveMaxDistance(maxDistance, metric);
    const distance =
      resolvedMaxDistance * Math.max(0, Math.min(1, this.#visual.power));
    const baseRadiusPx =
      this.#resolveAccuracyDiameter(
        accuracyPx,
        accuracyPercent,
        metric.virtualPixelsFromShore(distance),
        accuracyMultiplier,
      ) / 2;
    const area = this.#getAccuracyAreaScreen(
      metric,
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
    const metric = this.#getWaterMetric();
    const maxDistance = this.#resolveMaxDistance(options.maxDistance, metric);
    const distance = maxDistance * Math.max(0, Math.min(1, release.power));
    const accuracyPx = this.#resolveAccuracyDiameter(
      options.accuracyPx,
      options.accuracyPercent,
      metric.virtualPixelsFromShore(distance),
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
      metric,
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
      if (
        !this.#isWithinCastDistance(
          metric,
          virtualPos,
          originX,
          bounds.bottom,
          distance,
        )
      ) {
        continue;
      }
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
    if (
      this.#isWithinCastDistance(
        metric,
        centerVirtual,
        originX,
        bounds.bottom,
        distance,
      ) && (centerCell || canCastAnywhere)
    ) {
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

  #isWithinCastDistance(metric, virtualPos, originX, originY, distance) {
    const maxDistance = Math.max(0, Number(distance) || 0);
    if (maxDistance <= 0) return false;
    return metric.distanceBasePixels(virtualPos.x, virtualPos.y, originX, originY) <= maxDistance + 0.001;
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

  #startKeyboardAim() {
    const viewport = this.#getViewportSize?.() || {};
    const width = Math.max(1, viewport.width || 1);
    const height = Math.max(1, viewport.height || 1);
    this.#startX = width / 2;
    this.#startY = height / 2;
    this.#initialStartY = this.#startY;
    this.#clearLeadOrigins();
    this.#screenX = this.#clampScreenX(this.#startX);
    this.#screenY = this.#startY;
    this.#power = this.#clamp(Number(this.#cfg().keyboardInitialPower) || 0, 0, 1);
    this.#active = true;
  }

  #applyKeyboardControls(input, dt) {
    const dtSec = Math.min(0.1, Math.max(0, (Number(dt) || 0) / 1000));
    const powerDirection =
      (input?.castPowerIncrease || input?.dragIncrease ? 1 : 0) -
      (input?.castPowerDecrease || input?.dragDecrease ? 1 : 0);
    const powerSpeed = Math.max(
      0,
      Number(this.#cfg().keyboardPowerChangePerSecond) || 0.75,
    );
    if (powerDirection !== 0) {
      this.#power = this.#clamp(
        this.#power + powerDirection * powerSpeed * dtSec,
        0,
        1,
      );
    }

    const aimDirection =
      (input?.aimRight ? 1 : 0) -
      (input?.aimLeft ? 1 : 0);
    const aimSpeed = Math.max(
      0,
      Number(this.#cfg().keyboardAimSpeedPxPerSecond) || 420,
    );
    if (aimDirection !== 0) {
      this.#screenX = this.#clampScreenX(
        this.#screenX + aimDirection * aimSpeed * dtSec,
      );
    }
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
    const wasAtEdge = this.#isAtEdge(direction);
    this.#panViewport(delta);
    // TK-091: this pan stopped the camera at its limit, so the lead on that side starts from the pointer here (zero
    // now, growing as the pointer goes on) instead of jumping to its value for the pointer's distance from the centre.
    if (!wasAtEdge && this.#isAtEdge(direction)) {
      const centreX = width / 2;
      if (direction < 0) this.#leftLeadOriginX = Math.min(centreX, screenX);
      else this.#rightLeadOriginX = Math.max(centreX, screenX);
      this.#leadOriginWidth = width;
    }
    return delta !== 0;
  }

  #isAtEdge(direction) {
    return this.#projector?.isAtHorizontalEdge?.(direction) === true;
  }

  #clearLeadOrigins() {
    this.#leftLeadOriginX = null;
    this.#rightLeadOriginX = null;
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

  // Cast distances are base pixels (ground metres times pixelsPerMeter), bounded by the far edge of the water.
  #resolveMaxDistance(maxDistance, metric) {
    let resolved = Number(maxDistance);
    if (!Number.isFinite(resolved)) resolved = metric.topBasePixels;
    return Math.max(0, Math.min(resolved, metric.topBasePixels));
  }

  #getAccuracyAreaScreen(metric, bounds, maxDistance, power, screenX, baseRadiusPx) {
    const resolvedMaxDistance = this.#resolveMaxDistance(maxDistance, metric);
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
    const targetTopY = Math.max(bounds.top, metric.yAtBasePixels(distance));
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

  // The accuracy spread lives in map pixels, apart from the water metric: a distance-based spread is a share of the
  // map height the cast covers (the distance on the map, not in metres).
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

  #pointerScreenX(value) {
    const cfg = this.#cfg().pointerAim;
    const lead = cfg?.maxLeadPx ?? 80;
    const ramp = cfg?.rampDistancePx ?? 100;
    if (!Object.is(lead, this.#leadSource) || !Object.is(ramp, this.#rampSource)) {
      this.#leadSource = lead;
      this.#rampSource = ramp;
      this.#maxLeadPx = Number.isFinite(lead) ? Math.max(0, lead) : 80;
      this.#rampDistancePx = Number.isFinite(ramp) ? Math.max(1, ramp) : 100;
    }
    const viewport = this.#getViewportSize?.();
    const width = Math.max(1, viewport?.width || 1);
    const pointerX = Number.isFinite(value) ? value : this.#startX;
    const atLeft = this.#isAtEdge(-1);
    const atRight = this.#isAtEdge(1);
    if (!atLeft || width !== this.#leadOriginWidth) this.#leftLeadOriginX = null;
    if (!atRight || width !== this.#leadOriginWidth) this.#rightLeadOriginX = null;
    const centreX = width / 2;
    const leftOriginX = this.#leftLeadOriginX ?? centreX;
    const rightOriginX = this.#rightLeadOriginX ?? centreX;
    let leadPx = 0;
    if (atLeft && pointerX < leftOriginX) leadPx = -this.#leadFor(leftOriginX - pointerX);
    else if (atRight && pointerX > rightOriginX) leadPx = this.#leadFor(pointerX - rightOriginX);
    return this.#clamp(pointerX + leadPx, 0, width);
  }

  #leadFor(distancePx) {
    const q = Math.min(1, distancePx / this.#rampDistancePx);
    return this.#maxLeadPx * q * q * (3 - 2 * q);
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
