class LandingAreaRenderFrameBuilder {
  #projector;
  #config;
  #canvasMetrics;
  #getNet;
  #getRodScreenX;
  #landingPolicyResolver;
  #screenA = new Vector2(0, 0);
  #screenB = new Vector2(0, 0);

  constructor({
    projector,
    config,
    canvasMetrics,
    getNet,
    getRodScreenX,
    landingPolicyResolver,
  }) {
    this.#projector = projector;
    this.#config = config;
    this.#canvasMetrics = canvasMetrics;
    this.#getNet = getNet;
    this.#getRodScreenX = getRodScreenX;
    this.#landingPolicyResolver = landingPolicyResolver;
  }

  buildInto({ target, bottom, debug, equipment }) {
    const locations = this.#config.locations || {};
    const scale = this.#projector.getScale();
    const catchVirtualY =
      bottom - (locations.catchLineOffsetPx ?? 5) / scale;
    const catchY = this.#projector.virtualToScreen(
      0,
      catchVirtualY,
      this.#screenA,
    ).y;
    const width = this.#canvasMetrics.width;
    const policy = this.#landingPolicyResolver.resolve({
      rod: equipment.rod,
      reel: equipment.reel,
    });
    const landingDistance = policy.getLandingDistanceMeters({
      rod: equipment.rod,
      reel: equipment.reel,
      config: this.#config,
    });
    const rodScreenX = Number(this.#getRodScreenX());
    const rodVirtual = this.#projector.screenToVirtual(
      Number.isFinite(rodScreenX) ? rodScreenX : width / 2,
      0,
      this.#screenB,
    );
    const pixelsPerMeter =
      this.#config.fightPhysicsConfig?.getPixelsPerMeter?.() || 50;
    const radius =
      Math.max(0, landingDistance) *
      Math.max(1, pixelsPerMeter) *
      scale;
    this.#buildCatchZone(
      target.catchZone,
      locations,
      rodVirtual.x,
      bottom,
      catchY,
      width,
      radius,
    );
    this.#buildLastDashZone(
      target.lastDashZone,
      locations,
      debug,
      bottom,
      catchY,
      width,
      pixelsPerMeter,
    );
    this.#buildNetZone(
      target.netZone,
      locations,
      bottom,
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
      target.radiusY = radius;
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
    bottom,
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
      bottom - distance * pixelsPerMeter,
      this.#screenA,
    ).y;
    target.visible = true;
    target.y = Math.max(0, Math.min(triggerY, catchY));
    target.width = width;
    target.height = Math.max(0, catchY - target.y);
  }

  #buildNetZone(target, locations, bottom, catchY, width) {
    const net = this.#getNet();
    if (locations.showNetZone === false || !net?.isActive) return;
    const triggerY = this.#projector.virtualToScreen(
      0,
      net.getTriggerVirtualY(bottom),
      this.#screenA,
    ).y;
    target.visible = true;
    target.y = triggerY;
    target.width = width;
    target.height = Math.max(0, catchY - triggerY);
  }
}
