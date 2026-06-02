/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.19.17";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "debug-oop-runtime",
  updatedAt: "2026-06-02",
  notes: Object.freeze([
    "Debug console runtime is split into class-based core, services and modules",
    "src/debug/debug.js now acts as the single debug composition bootstrap",
    "Small root debug wrapper files were removed while keeping the public window debug API",
    "Debug remains optional for prod through null-safe adapters",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
