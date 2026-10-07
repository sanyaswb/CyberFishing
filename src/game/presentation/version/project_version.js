/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
export const CURRENT_PROJECT_VERSION = "0.27.1";

export const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "stage-6-post-closure-cleanup",
  updatedAt: "2026-10-07",
  notes: Object.freeze([
    "Remove dead import guards, two unreachable DEV modules and three inert package scripts after closure",
    "Preserve gameplay, DEV tools, saves and timing with exact recovery of removed bytes",
  ]),
});

