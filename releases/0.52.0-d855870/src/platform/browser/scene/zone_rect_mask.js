// TK-358: a stencil mask of screen rectangles (zones) for one container: the rain's drops, the water's filtered copy,
// the starfall's layer. It is redrawn only when the rectangles change (a camera move, a zone edit) and assigned to its
// target once. Pixi 8 (vendor/pixi/8.22.0, StencilMask reset) turns a mask's includeInBuild back on when it is
// unassigned, so release() also empties it; and one mask is never shared by two containers (docs/rendering.md 14).
export class ZoneRectMask {
  #graphics;
  #target;
  #rects = [];

  // pixi: Graphics; target: the container it clips.
  constructor({ pixi, target }) {
    if (typeof pixi?.Graphics !== "function") throw new TypeError("ZoneRectMask requires pixi.Graphics");
    if (!target) throw new TypeError("ZoneRectMask requires a target");
    this.#graphics = new pixi.Graphics();
    this.#target = target;
  }

  // The mask lives in the scene for its transform (Pixi does not draw a mask itself).
  mount(stage) {
    stage.addChild(this.#graphics);
  }

  get graphics() {
    return this.#graphics;
  }

  // regions: { count, getAt(i) → { x, y, width, height } }; clips the target to them.
  clipTo(regions) {
    const count = regions ? regions.count : 0;
    const rects = this.#rects;
    let same = rects.length === count * 4;
    for (let index = 0; same && index < count; index += 1) {
      const region = regions.getAt(index), offset = index * 4;
      same = rects[offset] === region.x && rects[offset + 1] === region.y && rects[offset + 2] === region.width &&
        rects[offset + 3] === region.height;
    }
    if (!same) {
      rects.length = count * 4;
      const graphics = this.#graphics;
      graphics.clear();
      for (let index = 0; index < count; index += 1) {
        const region = regions.getAt(index), offset = index * 4;
        rects[offset] = region.x; rects[offset + 1] = region.y;
        rects[offset + 2] = region.width; rects[offset + 3] = region.height;
        graphics.rect(region.x, region.y, region.width, region.height);
      }
      if (count > 0) graphics.fill(0xffffff);
    }
    if (this.#target.mask !== this.#graphics) this.#target.mask = this.#graphics;
  }

  // No clipping: the mask is taken off and emptied (an unassigned mask is drawn again).
  release() {
    if (!this.#target.mask) return;
    this.#target.mask = null;
    this.#graphics.clear();
    this.#rects.length = 0;
  }
}
