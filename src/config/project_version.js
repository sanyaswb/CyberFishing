/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.72";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "fishing-hot-loop-cluster-domain",
  updatedAt: "2026-09-27",
  notes: Object.freeze([
    "Migrate the six hot-loop fishing modules frozen by the review-queue extension",
    "Import ReelHoldLoadPolicy, RodControlAngleResolver and RodControlTensionModeResolver from the completed prefix",
    "Move the guarded window exposure of PlayerReelFatigueSession to the exact activation shim",
    "Reproduce every recorded member fingerprint and game-cycle trace after the cutover",
    "Retire the ReelHoldLoadPolicy, RodControlAngleResolver and RodControlTensionModeResolver activations",
    "Preserve one hundred six project modules, ninety-eight activations and one hundred forty-three bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
