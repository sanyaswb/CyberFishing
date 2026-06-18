class CastingRenderFrameBuilder {
  #projector;
  #config;
  #canvasMetrics;
  #hudStyleResolver;
  #chumSource;
  #screenA = new Vector2(0, 0);
  #screenB = new Vector2(0, 0);
  #defaultDash = Object.freeze([12, 10]);
  #defaultAccuracyDash = Object.freeze([6, 6]);

  constructor({
    projector,
    config,
    canvasMetrics,
    hudStyleResolver,
    chumSource,
  }) {
    if (!projector || typeof projector.virtualToScreen !== "function") {
      throw new TypeError("CastingRenderFrameBuilder requires projector");
    }
    if (!hudStyleResolver || typeof hudStyleResolver.resolveBarStyle !== "function") {
      throw new TypeError(
        "CastingRenderFrameBuilder requires hudStyleResolver",
      );
    }
    const requiredChumMethods = [
      "isAiming",
      "getEquipment",
      "getGameStateName",
      "getCastDistance",
      "getPowerAimVisual",
      "getAccuracyPreview",
      "getBounds",
      "getNow",
    ];
    for (const method of requiredChumMethods) {
      if (!chumSource || typeof chumSource[method] !== "function") {
        throw new TypeError(
          `CastingRenderFrameBuilder requires chumSource.${method}`,
        );
      }
    }
    this.#projector = projector;
    this.#config = config;
    this.#canvasMetrics = canvasMetrics;
    this.#hudStyleResolver = hudStyleResolver;
    this.#chumSource = chumSource;
  }

  buildInto({ target, intent, clipRegions }) {
    if (intent.casting.visible) {
      if (intent.casting.zoneVisible) {
        this.#buildAimingZone(
          target,
          intent.casting.virtualBottomY,
          intent.casting.maxDistance,
          intent.casting.mode,
          clipRegions,
        );
      }
      if (intent.casting.accuracyPreview) {
        this.#buildAccuracy(target, intent.casting.accuracyPreview);
      }
      if (intent.casting.powerVisible) {
        this.#buildPowerAim(
          target,
          intent.casting.visual,
          intent.casting.bounds,
          intent.casting.maxDistance,
          intent.casting.nowMs,
        );
      }
    }
    this.#buildChumAim(target, clipRegions);
  }

  #buildChumAim(target, clipRegions) {
    if (!this.#chumSource.isAiming()) return;
    const equipment = this.#chumSource.getEquipment();
    if (equipment.delivery) return;
    const castingEnabled = this.#config.casting?.enabled !== false;
    const distance = this.#chumSource.getCastDistance();
    const visual = this.#chumSource.getPowerAimVisual();
    if (visual && castingEnabled) {
      if (this.#config.debug?.casting?.showChumDistanceLine) {
        const bounds = this.#chumSource.getBounds();
        this.#buildAimingZone(
          target,
          bounds.bottom,
          distance,
          "chum",
          clipRegions,
        );
      }
      if (this.#config.debug?.casting?.showAccuracyArea) {
        this.#buildAccuracy(
          target,
          this.#chumSource.getAccuracyPreview(),
        );
      }
      this.#buildPowerAim(
        target,
        visual,
        this.#chumSource.getBounds(),
        distance,
        this.#chumSource.getNow(),
      );
      return;
    }
    if (
      this.#chumSource.getGameStateName() !== "scouting" &&
      !castingEnabled &&
      this.#config.locations?.showAimingZone !== false
    ) {
      this.#buildAimingZone(
        target,
        this.#chumSource.getBounds().bottom,
        distance,
        "chum",
        clipRegions,
      );
    }
  }

  #buildAimingZone(target, bottom, maxDistance, mode, clipRegions) {
    if (maxDistance === Infinity) return;
    const lineVirtualY = bottom - maxDistance;
    const lineY = this.#projector.virtualToScreen(
      0,
      lineVirtualY,
      this.#screenA,
    ).y;
    const bottomY = this.#projector.virtualToScreen(
      0,
      bottom,
      this.#screenB,
    ).y;
    target.aimingZone.visible = true;
    target.aimingZone.lineY = lineY;
    target.aimingZone.fillHeight = bottomY - lineY;
    target.aimingZone.viewportWidth = this.#canvasMetrics.width;
    target.aimingZone.mode = mode;
    target.aimingZone.clipRegions = clipRegions;
    target.visible = true;
  }

  #buildAccuracy(target, preview) {
    const radiusX = preview?.radiusX ?? preview?.radiusPx ?? 0;
    const radiusY = preview?.radiusY ?? preview?.radiusPx ?? 0;
    if (!preview?.active || radiusX <= 0 || radiusY <= 0) return;
    const debug = this.#config.debug?.casting || {};
    target.accuracyArea.visible = true;
    target.accuracyArea.x = preview.x;
    target.accuracyArea.y = preview.y;
    target.accuracyArea.radiusX = radiusX;
    target.accuracyArea.radiusY = radiusY;
    target.accuracyArea.fillColor =
      debug.accuracyAreaFill || "rgba(255, 255, 255, 0.08)";
    target.accuracyArea.strokeColor =
      debug.accuracyAreaStroke || "rgba(255, 255, 255, 0.55)";
    target.accuracyArea.lineWidth = debug.accuracyAreaLineWidth || 1;
    target.accuracyArea.dash =
      debug.accuracyAreaDash || this.#defaultAccuracyDash;
    target.visible = true;
  }

  #buildPowerAim(target, visual, bounds, maxDistance, nowMs) {
    if (!visual?.active) return;
    const lineConfig = this.#config.casting?.aimLine || {};
    const mapHeight = Math.max(0, bounds.bottom - bounds.top);
    maxDistance = Number(maxDistance);
    if (!Number.isFinite(maxDistance)) maxDistance = mapHeight;
    const powerRatio = RenderMath.clamp(visual.power);
    const linePower = lineConfig.fullDistance === false ? powerRatio : 1;
    const distance =
      Math.max(0, Math.min(maxDistance, mapHeight)) * linePower;
    const originY = this.#projector.virtualToScreen(
      0,
      bounds.bottom,
      this.#screenB,
    ).y;
    const targetY = this.#projector.virtualToScreen(
      0,
      Math.max(bounds.top, bounds.bottom - distance),
      this.#screenA,
    ).y;
    const dash = Array.isArray(lineConfig.dash)
      ? lineConfig.dash
      : this.#defaultDash;
    const dashCycle = Math.max(1, dash[0] + (dash[1] || 0));
    const tensionStyle = this.#hudStyleResolver.resolveBarStyle("tension");
    target.powerAim.visible = true;
    target.powerAim.mode = visual.mode;
    target.powerAim.screenX = visual.screenX;
    target.powerAim.originY = originY;
    target.powerAim.targetY = targetY;
    target.powerAim.powerRatio = powerRatio;
    target.powerAim.viewportWidth = this.#canvasMetrics.width;
    target.powerAim.lineColor =
      visual.mode === "chum"
        ? lineConfig.chumColor || "rgba(255, 180, 0, 0.9)"
        : lineConfig.color || "rgba(0, 220, 255, 0.85)";
    target.powerAim.powerColor = this.#gradientColor(
      powerRatio * 100,
      tensionStyle.gradient,
    );
    target.powerAim.lineWidth = lineConfig.width || 2;
    target.powerAim.dash = dash;
    target.powerAim.dashOffset =
      -(((nowMs / 1000) *
        (lineConfig.dashSpeedPxPerSecond ?? 42)) %
        dashCycle);
    target.powerAim.glowBlur = lineConfig.glowBlur || 0;
    target.visible = true;
  }

  #gradientColor(value, gradient) {
    if (!gradient) return "#00ccff";
    const low = gradient.breakpoints?.low ?? 33;
    const mid = gradient.breakpoints?.mid ?? 66;
    if (value < low) {
      return RenderMath.interpolateRgb(
        gradient.low?.start || [0, 0, 255],
        gradient.low?.end || [255, 255, 0],
        value / low,
      );
    }
    if (value < mid) {
      return RenderMath.interpolateRgb(
        gradient.mid?.start || [255, 255, 0],
        gradient.mid?.end || [255, 128, 0],
        (value - low) / Math.max(1, mid - low),
      );
    }
    return RenderMath.interpolateRgb(
      gradient.high?.start || [255, 128, 0],
      gradient.high?.end || [255, 0, 0],
      (value - mid) / Math.max(1, 100 - mid),
    );
  }
}
