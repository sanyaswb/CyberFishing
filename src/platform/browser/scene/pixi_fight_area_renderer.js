import { appendDashedLine } from "./pixi_dashed_line.js";
import { SceneChangeFingerprint } from "./scene_change_fingerprint.js";

// Dash patterns of FightAreaRenderer (logical px).
const NET_DASH = Object.freeze([10, 10]);
const AXIS_DASH = Object.freeze([6, 8]);

// The fight-areas kind on the scene (spec 107): the last-dash band, the catch zone (band or ellipse), the landing net
// band, the pole sector with its axis and the line-radius arc, clipped to the fight's water (model.clipRegions), in
// the colours and line widths FightAreaRenderer uses on the 2D canvas (styles: FightAreaStyleResolver). Dashes are
// drawn as segments (Pixi has no line dash). A fingerprint of the model decides whether the picture changed.
export class PixiFightAreaRenderer {
  #styles;
  #container;
  #shapes;
  #mask;
  #fingerprint = new SceneChangeFingerprint();
  #visible = false;
  #style = null;

  // styles: { resolve() } → the fight area colours (the 2D renderer's resolver, so DEV config edits reach both).
  constructor({ pixi, stage, styles }) {
    if (typeof pixi?.Graphics !== "function") throw new TypeError("PixiFightAreaRenderer requires the Pixi namespace");
    if (typeof styles?.resolve !== "function") throw new TypeError("PixiFightAreaRenderer requires styles");
    this.#styles = styles;
    this.#container = new pixi.Container();
    this.#shapes = new pixi.Graphics();
    this.#mask = new pixi.Graphics();
    this.#container.addChild(this.#shapes, this.#mask);
    this.#container.visible = false;
    stage.addChild(this.#container);
  }

  // model: the frame's fishing.fightAreas, or null when the kind is not on the scene. Returns whether it changed.
  update(model) {
    if (!model?.visible) return this.#hide();
    const style = this.#styles.resolve();
    if (style !== this.#style) {
      this.#style = style;
      this.#fingerprint.invalidate();
    }
    if (!this.#fingerprintOf(model) && this.#visible) return false;
    this.#visible = true;
    this.#container.visible = true;
    const shapes = this.#shapes;
    shapes.clear();
    this.#drawLastDash(model.lastDashZone, style);
    this.#drawCatch(model.catchZone, style);
    this.#drawNet(model.netZone, style);
    this.#drawSector(model, style);
    this.#drawLineRadius(model, style);
    this.#clip(model.clipRegions);
    return true;
  }

  #hide() {
    if (!this.#visible) return false;
    this.#visible = false;
    this.#container.visible = false;
    this.#fingerprint.invalidate();
    return true;
  }

  #fingerprintOf(model) {
    const print = this.#fingerprint;
    print.begin();
    for (let index = 0; index < model.clipRegions.count; index += 1) {
      const region = model.clipRegions.getAt(index);
      print.length(region.x); print.length(region.y); print.length(region.width); print.length(region.height);
    }
    const last = model.lastDashZone;
    print.flag(last.visible);
    if (last.visible) { print.length(last.y); print.length(last.width); print.length(last.height); }
    const zone = model.catchZone;
    print.flag(zone.visible);
    if (zone.visible) {
      print.text(zone.kind);
      if (zone.kind === "polygon") {
        print.length(zone.pointCount);
        for (let point = 0; point < zone.pointCount * 2; point++) print.length(zone.points[point]);
      }
      print.length(zone.x); print.length(zone.y); print.length(zone.radiusX); print.length(zone.radiusY);
      print.length(zone.width); print.length(zone.height); print.length(zone.lineY);
    }
    const net = model.netZone;
    print.flag(net.visible);
    if (net.visible) { print.length(net.y); print.length(net.width); print.length(net.height); }
    print.flag(model.showSector);
    if (model.showSector) {
      print.flag(model.sectorClamped);
      for (let index = 0; index < model.sectorPoints.count; index += 1) {
        const point = model.sectorPoints.getAt(index);
        print.length(point.x); print.length(point.y);
      }
      print.length(model.apexX); print.length(model.apexY); print.length(model.axisEndX); print.length(model.axisEndY);
    }
    print.flag(model.showLineRadius);
    if (model.showLineRadius) {
      for (let index = 0; index < model.lineRadiusPoints.count; index += 1) {
        const point = model.lineRadiusPoints.getAt(index);
        print.length(point.x); print.length(point.y);
      }
    }
    return print.finish();
  }

  #drawLastDash(model, style) {
    if (!model.visible) return;
    const shapes = this.#shapes;
    if (model.height > 0) shapes.rect(0, model.y, model.width, model.height).fill(style.lastDashFill);
    appendDashedLine(shapes, 0, model.y, model.width, model.y, style.lastDashDash);
    shapes.stroke({ width: 2, color: style.lastDashStroke });
  }

