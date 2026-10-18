import { Vector2 } from "../../../engine/math/vector2.js";

export class LandingAreaRenderFrameBuilder {
  #projector;
  #getWaterMetric;
  #config;
  #canvasMetrics;
  #getNet;
  #getRodScreenX;
  #landingPolicyResolver;
  #screenA = new Vector2(0, 0);
  #screenB = new Vector2(0, 0);
  #landingPolicyContext = { rod: null, reel: null };
  #landingDistanceContext = { rod: null, reel: null, config: null };

  constructor({
    projector,
    getWaterMetric,
    config,
    canvasMetrics,
    getNet,
    getRodScreenX,
    landingPolicyResolver,
  }) {
    this.#projector = projector;
    this.#getWaterMetric = getWaterMetric;
    this.#config = config;
    this.#canvasMetrics = canvasMetrics;
    this.#getNet = getNet;
    this.#getRodScreenX = getRodScreenX;
    this.#landingPolicyResolver = landingPolicyResolver;
  }

  // Landing distances are base pixels from the shore line (bottom); the water metric places them on the map.
  buildInto({ target, bottom, debug, equipment }) {
    const metric = this.#getWaterMetric();
    const locations = this.#config.locations || {};
    const scale = this.#projector.getScale();
    const catchY = this.#projector.virtualToScreen(
      0,
      bottom,
      this.#screenA,
    ).y;
    const width = this.#canvasMetrics.width;
    this.#landingPolicyContext.rod = equipment.rod;
    this.#landingPolicyContext.reel = equipment.reel;
    const policy = this.#landingPolicyResolver.resolve(this.#landingPolicyContext);
    this.#landingDistanceContext.rod = equipment.rod;
    this.#landingDistanceContext.reel = equipment.reel;
    this.#landingDistanceContext.config = this.#config;
    const landingDistance = policy.getLandingDistanceMeters(
      this.#landingDistanceContext,
    );
    const rodScreenX = Number(this.#getRodScreenX());
    const rodVirtual = this.#projector.screenToVirtual(
      Number.isFinite(rodScreenX) ? rodScreenX : width / 2,
      0,
      this.#screenB,
    );
    const pixelsPerMeter =
      this.#config.fightPhysicsConfig?.getPixelsPerMeter?.() || 50;
    const radiusBasePixels =
      Math.max(0, landingDistance) *
      Math.max(1, pixelsPerMeter);
    this.#buildCatchZone(
      target.catchZone,
      locations,
      rodVirtual.x,
      bottom,
      catchY,
      width,
      radiusBasePixels * metric.pixelsPerMeterX(bottom) / metric.pixelsPerMeter * scale,
      (bottom - metric.yAtBasePixels(radiusBasePixels)) * scale,
    );
    this.#buildLastDashZone(
      target.lastDashZone,
      locations,
      debug,
      metric,
      catchY,
      width,
      pixelsPerMeter,
    );
    this.#buildNetZone(
      target.netZone,
      locations,
      metric,
      catchY,
      width,
    );
  }

  #buildCatchZone(
    target,
    locations,
    rodVirtualX,
    bottom,
    catchY,
    width,
    radius,
    radiusY,
  ) {
    if (locations.showCatchZone === false) return;
    target.visible = true;
    if (radius > 0) {
      const center = this.#projector.virtualToScreen(
        rodVirtualX,
        bottom,
        this.#screenA,
      );
      target.kind = "ellipse";
      target.x = center.x;
      target.y = center.y;
      target.radiusX = radius;
      target.radiusY = radiusY;
      return;
    }
    target.kind = "band";
    target.y = catchY;
    target.lineY = Math.min(catchY, this.#canvasMetrics.height - 2);
    target.width = width;
    target.height = Math.max(0, this.#canvasMetrics.height - catchY);
  }

  #buildLastDashZone(
    target,
    locations,
    debug,
    metric,
    catchY,
    width,
    pixelsPerMeter,
  ) {
    const distance = Math.max(
      0,
      Number(debug?.lastDash?.triggerDistanceMeters) || 0,
    );
    if (locations.showLastDashZone !== true || distance <= 0) return;
    const triggerY = this.#projector.virtualToScreen(
      0,
      metric.yAtBasePixels(distance * pixelsPerMeter),
      this.#screenA,
    ).y;
    target.visible = true;
    target.y = Math.max(0, Math.min(triggerY, catchY));
    target.width = width;
    target.height = Math.max(0, catchY - target.y);
  }

  #buildNetZone(target, locations, metric, catchY, width) {
    const net = this.#getNet();
    if (locations.showNetZone === false || !net?.isActive) return;
    const triggerY = this.#projector.virtualToScreen(
      0,
      net.getTriggerVirtualY(metric),
      this.#screenA,
    ).y;
    target.visible = true;
    target.y = triggerY;
    target.width = width;
    target.height = Math.max(0, catchY - triggerY);
  }
}
