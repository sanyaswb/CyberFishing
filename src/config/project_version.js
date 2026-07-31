/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.23.44";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "embedded-float-ballast",
  updatedAt: "2026-07-31",
  notes: Object.freeze([
    "Removed the standalone sinker item and float-rig sinker slot",
    "Moved sinking speed, height and current compensation profiles into the float",
    "Separated feeder springs into a dedicated feederRig equipment slot",
    "Preserved feeder spring physics and automatic bottom-depth casting",
    "Migrated legacy feeder rigs from sinkerId and removed obsolete sinker inventory entries",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
