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
        this.#buildAimingZone(target, {
          bottom: intent.casting.virtualBottomY,
          maxDistance: intent.casting.maxDistance,
          mode: intent.casting.mode,
          clipRegions,
        });
      }
      if (intent.casting.accuracyPreview) {
        this.#buildAccuracy(target, intent.casting.accuracyPreview);
      }
      if (intent.casting.powerVisible) {
        this.#buildPowerAim(target, intent.casting);
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
        this.#buildAimingZone(target, {
          bottom: bounds.bottom,
          maxDistance: distance,
          mode: "chum",
          clipRegions,
        });
      }
      if (this.#config.debug?.casting?.showAccuracyArea) {
        this.#buildAccuracy(
          target,
          this.#chumSource.getAccuracyPreview(),
        );
      }
      this.#buildPowerAim(target, {
        visual,
        bounds: this.#chumSource.getBounds(),
        maxDistance: distance,
        nowMs: this.#chumSource.getNow(),
      });
      return;
    }
    if (
      this.#chumSource.getGameStateName() !== "scouting" &&
      !castingEnabled &&
      this.#config.locations?.showAimingZone !== false
    ) {
      this.#buildAimingZone(target, {
        bottom: this.#chumSource.getBounds().bottom,
        maxDistance: distance,
        mode: "chum",
        clipRegions,
      });
    }
  }

  #buildAimingZone(target, { bottom, maxDistance, mode, clipRegions }) {
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
    Object.assign(target.aimingZone, {
      visible: true,
      lineY,
      fillHeight: bottomY - lineY,
      viewportWidth: this.#canvasMetrics.width,
      mode,
      clipRegions,
    });
    target.visible = true;
  }

  #buildAccuracy(target, preview) {
    const radiusX = preview?.radiusX ?? preview?.radiusPx ?? 0;
    const radiusY = preview?.radiusY ?? preview?.radiusPx ?? 0;
    if (!preview?.active || radiusX <= 0 || radiusY <= 0) return;
    const debug = this.#config.debug?.casting || {};
    Object.assign(target.accuracyArea, {
      visible: true,
      x: preview.x,
      y: preview.y,
      radiusX,
      radiusY,
      fillColor:
        debug.accuracyAreaFill || "rgba(255, 255, 255, 0.08)",
      strokeColor:
        debug.accuracyAreaStroke || "rgba(255, 255, 255, 0.55)",
      lineWidth: debug.accuracyAreaLineWidth || 1,
      dash: debug.accuracyAreaDash || this.#defaultAccuracyDash,
    });
    target.visible = true;
  }

  #buildPowerAim(target, source) {
    const visual = source.visual;
    if (!visual?.active) return;
    const lineConfig = this.#config.casting?.aimLine || {};
    const bounds = source.bounds;
    const mapHeight = Math.max(0, bounds.bottom - bounds.top);
    let maxDistance = Number(source.maxDistance);
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
    Object.assign(target.powerAim, {
      visible: true,
      mode: visual.mode,
      screenX: visual.screenX,
      originY,
      targetY,
      powerRatio,
      viewportWidth: this.#canvasMetrics.width,
      lineColor:
        visual.mode === "chum"
          ? lineConfig.chumColor || "rgba(255, 180, 0, 0.9)"
          : lineConfig.color || "rgba(0, 220, 255, 0.85)",
      powerColor: this.#gradientColor(
        powerRatio * 100,
        tensionStyle.gradient,
      ),
      lineWidth: lineConfig.width || 2,
      dash,
      dashOffset:
        -(((source.nowMs / 1000) *
          (lineConfig.dashSpeedPxPerSecond ?? 42)) %
          dashCycle),
      glowBlur: lineConfig.glowBlur || 0,
    });
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
