import { Vector2 } from "../../../engine/math/vector2.js";

export class FightAreaRenderFrameBuilder {
  #projector;
  #getWaterMetric;
  #metric = null;
  #config;
  #canvasMetrics;
  #getRodScreenX;
  #landingAreaBuilder;
  #sectorGeometry;
  #screenA = new Vector2(0, 0);
  #virtual = new Vector2(0, 0);
  #plane = new Vector2(0, 0);
  #origin = { x: 0, y: 0 };
  #landingContext = {
    target: null,
    bottom: 0,
    debug: null,
    equipment: null,
  };
  #previewGeometry = {
    poleFightSectorOriginX: 0,
    poleFightSectorOriginY: 0,
    poleFightSectorApexX: 0,
    poleFightSectorApexY: 0,
    poleFightSectorMaxAngleDeg: 0,
    poleFightSectorLimitRadiusPx: 0,
    poleFightSectorLeftBoundaryRadiusIntersectionX: 0,
    poleFightSectorLeftBoundaryRadiusIntersectionY: 0,
    poleFightSectorRightBoundaryRadiusIntersectionX: 0,
    poleFightSectorRightBoundaryRadiusIntersectionY: 0,
    poleFightSectorClamped: false,
  };

  constructor({
    projector,
    getWaterMetric,
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
    this.#getWaterMetric = getWaterMetric;
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
    this.#metric = this.#getWaterMetric();
    const landingContext = this.#landingContext;
    landingContext.target = target;
    landingContext.bottom = bottom;
    landingContext.debug = fightDebug;
    landingContext.equipment = equipment;
    this.#landingAreaBuilder.buildInto(landingContext);
    this.#buildSector(
      target,
      state,
      bottom,
      fightDebug,
      floatVirtualPosition,
    );
  }

  // The sector geometry lies on the water metric's ground plane (the fight frame is computed there); its points are
  // mapped to the map before projection, so a far line radius is no longer a circle on screen.
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
    const apex = this.#planeToScreen(apexX, apexY);
    target.apexX = apex.x;
    target.apexY = apex.y;
    target.sectorClamped =
      geometry.poleFightSectorClamped === true;
    let record = target.sectorPoints.acquire();
    record.x = apex.x;
    record.y = apex.y;
    for (let index = 0; index <= 64; index += 1) {
      const angle =
        (leftAngle + (rightAngle - leftAngle) * (index / 64)) *
        Math.PI /
        180;
      const point = this.#planeToScreen(
        originX + Math.sin(angle) * radius,
        originY - Math.cos(angle) * radius,
      );
      record = target.sectorPoints.acquire();
      record.x = point.x;
      record.y = point.y;
    }
    const axisEnd = this.#planeToScreen(originX, originY - radius);
    target.axisEndX = axisEnd.x;
    target.axisEndY = axisEnd.y;

    for (let index = 0; index <= 64; index += 1) {
      const angle = (-90 + 180 * (index / 64)) * Math.PI / 180;
      const point = this.#planeToScreen(
        originX + Math.sin(angle) * radius,
        originY - Math.cos(angle) * radius,
      );
      record = target.lineRadiusPoints.acquire();
      record.x = point.x;
      record.y = point.y;
    }
  }

  // The sector's geometry from the rod on the shore line: before a fight its radius is the rod-to-float distance; in a
  // fight (TK-071) the fight frame gives only whether the sector is active and its radius (the released line), so the
  // same geometry is built here with that radius. The fight frame carries no geometry points.
  #resolveGeometry(state, bottom, debug, floatPosition) {
    const fightRadius = debug?.poleFightSectorActive === true ? Number(debug.poleFightSectorLimitRadiusPx) : 0;
    const fighting = fightRadius > 0;
    if (!fighting && (!floatPosition || state === "playing")) return null;
    const rodScreenX = Number(this.#getRodScreenX());
    const origin = this.#projector.screenToVirtual(
      Number.isFinite(rodScreenX)
        ? rodScreenX
        : this.#canvasMetrics.width / 2,
      0,
      this.#screenA,
    );
    this.#metric.toBasePlane(origin.x, bottom, this.#origin);
    let limitRadius = fightRadius;
    if (!fighting) {
      const floatPlane = this.#metric.toBasePlane(floatPosition.x, floatPosition.y, this.#plane);
      limitRadius = Math.hypot(floatPlane.x - this.#origin.x, floatPlane.y - this.#origin.y);
    }
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
    const frame = this.#previewGeometry;
    frame.poleFightSectorOriginX = geometry.originX;
    frame.poleFightSectorOriginY = geometry.originY;
    frame.poleFightSectorApexX = geometry.sectorApexX;
    frame.poleFightSectorApexY = geometry.sectorApexY;
    frame.poleFightSectorMaxAngleDeg = geometry.maxAngleFromCenterDeg;
    frame.poleFightSectorLimitRadiusPx = geometry.limitRadiusPx;
    frame.poleFightSectorLeftBoundaryRadiusIntersectionX =
      geometry.leftBoundaryRadiusIntersectionX;
    frame.poleFightSectorLeftBoundaryRadiusIntersectionY =
      geometry.leftBoundaryRadiusIntersectionY;
    frame.poleFightSectorRightBoundaryRadiusIntersectionX =
      geometry.rightBoundaryRadiusIntersectionX;
    frame.poleFightSectorRightBoundaryRadiusIntersectionY =
      geometry.rightBoundaryRadiusIntersectionY;
    frame.poleFightSectorClamped = false;
    return frame;
  }

  #planeToScreen(x, y) {
    const virtual = this.#metric.fromBasePlane(x, y, this.#virtual);
    return this.#projector.virtualToScreen(virtual.x, virtual.y, this.#screenA);
  }

  #resolveBoundaryAngle(x, y, originX, originY, fallback) {
    if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) {
      return fallback;
    }
    return Math.atan2(x - originX, -(y - originY)) * 180 / Math.PI;
  }
}
