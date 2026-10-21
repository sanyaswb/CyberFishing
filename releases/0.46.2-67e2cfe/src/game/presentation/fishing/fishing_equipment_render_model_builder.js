// The night float's halo, the green of its tip glow art.
const NIGHT_HALO_COLOR = "#46ff8c";

export class FishingEquipmentRenderModelBuilder {
  #projector;
  #canvasMetrics;
  #clock;
  #config;
  #getRodScreenX;
  #rodAnimation;
  #getWind;
  #floatPose;
  #getWaterMetric;
  #anchor = null;
  #rodBaseX = 0;
  #rodBaseY = 0;
  #advanceContext = {
    dtSec: 0, state: "", stressRatio: 0, tensionRatio: 0, fishScreenX: 0, baseX: 0, baseY: 0, canvasWidth: 0, canvasHeight: 0,
    pixelRatio: 1, windDirection: 0, rainMultiplier: 1, critical: false,
  };

  constructor({
    projector,
    canvasMetrics,
    clock,
    config,
    getRodScreenX,
    rodAnimation,
    getWind,
    floatPose,
    getWaterMetric,
  }) {
    if (typeof getRodScreenX !== "function") {
      throw new TypeError(
        "FishingEquipmentRenderModelBuilder requires getRodScreenX",
      );
    }
    if (typeof rodAnimation?.advance !== "function" || typeof rodAnimation.setSkin !== "function") {
      throw new TypeError("FishingEquipmentRenderModelBuilder requires rodAnimation");
    }
    if (typeof getWind !== "function") throw new TypeError("FishingEquipmentRenderModelBuilder requires getWind");
    if (typeof floatPose?.advance !== "function") {
      throw new TypeError("FishingEquipmentRenderModelBuilder requires floatPose");
    }
    if (typeof getWaterMetric !== "function") {
      throw new TypeError("FishingEquipmentRenderModelBuilder requires getWaterMetric");
    }
    this.#projector = projector;
    this.#canvasMetrics = canvasMetrics;
    this.#clock = clock;
    this.#config = config;
    this.#getRodScreenX = getRodScreenX;
    this.#rodAnimation = rodAnimation;
    this.#getWind = getWind;
    this.#floatPose = floatPose;
    this.#getWaterMetric = getWaterMetric;
  }

  // Once per frame before the line: rod base, the rod picture's step (spec 099) and its anchor, whose tip is where
  // the line starts. Without an animated skin the tip is today's rectangle top (base - 200 px).
  // tension: the tension bar's value (0..100, its fill is tension / 100); critical: the tackle STRESS bar shows this
  // frame (the rod's tremble clip plays).
  prepareRod({ state, equipment, fightFrame, floatScreenX, tension = 0, critical = false }) {
    const rodConfig = this.#config.ui?.rod || {};
    const configuredX =
      rodConfig.x === "center"
        ? this.#canvasMetrics.width / 2
        : Number(rodConfig.x);
    const overrideX = Number(this.#getRodScreenX());
    this.#rodBaseX = Number.isFinite(overrideX)
      ? overrideX
      : Number.isFinite(configuredX)
        ? configuredX
        : this.#canvasMetrics.width / 2;
    this.#rodBaseY =
      this.#canvasMetrics.height - (rodConfig.yOffset || 0);
    this.#rodAnimation.setSkin(equipment?.rod?.skin?.animation ?? null);
    const wind = this.#getWind();
    const context = this.#advanceContext;
    context.dtSec = Math.max(0, Number(this.#clock.delta) || 0) / 1000;
    context.state = state;
    context.stressRatio = fightFrame?.rodStressRatio ?? 0;
    context.tensionRatio = Math.max(0, Math.min(1, (Number(tension) || 0) / 100));
    context.fishScreenX = floatScreenX;
    context.baseX = this.#rodBaseX;
    context.baseY = this.#rodBaseY;
    context.canvasWidth = this.#canvasMetrics.width;
    context.canvasHeight = this.#canvasMetrics.height;
    context.pixelRatio = this.#canvasMetrics.pixelRatio ?? 1;
    context.windDirection = wind?.direction ?? 0;
    context.rainMultiplier = wind?.rainMult ?? 1;
    context.critical = critical === true;
    this.#anchor = this.#rodAnimation.advance(context);
    return this.#anchor;
  }

  buildRodLine({
    target,
    floatPosition,
    state,
    tension,
    lineFrame,
  }) {
    const lineConfig = this.#config.ui?.line || {};
    const anchor = this.#anchor;
    const rodWidth = 3;
    const rodHeight = 200;
    const rodBaseX = this.#rodBaseX;
    const rodBaseY = this.#rodBaseY;
    const rodTopY = rodBaseY - rodHeight;
    const lineStartX = anchor.tipX;
    const lineStartY = anchor.tipY;
    const targetX =
      lineStartX + (floatPosition.x - lineStartX) * lineFrame.renderRatio;
    const targetY =
      lineStartY +
      (floatPosition.y - lineStartY) * lineFrame.renderRatio +
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
    const straightY = (lineStartY + targetY) / 2;
    const slackY =
      Math.max(lineStartY, targetY) + (lineConfig.sagOffset || 60);
    target.visible = true;
    target.rodMode = anchor.mode;
    target.rodBaseX = rodBaseX;
    target.rodBaseY = rodBaseY;
    target.rodTopY = rodTopY;
    target.rodWidth = rodWidth;
    target.rodHeight = rodHeight;
    target.rodScale = anchor.scale;
    target.rodDestX = anchor.destX;
    target.rodDestY = anchor.destY;
    target.rodDestWidth = anchor.destWidth;
    target.rodDestHeight = anchor.destHeight;
    target.rodImage = anchor.image;
    target.rodRegion = anchor.region;
    target.rodBounds = anchor.bounds;
    target.rodView = anchor.view;
    target.rodViewScale = anchor.viewScale;
    target.lineStartX = lineStartX;
    target.lineStartY = lineStartY;
    target.lineVisible = lineConfig.visible !== false;
    target.targetX = targetX;
    target.targetY = targetY;
    target.controlX = (lineStartX + targetX) / 2;
    target.controlY =
      slackY + (straightY - slackY) * lineFrame.straightFactor;
    target.lineColor = lineColor;
    target.lineWidth = lineWidth;
  }

  // The float's body is drawn up from the waterline point: rotated by its roll, shortened by a lean toward or away
  // from the viewer and by the share under water, never stretched (spec 127). An image float draws its art's top
  // visibleShare (the part above the water) and, at night, an additive green glow of the tip. ui.float.displayScale
  // multiplies its size. Other tackle keeps its shapes.
  buildFloat({ target, screenPosition, floatEntity, equipment }) {
    const visual = floatEntity.getVisualState();
    const position = floatEntity.getPosition();
    const scale = this.#projector.getPerspective(position.y).scale * this.#projector.getScale();
    const rodType = equipment.rod?.variant || "float";
    let kind = "";
    if (floatEntity.isHooked()) kind = "hooked";
    else if (rodType === "spinning" && equipment.baits?.[0]) kind = "lure";
    else if (rodType === "feeder" && equipment.feederRig) kind = "feeder";
    else if (equipment.float) kind = "float";
    if (!kind) return;
    const floatConfig = equipment.float || {};
    const displayScale = Math.max(0, Number(this.#config.ui?.float?.displayScale) || 1);
    const width = (floatConfig.effectiveStats?.width || 3) * displayScale;
    const length = (floatConfig.effectiveStats?.length || 15) * displayScale;
    const art = kind === "float" ? floatConfig.skin?.scene : null;
    const waterline = Math.max(0.01, Math.min(1, Number(art?.waterline) || 1));
    target.visible = true;
    target.kind = kind;
    target.x = screenPosition.x;
    target.y = screenPosition.y;
    target.color = visual.color;
    // Halo around the tackle (ui.float, DEV switches): the bite colours' halo is off by default (owner, v0.46.2); a
    // night float has a green halo of the same style and its tip glow.
    const floatUi = this.#config.ui?.float || {};
    const isNight = kind === "float" && floatConfig.variant === "night";
    const biteHalo = floatUi.biteHalo === true && visual.color !== "#ffffff" && visual.color !== "#00ff80";
    const nightHalo = isNight && floatUi.nightHalo !== false;
    target.glow = biteHalo || nightHalo;
    target.glowColor = biteHalo ? visual.color : NIGHT_HALO_COLOR;
    target.glowBlur = 8 * scale;
    target.imageId = art?.src || "";
    target.tipGlowId = isNight && floatUi.nightTipGlow !== false && art?.glow?.src ? art.glow.src : "";
    target.tipGlowPad = Math.max(0, Number(art?.glow?.pad) || 0);
    let rotationDeg = 0;
    let foreshortening = 1;
    let visibleShare = 1;
    if (kind === "float" && typeof floatEntity.getPoseSignals === "function") {
      const pose = this.#floatPose.advance({ signals: floatEntity.getPoseSignals(), position,
        metric: this.#getWaterMetric(), dtSec: Math.max(0, Number(this.#clock.delta) || 0) / 1000,
        artDraft: art ? 1 - waterline : 0 });
      rotationDeg = pose.rollDeg;
      foreshortening = pose.foreshortening;
      visibleShare = pose.visibleShare;
    }
    // The whole body: for an image float the item length is the antenna above the art's waterline.
    target.bodyHeight = length / waterline * scale * foreshortening;
    target.visibleShare = visibleShare;
    target.width = kind === "hooked" ? 3 * scale : width * scale;
    target.height = kind === "hooked" ? 3 * scale : target.bodyHeight * visibleShare;
    target.radius = 2.5 * scale;
    target.radiusX = 6 * scale;
    target.radiusY = 3 * scale;
    target.rotationRad = (rotationDeg * Math.PI) / 180;
  }
}
