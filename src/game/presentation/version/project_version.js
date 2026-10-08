/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
export const CURRENT_PROJECT_VERSION = "0.30.1";

export const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "cleanup-complete",
  updatedAt: "2026-10-08",
  notes: Object.freeze([
    "Unused progression styling and readiness APIs retired; optional tier badges respect metadata visibility",
    "World perspective separated from camera state with unchanged gameplay and frame calculations",
    "Test doubles isolated; diagnostics names and Git-tracked project structure are consistent",
  ]),
});