  #drawCatch(model, style) {
    if (!model.visible) return;
    const shapes = this.#shapes;
    if (model.kind === "polygon") {
      shapes.moveTo(model.points[0], model.points[1]);
      for (let point = 1; point < model.pointCount; point++) shapes.lineTo(model.points[point * 2], model.points[point * 2 + 1]);
      shapes.closePath().fill(style.catchFill).stroke({ width: 2, color: style.catchStroke });
      return;
    }
    if (model.kind === "ellipse") {
      shapes.ellipse(model.x, model.y, model.radiusX, model.radiusY).fill(style.catchFill)
        .stroke({ width: 2, color: style.catchStroke });
      return;
    }
    if (model.height > 0) shapes.rect(0, model.y, model.width, model.height).fill(style.catchFill);
    shapes.moveTo(0, model.lineY);
    shapes.lineTo(model.width, model.lineY);
    shapes.stroke({ width: 2, color: style.catchStroke });
  }

  #drawNet(model, style) {
    if (!model.visible) return;
    const shapes = this.#shapes;
    appendDashedLine(shapes, 0, model.y, model.width, model.y, NET_DASH);
    shapes.stroke({ width: 1, color: style.netStroke });
    if (model.height > 0) shapes.rect(0, model.y, model.width, model.height).fill(style.netFill);
  }

  #drawSector(model, style) {
    if (!model.showSector || model.sectorPoints.count < 3) return;
    const shapes = this.#shapes;
    for (let index = 0; index < model.sectorPoints.count; index += 1) {
      const point = model.sectorPoints.getAt(index);
      if (index === 0) shapes.moveTo(point.x, point.y);
      else shapes.lineTo(point.x, point.y);
    }
    shapes.closePath();
    shapes.fill(model.sectorClamped ? style.sectorClampedFill : style.sectorFill);
    shapes.stroke({ width: 3, color: model.sectorClamped ? style.sectorClampedStroke : style.sectorStroke });
    appendDashedLine(shapes, model.apexX, model.apexY, model.axisEndX, model.axisEndY, AXIS_DASH);
    shapes.stroke({ width: 2, color: style.sectorAxis });
  }

  #drawLineRadius(model, style) {
    if (!model.showLineRadius || model.lineRadiusPoints.count < 2) return;
    const shapes = this.#shapes;
    for (let index = 0; index < model.lineRadiusPoints.count; index += 1) {
      const point = model.lineRadiusPoints.getAt(index);
      if (index === 0) shapes.moveTo(point.x, point.y);
      else shapes.lineTo(point.x, point.y);
    }
    shapes.stroke({ width: 4, color: style.lineRadiusStroke });
  }

  // 2D: primitives.beginClip(model.clipRegions) — no regions, no clip.
  #clip(regions) {
    const mask = this.#mask;
    mask.clear();
    if (!regions || regions.count === 0) {
      this.#shapes.mask = null;
      return;
    }
    for (let index = 0; index < regions.count; index += 1) {
      const region = regions.getAt(index);
      mask.rect(region.x, region.y, region.width, region.height);
    }
    mask.fill(0xffffff);
    this.#shapes.mask = mask;
  }
}
