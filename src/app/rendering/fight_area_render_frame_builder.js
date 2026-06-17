class FightAreaRenderFrameBuilder {
  #projector;
  #config;
  #canvasMetrics;
  #getRodScreenX;
  #landingAreaBuilder;
  #sectorGeometry;
  #screenA = new Vector2(0, 0);
  #origin = { x: 0, y: 0 };

  constructor({
    projector,
    config,
    canvasMetrics,
    getRodScreenX,
    landingAreaBuilder,
    sectorGeometry,
  }) {
    if (
      !landingAreaBuilder ||
      typeof landingAreaBuilder.buildInto !== "function"
    ) {
      throw new TypeError(
        "FightAreaRenderFrameBuilder requires landingAreaBuilder",
      );
    }
    if (!sectorGeometry || typeof sectorGeometry.resolve !== "function") {
      throw new TypeError(
        "FightAreaRenderFrameBuilder requires sectorGeometry",
      );
    }
    this.#projector = projector;
    this.#config = config;
    this.#canvasMetrics = canvasMetrics;
    this.#getRodScreenX = getRodScreenX;
    this.#landingAreaBuilder = landingAreaBuilder;
    this.#sectorGeometry = sectorGeometry;
  }

  buildInto({
    target,
    clipRegions,
    state,
    bottom,
    fightDebug,
    equipment,
    floatVirtualPosition,
  }) {
    const locations = this.#config.locations || {};
    if (!locations.debugVisuals) return;
    target.visible = true;
    target.clipRegions = clipRegions;
    this.#landingAreaBuilder.buildInto({
      target,
      bottom,
      debug: fightDebug,
      equipment,
    });
    this.#buildSector(
      target,
      state,
      bottom,
      fightDebug,
      floatVirtualPosition,
    );
  }

  #buildSector(target, state, bottom, debug, floatPosition) {
    const locations = this.#config.locations || {};
    target.showSector = locations.showPoleFightSector === true;
    target.showLineRadius = locations.showFightLineRadius === true;
    if (!target.showSector && !target.showLineRadius) return;
    const geometry = this.#resolveGeometry(
      state,
      bottom,
      debug,
      floatPosition,
    );
    if (!geometry) return;

    const originX = geometry.poleFightSectorOriginX;
    const originY = geometry.poleFightSectorOriginY;
    const apexX = geometry.poleFightSectorApexX;
    const apexY = geometry.poleFightSectorApexY;
    const radius = geometry.poleFightSectorLimitRadiusPx;
    const leftAngle = this.#resolveBoundaryAngle(
      geometry.poleFightSectorLeftBoundaryRadiusIntersectionX,
      geometry.poleFightSectorLeftBoundaryRadiusIntersectionY,
      originX,
      originY,
      -geometry.poleFightSectorMaxAngleDeg,
    );
    const rightAngle = this.#resolveBoundaryAngle(
      geometry.poleFightSectorRightBoundaryRadiusIntersectionX,
      geometry.poleFightSectorRightBoundaryRadiusIntersectionY,
      originX,
      originY,
      geometry.poleFightSectorMaxAngleDeg,
    );
    const apex = this.#projector.virtualToScreen(
      apexX,
      apexY,
      this.#screenA,
    );
    target.apexX = apex.x;
    target.apexY = apex.y;
    target.sectorClamped =
      geometry.poleFightSectorClamped === true;
    Object.assign(target.sectorPoints.acquire(), {
      x: apex.x,
      y: apex.y,
    });
    for (let index = 0; index <= 64; index += 1) {
      const angle =
        (leftAngle + (rightAngle - leftAngle) * (index / 64)) *
        Math.PI /
        180;
      const point = this.#projector.virtualToScreen(
        originX + Math.sin(angle) * radius,
        originY - Math.cos(angle) * radius,
        this.#screenA,
      );
      Object.assign(target.sectorPoints.acquire(), {
        x: point.x,
        y: point.y,
      });
    }
    const axisEnd = this.#projector.virtualToScreen(
      originX,
      originY - radius,
      this.#screenA,
    );
    target.axisEndX = axisEnd.x;
    target.axisEndY = axisEnd.y;

    for (let index = 0; index <= 64; index += 1) {
      const angle = (-90 + 180 * (index / 64)) * Math.PI / 180;
      const point = this.#projector.virtualToScreen(
        originX + Math.sin(angle) * radius,
        originY - Math.cos(angle) * radius,
        this.#screenA,
      );
      Object.assign(target.lineRadiusPoints.acquire(), {
        x: point.x,
        y: point.y,
      });
    }
  }

  #resolveGeometry(state, bottom, debug, floatPosition) {
    if (
      debug?.poleFightSectorActive === true &&
      Number(debug.poleFightSectorLimitRadiusPx) > 0
    ) {
      return debug;
    }
    if (!floatPosition || state === "playing") return null;
    const rodScreenX = Number(this.#getRodScreenX());
    const origin = this.#projector.screenToVirtual(
      Number.isFinite(rodScreenX)
        ? rodScreenX
        : this.#canvasMetrics.width / 2,
      0,
      this.#screenA,
    );
    this.#origin.x = origin.x;
    this.#origin.y = bottom;
    const limitRadius = Math.hypot(
      floatPosition.x - this.#origin.x,
      floatPosition.y - this.#origin.y,
    );
    const config =
      this.#config.fightPhysicsConfig?.getPoleFightSectorConfig?.() ||
      this.#config.physics?.fight?.poleFightSector ||
      {};
    const geometry = this.#sectorGeometry.resolve({
      origin: this.#origin,
      config,
      limitRadiusPx: limitRadius,
      pixelsPerMeter:
        this.#config.fightPhysicsConfig?.getPixelsPerMeter?.() || 50,
    });
    if (!geometry.active) return null;
    return {
      poleFightSectorOriginX: geometry.originX,
      poleFightSectorOriginY: geometry.originY,
      poleFightSectorApexX: geometry.sectorApexX,
      poleFightSectorApexY: geometry.sectorApexY,
      poleFightSectorMaxAngleDeg: geometry.maxAngleFromCenterDeg,
      poleFightSectorLimitRadiusPx: geometry.limitRadiusPx,
      poleFightSectorLeftBoundaryRadiusIntersectionX:
        geometry.leftBoundaryRadiusIntersectionX,
      poleFightSectorLeftBoundaryRadiusIntersectionY:
        geometry.leftBoundaryRadiusIntersectionY,
      poleFightSectorRightBoundaryRadiusIntersectionX:
        geometry.rightBoundaryRadiusIntersectionX,
      poleFightSectorRightBoundaryRadiusIntersectionY:
        geometry.rightBoundaryRadiusIntersectionY,
      poleFightSectorClamped: false,
    };
  }

  #resolveBoundaryAngle(x, y, originX, originY, fallback) {
    if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) {
      return fallback;
    }
    return Math.atan2(x - originX, -(y - originY)) * 180 / Math.PI;
  }
}
