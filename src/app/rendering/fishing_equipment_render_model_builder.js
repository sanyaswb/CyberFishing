class FishingEquipmentRenderModelBuilder {
  #projector;
  #canvasMetrics;
  #clock;
  #config;
  #getRodScreenX;

  constructor({
    projector,
    canvasMetrics,
    clock,
    config,
    getRodScreenX,
  }) {
    if (typeof getRodScreenX !== "function") {
      throw new TypeError(
        "FishingEquipmentRenderModelBuilder requires getRodScreenX",
      );
    }
    this.#projector = projector;
    this.#canvasMetrics = canvasMetrics;
    this.#clock = clock;
    this.#config = config;
    this.#getRodScreenX = getRodScreenX;
  }

  buildRodLine({
    target,
    floatPosition,
    state,
    tension,
    lineFrame,
  }) {
    const rodConfig = this.#config.ui?.rod || {};
    const lineConfig = this.#config.ui?.line || {};
    const rodWidth = 3;
    const rodHeight = 200;
    const configuredX =
      rodConfig.x === "center"
        ? this.#canvasMetrics.width / 2
        : Number(rodConfig.x);
    const overrideX = Number(this.#getRodScreenX());
    const rodBaseX = Number.isFinite(overrideX)
      ? overrideX
      : Number.isFinite(configuredX)
        ? configuredX
        : this.#canvasMetrics.width / 2;
    const rodBaseY =
      this.#canvasMetrics.height - (rodConfig.yOffset || 0);
    const rodTopY = rodBaseY - rodHeight;
    const targetX =
      rodBaseX + (floatPosition.x - rodBaseX) * lineFrame.renderRatio;
    const targetY =
      rodTopY +
      (floatPosition.y - rodTopY) * lineFrame.renderRatio +
      lineFrame.renderDrop;
    let lineColor = lineConfig.color || "rgba(255, 255, 255, 0.3)";
    let lineWidth = lineConfig.width || 1;
    if (state === "playing" && tension >= 100) {
      lineColor =
        Math.floor(this.#clock.now / 80) % 2 === 0
          ? "rgba(255, 0, 0, 0.9)"
          : "rgba(255, 255, 255, 0.9)";
      lineWidth = Math.max(lineWidth, 2);
    } else if (state === "playing" && tension >= 90) {
      const intensity = (tension - 90) / 10;
      lineColor =
        `rgba(${Math.floor(150 + 105 * intensity)}, 0, 0, ` +
        `${0.5 + 0.4 * intensity})`;
      lineWidth = Math.max(lineWidth, 1.5);
    }
    const straightY = (rodTopY + targetY) / 2;
    const slackY =
      Math.max(rodTopY, targetY) + (lineConfig.sagOffset || 60);
    target.visible = true;
    target.rodBaseX = rodBaseX;
    target.rodTopY = rodTopY;
    target.rodWidth = rodWidth;
    target.rodHeight = rodHeight;
    target.lineVisible = lineConfig.visible !== false;
    target.targetX = targetX;
    target.targetY = targetY;
    target.controlX = (rodBaseX + targetX) / 2;
    target.controlY =
      slackY + (straightY - slackY) * lineFrame.straightFactor;
    target.lineColor = lineColor;
    target.lineWidth = lineWidth;
  }

  buildFloat({ target, screenPosition, floatEntity, equipment }) {
    const visual = floatEntity.getVisualState();
    const scale = this.#projector.getPerspective(
      floatEntity.getPosition().y,
    ).scale;
    const rodType = equipment.rod?.variant || "float";
    let kind = "";
    if (floatEntity.isHooked()) kind = "hooked";
    else if (rodType === "spinning" && equipment.baits?.[0]) kind = "lure";
    else if (rodType === "feeder" && equipment.feederRig) kind = "feeder";
    else if (equipment.float) kind = "float";
    if (!kind) return;
    const floatConfig = equipment.float || {};
    const width = floatConfig.effectiveStats?.width || 3;
    const length = floatConfig.effectiveStats?.length || 15;
    target.visible = true;
    target.kind = kind;
    target.x = screenPosition.x;
    target.y = screenPosition.y;
    target.color = visual.color;
    target.glow =
      visual.color !== "#ffffff" && visual.color !== "#00ff80";
    target.glowBlur = 8 * scale;
    target.width = kind === "hooked" ? 3 * scale : width * scale;
    target.height =
      kind === "hooked"
        ? 3 * scale
        : length * scale * (visual.scaleY ?? 1);
    target.radius = 2.5 * scale;
    target.radiusX = 6 * scale;
    target.radiusY = 3 * scale;
    target.rotationRad = ((visual.angle || 0) * Math.PI) / 180;
  }
}
