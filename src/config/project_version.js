/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.18.7";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "stamina-endurance-split",
  updatedAt: "2026-05-25",
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
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
