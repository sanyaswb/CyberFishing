/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.23";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "canonical-item-runtime",
  updatedAt: "2026-08-12",
  notes: Object.freeze([
    "Use itemType, variant and effectiveStats exclusively at runtime",
    "Remove legacy item flattening from gameplay and UI read models",
    "Migrate inventory schema 2 saves to canonical schema 3 at load time",
    "Keep legacy item conversion inside the persistence boundary",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
