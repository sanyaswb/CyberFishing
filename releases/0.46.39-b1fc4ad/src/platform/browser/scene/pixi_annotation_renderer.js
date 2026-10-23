// Generic logical-pixel scene annotations with separate static/overlay caches. A producer supplies reusable models
// and increments each revision on change, so a moving overlay does not rebuild a static metre grid.
export class PixiAnnotationRenderer {
  #primary;
  #overlay;

  constructor({ pixi, stage }) {
    this.#primary = { graphics: new pixi.Graphics(), model: null, revision: -1 };
    this.#overlay = { graphics: new pixi.Graphics(), model: null, revision: -1 };
    this.#primary.graphics.visible = false; this.#overlay.graphics.visible = false;
    stage.addChild(this.#primary.graphics, this.#overlay.graphics);
  }

  update(model) {
    const primaryChanged = this.#updateLayer(this.#primary, model);
    const overlayChanged = this.#updateLayer(this.#overlay, model?.overlay ?? null);
    return primaryChanged || overlayChanged;
  }

  #updateLayer(layer, model) {
    const graphics = layer.graphics;
    if (!model) {
      if (!graphics.visible) return false;
      graphics.visible = false; layer.model = null; return true;
    }
    if (model === layer.model && model.revision === layer.revision && graphics.visible) return false;
    layer.model = model; layer.revision = model.revision;
    graphics.visible = true; graphics.clear();
    // Optional cell lines under everything (spec 129 D5), then rects (lineWidth / fillAlpha: a selected zone and its
    // handles), then the metre lines.
    for (let i = 0; i < (model.cellLineCount ?? 0); i++) {
      const l = model.cellLines[i];
      graphics.moveTo(l.x1, l.y1).lineTo(l.x2, l.y2);
    }
    if (model.cellLineCount) graphics.stroke({ color: 0xffffff, alpha: model.cellLineAlpha ?? .2, width: 1 });
    for (let i = 0; i < model.rectCount; i++) {
      const r = model.rects[i];
      if (r.shape === "ellipse") graphics.ellipse(r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2);
      else if (r.shape === "polygon") graphics.poly(r.points, true);
      else graphics.rect(r.x, r.y, r.width, r.height);
      graphics.fill({ color: r.color, alpha: r.fillAlpha ?? .12 })
        .stroke({ color: r.color, alpha: r.strokeAlpha ?? .9, width: r.lineWidth ?? 1 });
    }
    for (let i = 0; i < model.lineCount; i++) {
      const l = model.lines[i];
      graphics.moveTo(l.x1, l.y1).lineTo(l.x2, l.y2);
    }
    if (model.lineCount) graphics.stroke({ color: 0x88ddff, alpha: .5, width: 1 });
    return true;
  }
}
