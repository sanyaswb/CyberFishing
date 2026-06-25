class FightStatusBarsRenderer {
  #surface;
  #bars;
  #styles;
  #layout = {
    x: 0, width: 0, strokeHeight: 0, controlHeight: 0,
    controlY: 0, strokeY: 0, tensionY: 0,
  };
  #framedOptions = {
    x: 0, y: 0, width: 0, height: 0, ratio: 0,
    style: null, fillColor: null, topLabel: null,
    rightValue: null, marker: null,
  };
  #thinOptions = {
    x: 0, y: 0, width: 0, height: 0, ratio: 0,
    style: null, label: null, value: null,
  };
  #conditionStyle = {};
  #rodControlStyle = {};
  #tensionStyle = {};
  #tensionMarker = {
    enabled: false,
    ratio: 0,
    color: "#73c2fb",
    width: 2,
    extendPx: 4,
  };

  constructor({ surface, hudBarRenderer, styleResolver }) {
    if (!surface || typeof surface.fillRect !== "function") {
      throw new TypeError("FightStatusBarsRenderer requires surface");
    }
    if (!hudBarRenderer || typeof hudBarRenderer.drawFramedRatioBar !== "function") {
      throw new TypeError(
        "FightStatusBarsRenderer requires hudBarRenderer",
      );
    }
    if (!styleResolver || typeof styleResolver.resolveBarStyle !== "function") {
      throw new TypeError(
        "FightStatusBarsRenderer requires styleResolver",
      );
    }
    this.#surface = surface;
    this.#bars = hudBarRenderer;
    this.#styles = styleResolver;
  }

  render(model) {
    if (!model.visible) return;
    this.#drawFishCondition(model.fishCondition, model.viewportWidth);
    const layout = this.#resolveFightLayout(model.viewportWidth);
    this.#drawRodControl(model.rodControl, layout);
    this.#drawRodStroke(model.rodStroke, layout);
    this.#drawTension(model.tension, model.tackleStress, layout);
  }

  #drawFishCondition(model, viewportWidth) {
    if (!model.visible) return;
    const layout = this.#styles.resolveBarStyle("layout");
    const baseStyle = this.#styles.resolveBarStyle("fishCondition");
    const width = baseStyle.width || 220;
    const height = baseStyle.height || 10;
    const x = RenderMath.resolveX(layout.x, width, viewportWidth);
    const y = layout.y || 40;
    const gap = baseStyle.gap || 22;
    this.#drawConditionBar(
      x,
      y,
      width,
      height,
      model.staminaRatio,
      this.#styles.resolveBarStyle("fishCondition.stamina"),
      "СТАМІНА",
      model.staminaValue,
      model.phase === "stamina",
    );
    this.#drawConditionBar(
      x,
      y + gap,
      width,
      height,
      model.exhaustionRatio,
      this.#styles.resolveBarStyle("fishCondition.exhaustion"),
      "ВИСНАЖЕННЯ",
      model.exhaustionValue,
      model.phase === "exhaustion",
    );
  }

  #drawConditionBar(x, y, width, height, ratio, style, label, value, active) {
    const fillColor = style.fillColor || "#ffcc00";
    const options = this.#framedOptions;
    const resolvedStyle = this.#conditionStyle;
    Object.setPrototypeOf(resolvedStyle, style);
    resolvedStyle.borderColor = active
      ? fillColor
      : style.borderColor || "#333";
    resolvedStyle.borderWidth = active
      ? style.activeBorderWidth ?? 2
      : style.inactiveBorderWidth ??
        style.borderWidth ??
        1;
    resolvedStyle.labelColor = active
      ? style.activeLabelColor || "#ffffff"
      : style.labelColor || "#8a9bac";
    resolvedStyle.valueColor = active
      ? style.activeLabelColor || "#ffffff"
      : style.valueColor ||
        style.labelColor ||
        "#8a9bac";
    options.x = x;
    options.y = y;
    options.width = width;
    options.height = height;
    options.ratio = ratio;
    options.style = resolvedStyle;
    options.fillColor = fillColor;
    options.topLabel = label;
    options.rightValue = value;
    options.marker = null;
    this.#bars.drawFramedRatioBar(options);
  }

  #resolveFightLayout(viewportWidth) {
    const layout = this.#styles.resolveBarStyle("layout");
    const tension = this.#styles.resolveBarStyle("tension");
    const rodStroke = this.#styles.resolveBarStyle("rodStroke");
    const rodControl = this.#styles.resolveBarStyle("rodControl");
    const result = this.#layout;
    result.width = tension.width || 300;
    result.x = RenderMath.resolveX(layout.x, result.width, viewportWidth);
    const baseY = layout.y || 40;
    result.strokeHeight = rodStroke.height || 3;
    result.controlHeight = rodControl.height || result.strokeHeight;
    result.strokeY = baseY + (layout.spacing || 40);
    result.controlY =
      result.strokeY - result.controlHeight + (rodControl.yOffset ?? -28);
    result.tensionY =
      result.strokeY +
      result.strokeHeight +
      (layout.tensionGapFromStroke ?? 34);
    return result;
  }

  #drawRodStroke(model, layout) {
    if (!model.visible) return;
    this.#drawThinBar(
      model.ratio,
      layout.x,
      layout.strokeY,
      layout.width,
      layout.strokeHeight,
      "Rod stroke",
      model.value,
      this.#styles.resolveBarStyle("rodStroke"),
    );
  }

  #drawRodControl(model, layout) {
    if (!model.visible) return;
    const style = this.#styles.resolveBarStyle("rodControl");
    const resolvedStyle = this.#rodControlStyle;
    Object.setPrototypeOf(resolvedStyle, style);
    resolvedStyle.fillColor = model.active
      ? style.activeColor || "#00d4ff"
      : style.inactiveColor || "#5c7d99";
    this.#drawThinBar(
      model.ratio,
      layout.x,
      layout.controlY,
      layout.width,
      layout.controlHeight,
      "Rod control",
      model.value,
      resolvedStyle,
    );
  }

  #drawThinBar(ratio, x, y, width, height, label, value, style) {
    const surface = this.#surface;
    const clamped = RenderMath.clamp(ratio);
    surface.save();
    surface.fillStyle = style.backgroundColor || "rgba(58, 126, 210, 0.26)";
    surface.fillRect(x, y, width, height);
    surface.fillStyle = style.fillColor || "#4aa3ff";
    surface.fillRect(x, y, width * clamped, height);
    surface.fillStyle = style.labelColor || "#8a9bac";
    surface.font = style.labelFont || "bold 12px monospace";
    surface.textAlign = "center";
    surface.textBaseline = "bottom";
    surface.fillText(label, x + width / 2, y - (style.labelGap ?? 5));
    surface.fillStyle =
      style.valueColor || style.labelColor || "#8a9bac";
    surface.font =
      style.valueFont || style.labelFont || "bold 12px monospace";
    const centered = style.valuePlacement === "center";
    surface.textAlign = centered ? "center" : "right";
    surface.textBaseline = "middle";
    surface.fillText(
      value,
      centered ? x + width / 2 : x + width - (style.valueGap ?? 6),
      y + height / 2,
    );
    surface.restore();
  }

  #drawTension(model, stress, layout) {
    if (!model.visible) return;
    const style = this.#styles.resolveBarStyle("tension");
    const fillColor = this.#gradientColor(model.ratio * 100, style.gradient);
    const statusColor = this.#statusColor(model.ratio * 100, style.statuses);
    const resolvedStyle = this.#tensionStyle;
    Object.setPrototypeOf(resolvedStyle, style);
    resolvedStyle.glowIntensity =
      model.pulse * (style.glowIntensity ?? 0.6);
    resolvedStyle.valueColor = statusColor;
    const marker = this.#tensionMarker;
    marker.enabled = model.dragMarkerVisible;
    marker.ratio = model.dragMarkerRatio;
    marker.color = style.dragMarkerColor || style.markerColor || "#73c2fb";
    marker.width = 2;
    marker.extendPx = 4;
    const options = this.#framedOptions;
    options.x = layout.x;
    options.y = layout.tensionY;
    options.width = layout.width;
    options.height = style.height || 20;
    options.ratio = model.ratio;
    options.style = resolvedStyle;
    options.fillColor = fillColor;
    options.topLabel = "TENSION";
    options.rightValue = model.value;
    options.marker = marker;
    this.#bars.drawFramedRatioBar(options);
    this.#drawStress(stress, layout);
  }

  #drawStress(model, layout) {
    if (!model.visible) return;
    const style = this.#styles.resolveBarStyle("tackleStress");
    const options = this.#thinOptions;
    options.x = layout.x;
    options.y = layout.tensionY + (style.yOffset ?? -25);
    options.width = layout.width;
    options.height = style.height || 8;
    options.ratio = model.ratio;
    options.style = style;
    options.label = model.label;
    options.value = model.value;
    this.#bars.drawThinProgressBar(options);
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

  #statusColor(value, statuses) {
    if (!Array.isArray(statuses) || statuses.length === 0) return "#4a5b6c";
    let current = statuses[0];
    for (let index = 0; index < statuses.length; index += 1) {
      if (value >= statuses[index].threshold) current = statuses[index];
    }
    return current.color || "#4a5b6c";
  }
}
