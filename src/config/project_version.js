/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.19.15";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "line-rod-stroke-debug",
  updatedAt: "2026-05-31",
  notes: Object.freeze([
    "Stabilized reel hold recovery loading, config labels and hard tension block semantics",
    "ReelHold remains separated from rodHold as safe post-stroke line recovery",
    "Golden checks now cover the simplified examples and small-fish movable tension cap",
    "Production cleanup removed unused legacy pressure-transfer and water-drag fight helpers",
    "Docs now describe only the simplified passive/active fish force, rodHold and reelHold model",
    "Hooked fight movement now applies the simplified model speed directly without agility velocity damping",
    "WaterEntity damping no longer re-applies to hooked fight movement; drag remains the official speed/tension limiter",
    "Drag escape speed now uses fishWonForceKg instead of total tension",
    "Reel drag tension now comes from blocked fish-won Y force plus player hold tension",
    "Open drag has no excess force/speed because it blocks nothing",
    "Y drag projection uses the normalized movement Y component",
    "PlayerForceSystem no longer exposes legacy drag read-model fields",
    "Drag debug now reports blocked force, excess force and final Y speed from DragForceCalculator",
    "Fish tension stays based on fish opposition while fishWonForceKg controls escape movement only",
    "Movable hold tension cap now scales from current fish opposition",
    "Reel drag is now a Y-force threshold: Y escape starts only from fish-won Y force above drag limit",
    "Open drag blocks no Y force, while exhausted line reserve blocks all Y escape into tension",
    "Line and rod stroke overlay blocks expose released/recovered line, pump credit and stroke reset/sync reasons",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
