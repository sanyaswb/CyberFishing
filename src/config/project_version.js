/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.32";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "classic-bridge-build-foundation",
  updatedAt: "2026-08-21",
  notes: Object.freeze([
    "Add an execution-state contract for ordered Stage 2 migration batches",
    "Validate exact bridge registries, minimal wrappers and recursive dependency closures",
    "Provide deterministic synchronous IIFE bridge builds with defensive output staging",
    "Keep the bridge registry empty and preserve the 424-script classic runtime",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
