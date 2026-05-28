/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.19.10";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "fish-tension-separation",
  updatedAt: "2026-05-28",
  notes: Object.freeze([
    "Modular fish database categories",
    "Reusable fish physics profile presets",
    "Runtime config override store for DevTools",
    "Immutable base CONFIG snapshot",
    "Overlay metric buttons print formulas and influencing runtime values to console",
    "Desktop overlay metric buttons trigger on pointerdown to avoid redraw-hover click loss",
    "Debug overlay renders metric inspector buttons directly without DOM rescanning",
    "Debug overlay HTML redraws are cached and update cadence is configurable",
    "Fish stamina scales from base stamina plus fish weight in grams times fish level",
    "Last-level under-average fish can receive a configurable boss stamina multiplier",
    "Fish stamina and endurance now have separate maxima",
    "Stamina defaults to 10 percent of endurance via configurable ratio",
    "Simplified fight model config groups are available for water, direction force, rod hold and tension",
    "Fish profiles expose baseSpeed and behavior force/speed multipliers for the new fight model",
    "Rod engine stats expose holdTensionRatio for future hold-to-tension transfer",
    "Simple fight force calculator exposes passive, active, hold, tension, net force and speed results",
    "Fight pipeline now uses simple passive/active fish force plus rod hold tension transfer",
    "Rod hold charges against rod reserve only while line stress comes from total tension",
    "Tension debug now exposes fish, player, total and rod/line/hook stress ratios",
    "Fight overlay shows simplified fish, player, movement and tension sections",
    "Overlay metric inspector includes simplified fight formula entries",
    "Movable fish cap limits hold tension while excess player force becomes movement speed",
    "Crucian stalker fish profile uses only simplified force and movement fields",
    "Fish config validation rejects old resistance/retrieve/ratio fight fields",
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
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
