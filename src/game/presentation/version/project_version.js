/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
export const CURRENT_PROJECT_VERSION = "0.28.0";

export const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "stage-7-lean-repository",
  updatedAt: "2026-10-08",
  notes: Object.freeze([
    "Archive the migration apparatus at migration-final-archive; keep the game, DEV tools, behavior checks and one architecture guard",
    "Retire compatibility APIs and migration-era names; remove unreferenced production code",
    "Split the classic inventory file into one module per class; LF line endings everywhere",
  ]),
});

