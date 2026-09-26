/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.59";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "post-freeze-domain-graph-review",
  updatedAt: "2026-09-26",
  notes: Object.freeze([
    "Complete the Stage 3.22 post-freeze Domain graph review without module migration",
    "Resolve activation shims to ESM owners in a logical graph of 135 Domain modules",
    "Freeze a new approved prefix of 11 batches and 21 modules from batch 022",
    "Keep the runtime topology at 78 modules, 87 activations and 139 bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
