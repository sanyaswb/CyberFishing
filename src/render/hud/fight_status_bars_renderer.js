class FightStatusBarsRenderer {
  #surface;
  #bars;
  #styles;

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
    this.#drawConditionBar({
      x,
      y,
      width,
      height,
      ratio: model.staminaRatio,
      style: this.#styles.resolveBarStyle("fishCondition.stamina"),
      label: "STAMINA",
      value: model.staminaValue,
      active: model.phase === "stamina",
    });
    this.#drawConditionBar({
      x,
      y: y + gap,
      width,
      height,
      ratio: model.exhaustionRatio,
      style: this.#styles.resolveBarStyle("fishCondition.exhaustion"),
      label: "ENDURANCE",
      value: model.exhaustionValue,
      active: model.phase === "exhaustion",
    });
  }

  #drawConditionBar(options) {
    const fillColor = options.style.fillColor || "#ffcc00";
    this.#bars.drawFramedRatioBar({
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height,
      ratio: options.ratio,
      style: {
        ...options.style,
        borderColor: options.active
          ? fillColor
          : options.style.borderColor || "#333",
        borderWidth: options.active
          ? options.style.activeBorderWidth ?? 2
          : options.style.inactiveBorderWidth ??
            options.style.borderWidth ??
            1,
        labelColor: options.active
          ? options.style.activeLabelColor || "#ffffff"
          : options.style.labelColor || "#8a9bac",
        valueColor: options.active
          ? options.style.activeLabelColor || "#ffffff"
          : options.style.valueColor ||
            options.style.labelColor ||
            "#8a9bac",
      },
      fillColor,
      topLabel: options.label,
      rightValue: options.value,
    });
  }

  #resolveFightLayout(viewportWidth) {
    const layout = this.#styles.resolveBarStyle("layout");
    const tension = this.#styles.resolveBarStyle("tension");
    const rodStroke = this.#styles.resolveBarStyle("rodStroke");
    const rodControl = this.#styles.resolveBarStyle("rodControl");
    const width = tension.width || 300;
    const x = RenderMath.resolveX(layout.x, width, viewportWidth);
    const baseY = layout.y || 40;
    const strokeHeight = rodStroke.height || 3;
    const controlHeight = rodControl.height || strokeHeight;
    const strokeY = baseY + (layout.spacing || 40);
    return {
      x,
      width,
      strokeHeight,
      controlHeight,
      controlY:
        strokeY - controlHeight + (rodControl.yOffset ?? -28),
      strokeY,
      tensionY:
        strokeY +
        strokeHeight +
        (layout.tensionGapFromStroke ?? 34),
    };
  }

  #drawRodStroke(model, layout) {
    if (!model.visible) return;
    this.#drawThinBar({
      ratio: model.ratio,
      x: layout.x,
      y: layout.strokeY,
      width: layout.width,
      height: layout.strokeHeight,
      label: "Хід вудки",
      value: model.value,
      style: this.#styles.resolveBarStyle("rodStroke"),
    });
  }

  #drawRodControl(model, layout) {
    if (!model.visible) return;
    const style = this.#styles.resolveBarStyle("rodControl");
    this.#drawThinBar({
      ratio: model.ratio,
      x: layout.x,
      y: layout.controlY,
      width: layout.width,
      height: layout.controlHeight,
      label: "Контроль вудки",
      value: model.value,
      style: {
        ...style,
        fillColor: model.active
          ? style.activeColor || "#00d4ff"
          : style.inactiveColor || "#5c7d99",
      },
    });
  }

  #drawThinBar({ ratio, x, y, width, height, label, value, style }) {
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
    this.#bars.drawFramedRatioBar({
      ratio: model.ratio,
      x: layout.x,
      y: layout.tensionY,
      width: layout.width,
      height: style.height || 20,
      style: {
        ...style,
        glowIntensity: model.pulse * (style.glowIntensity ?? 0.6),
        valueColor: statusColor,
      },
      fillColor,
      topLabel: "НАТЯГ",
      rightValue: model.value,
      marker: {
        enabled: model.dragMarkerVisible,
        ratio: model.dragMarkerRatio,
        color: style.dragMarkerColor || style.markerColor || "#73c2fb",
        width: 2,
        extendPx: 4,
      },
    });
    this.#drawStress(stress, layout);
  }

  #drawStress(model, layout) {
    if (!model.visible) return;
    const style = this.#styles.resolveBarStyle("tackleStress");
    this.#bars.drawThinProgressBar({
      x: layout.x,
      y: layout.tensionY + (style.yOffset ?? -25),
      width: layout.width,
      height: style.height || 8,
      ratio: model.ratio,
      style,
      label: model.label,
      value: model.value,
    });
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
