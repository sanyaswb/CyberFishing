/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.19.16";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "fight-tension-stroke-overlay",
  updatedAt: "2026-06-02",
  notes: Object.freeze([
    "Final line tension is capped by drag when the reel can slip, while raw tension remains available for debug",
    "Rod stroke now loses unrecovered Y-distance when the fish moves away even after hold is released",
    "Fight overlay separates model fight speed from actual applied rod/reel-hold movement speed",
    "Reel hold overlay now shows applied move and applied speed for balancing",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
