// One look for the fishing zones (spec 136 R3-1): the game's fight-area overlays and the DEV location editor's
// previews draw them with these colours, a light fill, a thin solid outline. A clamped fight sector keeps its own colour.
export const FISHING_ZONE_COLORS = Object.freeze({
  handChum: "#ffb347",
  net: "#33dd88",
  lastDash: "#b366ff",
  catch: "#3388ff",
  sector: "#ff8844",
  sectorClamped: "#ff3344",
  line: "#dddddd",
  chum: "#ffdd33",
});

export const FISHING_ZONE_LOOK = Object.freeze({ fillAlpha: 0.15, strokeAlpha: 0.6, lineWidth: 1 });

// "#rrggbb" and an alpha as a CSS colour string for the 2D and WebGL renderers.
export function fishingZoneRgba(hex, alpha) {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
