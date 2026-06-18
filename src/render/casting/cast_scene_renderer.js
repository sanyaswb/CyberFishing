const CAST_AIM_DASH = Object.freeze([15, 10]);

class CastSceneRenderer {
  #surface;
  #primitives;
  #hudBarRenderer;
  #hudStyleResolver;

  constructor({
    surface,
    primitives,
    hudBarRenderer,
    hudStyleResolver,
  }) {
    if (!surface || typeof surface.beginPath !== "function") {
      throw new TypeError("CastSceneRenderer requires surface");
    }
    if (
      !primitives ||
      typeof primitives.beginClip !== "function" ||
      typeof primitives.endClip !== "function"
    ) {
      throw new TypeError("CastSceneRenderer requires primitives");
    }
    if (!hudBarRenderer || typeof hudBarRenderer.drawFramedRatioBar !== "function") {
      throw new TypeError("CastSceneRenderer requires hudBarRenderer");
    }
    if (!hudStyleResolver || typeof hudStyleResolver.resolveBarStyle !== "function") {
      throw new TypeError("CastSceneRenderer requires hudStyleResolver");
    }
    this.#surface = surface;
    this.#primitives = primitives;
    this.#hudBarRenderer = hudBarRenderer;
    this.#hudStyleResolver = hudStyleResolver;
  }

  render(model) {
    if (!model.visible) return;
    this.#renderAimingZone(model.aimingZone);
    this.#renderAccuracyArea(model.accuracyArea);
    this.#renderPowerAim(model.powerAim);
  }

  #renderAimingZone(model) {
    if (!model.visible) return;
    const clipped = this.#primitives.beginClip(model.clipRegions);
    const surface = this.#surface;
    surface.save();
    surface.beginPath();
    surface.moveTo(0, model.lineY);
    surface.lineTo(model.viewportWidth, model.lineY);
    surface.strokeStyle =
      model.mode === "chum"
        ? "rgba(255, 170, 0, 0.8)"
        : "rgba(0, 204, 255, 0.6)";
    surface.fillStyle =
      model.mode === "chum"
        ? "rgba(255, 170, 0, 0.05)"
        : "rgba(0, 204, 255, 0.05)";
    surface.lineWidth = 2;
    surface.setLineDash(CAST_AIM_DASH);
    surface.stroke();
    if (model.fillHeight > 0) {
      surface.fillRect(
        0,
        model.lineY,
        model.viewportWidth,
        model.fillHeight,
      );
    }
    surface.restore();
    this.#primitives.endClip(clipped);
  }

  #renderAccuracyArea(model) {
    if (!model.visible || model.radiusX <= 0 || model.radiusY <= 0) return;
    const surface = this.#surface;
    surface.save();
    surface.beginPath();
    surface.ellipse(
      model.x,
      model.y,
      model.radiusX,
      model.radiusY,
      0,
      0,
      Math.PI * 2,
    );
    surface.fillStyle = model.fillColor;
    surface.strokeStyle = model.strokeColor;
    surface.lineWidth = model.lineWidth;
    surface.setLineDash(model.dash);
    surface.fill();
    surface.stroke();
    surface.restore();
  }

  #renderPowerAim(model) {
    if (!model.visible) return;
    const surface = this.#surface;
    surface.save();
    surface.beginPath();
    surface.moveTo(model.screenX, model.originY);
    surface.lineTo(model.screenX, model.targetY);
    surface.strokeStyle = model.lineColor;
    surface.lineWidth = model.lineWidth;
    surface.setLineDash(model.dash);
    surface.lineDashOffset = model.dashOffset;
    surface.shadowColor = model.lineColor;
    surface.shadowBlur = model.glowBlur;
    surface.stroke();
    surface.restore();

    const style = this.#hudStyleResolver.resolveBarStyle("castPower");
    const width = style.width || 300;
    this.#hudBarRenderer.drawFramedRatioBar({
      ratio: model.powerRatio,
      x: RenderMath.resolveX(
        style.x || "center",
        width,
        model.viewportWidth,
      ),
      y: style.y || 18,
      width,
      height: style.height || 12,
      style,
      fillColor: model.powerColor,
      topLabel: model.mode === "chum" ? "CHUM" : "CAST",
      rightValue: `${Math.round(model.powerRatio * 100)}%`,
    });
  }
}
