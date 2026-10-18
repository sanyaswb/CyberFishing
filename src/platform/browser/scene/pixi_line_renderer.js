import { SceneChangeFingerprint } from "./scene_change_fingerprint.js";

// The line kind on the scene (spec 107): the fishing line as one quadratic curve from the rod tip to the tackle, in
// the model's colour and width, and the plain rod bar of a rod without an animated skin, exactly as RodLineRenderer
// draws both on the 2D canvas (the bar under the line). The rod kind draws over it, so the rod covers the line's start.
export class PixiLineRenderer {
  #graphics;
  #fingerprint = new SceneChangeFingerprint();
  #visible = false;

  constructor({ pixi, stage }) {
    if (typeof pixi?.Graphics !== "function") throw new TypeError("PixiLineRenderer requires the Pixi namespace");
    this.#graphics = new pixi.Graphics();
    this.#graphics.visible = false;
    stage.addChild(this.#graphics);
  }

  // model: the frame's fishing.rodLine, or null when the kind is not on the scene. Returns whether it changed.
  update(model) {
    if (!model?.visible) return this.#hide();
    if (!this.#fingerprintOf(model) && this.#visible) return false;
    this.#visible = true;
    const graphics = this.#graphics;
    graphics.visible = true;
    graphics.clear();
    if (model.rodMode === "rectangle") {
      graphics.rect(model.rodBaseX - model.rodWidth / 2, model.rodTopY, model.rodWidth, model.rodHeight).fill(0x000000);
    }
    if (model.lineVisible) {
      graphics.moveTo(model.lineStartX, model.lineStartY);
      graphics.quadraticCurveTo(model.controlX, model.controlY, model.targetX, model.targetY);
      graphics.stroke({ width: model.lineWidth, color: model.lineColor });
    }
    return true;
  }

  #hide() {
    if (!this.#visible) return false;
    this.#visible = false;
    this.#graphics.visible = false;
    this.#fingerprint.invalidate();
    return true;
  }

  #fingerprintOf(model) {
    const print = this.#fingerprint;
    print.begin();
    print.text(model.rodMode);
    if (model.rodMode === "rectangle") {
      print.length(model.rodBaseX); print.length(model.rodTopY); print.length(model.rodWidth); print.length(model.rodHeight);
    }
    print.flag(model.lineVisible);
    if (model.lineVisible) {
      print.length(model.lineStartX); print.length(model.lineStartY); print.length(model.controlX);
      print.length(model.controlY); print.length(model.targetX); print.length(model.targetY);
      print.length(model.lineWidth); print.text(model.lineColor);
    }
    return print.finish();
  }
}
