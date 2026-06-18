const FIGHT_AREA_EMPTY_DASH = Object.freeze([]);
const FIGHT_AREA_NET_DASH = Object.freeze([10, 10]);
const FIGHT_AREA_AXIS_DASH = Object.freeze([6, 8]);

class FightAreaRenderer {
  #surface;
  #primitives;
  #styleResolver;

  constructor({ surface, primitives, styleResolver }) {
    if (!surface || typeof surface.ellipse !== "function") {
      throw new TypeError("FightAreaRenderer requires surface");
    }
    if (
      !primitives ||
      typeof primitives.beginClip !== "function" ||
      typeof primitives.endClip !== "function"
    ) {
      throw new TypeError("FightAreaRenderer requires primitives");
    }
    if (!styleResolver || typeof styleResolver.resolve !== "function") {
      throw new TypeError("FightAreaRenderer requires styleResolver");
    }
    this.#surface = surface;
    this.#primitives = primitives;
    this.#styleResolver = styleResolver;
  }

  render(model) {
    if (!model.visible) return;
    const style = this.#styleResolver.resolve();
    const clipped = this.#primitives.beginClip(model.clipRegions);
    this.#drawLastDash(model.lastDashZone, style);
    this.#drawCatch(model.catchZone, style);
    this.#drawNet(model.netZone, style);
    this.#drawSector(model, style);
    this.#drawLineRadius(model, style);
    this.#primitives.endClip(clipped);
  }

  #drawLastDash(model, style) {
    if (!model.visible) return;
    const surface = this.#surface;
    if (model.height > 0) {
      surface.fillStyle = style.lastDashFill;
      surface.fillRect(0, model.y, model.width, model.height);
    }
    surface.strokeStyle = style.lastDashStroke;
    surface.lineWidth = 2;
    surface.setLineDash(style.lastDashDash);
    surface.beginPath();
    surface.moveTo(0, model.y);
    surface.lineTo(model.width, model.y);
    surface.stroke();
    surface.setLineDash(FIGHT_AREA_EMPTY_DASH);
  }

  #drawCatch(model, style) {
    if (!model.visible) return;
    const surface = this.#surface;
    if (model.kind === "ellipse") {
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
      surface.fillStyle = style.catchFill;
      surface.fill();
      surface.strokeStyle = style.catchStroke;
      surface.lineWidth = 2;
      surface.stroke();
      surface.restore();
      return;
    }
    if (model.height > 0) {
      surface.fillStyle = style.catchFill;
      surface.fillRect(0, model.y, model.width, model.height);
    }
    surface.strokeStyle = style.catchStroke;
    surface.lineWidth = 2;
    surface.beginPath();
    surface.moveTo(0, model.lineY);
    surface.lineTo(model.width, model.lineY);
    surface.stroke();
  }

  #drawNet(model, style) {
    if (!model.visible) return;
    const surface = this.#surface;
    surface.strokeStyle = style.netStroke;
    surface.lineWidth = 1;
    surface.setLineDash(FIGHT_AREA_NET_DASH);
    surface.beginPath();
    surface.moveTo(0, model.y);
    surface.lineTo(model.width, model.y);
    surface.stroke();
    surface.setLineDash(FIGHT_AREA_EMPTY_DASH);
    if (model.height > 0) {
      surface.fillStyle = style.netFill;
      surface.fillRect(0, model.y, model.width, model.height);
    }
  }

  #drawSector(model, style) {
    if (!model.showSector || model.sectorPoints.count < 3) return;
    const surface = this.#surface;
    surface.save();
    surface.beginPath();
    for (let index = 0; index < model.sectorPoints.count; index += 1) {
      const point = model.sectorPoints.getAt(index);
      if (index === 0) surface.moveTo(point.x, point.y);
      else surface.lineTo(point.x, point.y);
    }
    surface.closePath();
    surface.fillStyle = model.sectorClamped
      ? style.sectorClampedFill
      : style.sectorFill;
    surface.fill();
    surface.strokeStyle = model.sectorClamped
      ? style.sectorClampedStroke
      : style.sectorStroke;
    surface.lineWidth = 3;
    surface.setLineDash(FIGHT_AREA_EMPTY_DASH);
    surface.stroke();
    surface.beginPath();
    surface.moveTo(model.apexX, model.apexY);
    surface.lineTo(model.axisEndX, model.axisEndY);
    surface.strokeStyle = style.sectorAxis;
    surface.lineWidth = 2;
    surface.setLineDash(FIGHT_AREA_AXIS_DASH);
    surface.stroke();
    surface.setLineDash(FIGHT_AREA_EMPTY_DASH);
    surface.restore();
  }

  #drawLineRadius(model, style) {
    if (!model.showLineRadius || model.lineRadiusPoints.count < 2) return;
    const surface = this.#surface;
    surface.beginPath();
    for (let index = 0; index < model.lineRadiusPoints.count; index += 1) {
      const point = model.lineRadiusPoints.getAt(index);
      if (index === 0) surface.moveTo(point.x, point.y);
      else surface.lineTo(point.x, point.y);
    }
    surface.strokeStyle = style.lineRadiusStroke;
    surface.lineWidth = 4;
    surface.setLineDash(FIGHT_AREA_EMPTY_DASH);
    surface.stroke();
  }
}
