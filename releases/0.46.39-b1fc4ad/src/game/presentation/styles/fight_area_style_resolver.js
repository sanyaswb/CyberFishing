import { FISHING_ZONE_COLORS, FISHING_ZONE_LOOK, fishingZoneRgba } from "./fishing_zone_colors.js";

const fill = key => fishingZoneRgba(FISHING_ZONE_COLORS[key], FISHING_ZONE_LOOK.fillAlpha);
const stroke = key => fishingZoneRgba(FISHING_ZONE_COLORS[key], FISHING_ZONE_LOOK.strokeAlpha);

// The fight-area overlays' styles in the fishing zones' one look (spec 136 R3-1): light fill, thin solid outline.
export class FightAreaStyleResolver {
  #configProvider;
  #cache = null;

  constructor({ configProvider }) {
    if (typeof configProvider !== "function") {
      throw new TypeError("FightAreaStyleResolver requires configProvider");
    }
    this.#configProvider = configProvider;
  }

  resolve() {
    if (this.#cache) return this.#cache;
    const config = this.#configProvider() || {};
    this.#cache = Object.freeze({
      lineWidth: FISHING_ZONE_LOOK.lineWidth,
      catchFill: config.color || fill("catch"),
      catchStroke: config.strokeColor || stroke("catch"),
      lastDashFill: config.lastDashFillColor || fill("lastDash"),
      lastDashStroke: config.lastDashStrokeColor || stroke("lastDash"),
      lastDashDash: Object.freeze(Array.isArray(config.lastDashDash) ? config.lastDashDash.slice() : []),
      netFill: fill("net"),
      netStroke: stroke("net"),
      sectorFill: fill("sector"),
      sectorClampedFill: fill("sectorClamped"),
      sectorStroke: stroke("sector"),
      sectorClampedStroke: stroke("sectorClamped"),
      lineRadiusFill: fill("line"),
      lineRadiusStroke: stroke("line"),
    });
    return this.#cache;
  }

  invalidate() {
    this.#cache = null;
  }
}
