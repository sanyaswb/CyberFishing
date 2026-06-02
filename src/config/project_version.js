/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.19.19";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "overlay-oop-runtime",
  updatedAt: "2026-06-02",
  notes: Object.freeze([
    "Debug overlay runtime moved into class-based config, core, DOM, service and module layers",
    "Fight physics overlay is split into dedicated section classes",
    "Overlay metric descriptions now live in config metadata and load through a catalog service",
    "Overlay remains optional for prod through null-safe debug adapters",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
