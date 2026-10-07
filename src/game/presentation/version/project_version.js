/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
export const CURRENT_PROJECT_VERSION = "0.27.0";

export const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "stage-6-native-development",
  updatedAt: "2026-10-07",
  notes: Object.freeze([
    "Both pages start from one native module entry; the classic DEV runtime is retired",
    "Preserve gameplay, DEV tools, saves and timing with exact recovery of retired sources",
  ]),
});

