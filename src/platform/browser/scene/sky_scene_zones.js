// Spec 182 D1 (TK-350, TK-356) and spec 188 D2, D8: the sky on screen for a sky effect (the starfall, the lightning) —
// the visible parts of the sky zones (world.skyRegions) clipped by one stencil mask on the effect's own layer, redrawn
// only when the zones change; with the zones switched off (world.skyZoned false) the background's top third and no mask.
// One instance per effect: a mask belongs to one layer (Pixi 8 turns a mask's includeInBuild back on when any container
// drops it, so a mask shared by two layers could be drawn as content).
import { BackgroundPlacement } from "./background_placement.js";
import { ScreenZoneSet } from "./screen_zone_set.js";
import { ZoneRectMask } from "./zone_rect_mask.js";

const NO_REGIONS = Object.freeze({ count: 0, getAt: () => null });

export class SkySceneZones {
  #zones = new ScreenZoneSet();
  #background = new BackgroundPlacement();
  #mask;

  // target: the effect's layer the mask clips.
  constructor({ pixi, target }) {
    this.#mask = new ZoneRectMask({ pixi, target });
  }

  // The visible sky (ScreenZoneSet: pick, contains, boundsAt, areas).
  get zones() {
    return this.#zones;
  }

  // The mask lives in the scene for its transform (Pixi does not draw a mask itself).
  mount(stage) {
    this.#mask.mount(stage);
  }

  prepare(world, viewWidth, viewHeight) {
    const zoned = world.skyZoned === true;
    const regions = world.skyRegions ?? NO_REGIONS;
    if (!zoned) {
      const view = this.#background.place(world, viewWidth, viewHeight), fallback = this.#zones.fallback;
      fallback.x = view.x; fallback.y = view.y; fallback.width = view.width; fallback.height = view.height / 3;
    }
    this.#zones.prepare(zoned ? regions : null, viewWidth, viewHeight);
    if (zoned) this.#mask.clipTo(regions);
    else this.#mask.release();
  }
}
