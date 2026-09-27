/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.73";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "items-condition-resolver-domain",
  updatedAt: "2026-09-27",
  notes: Object.freeze([
    "Adopt the Stage 3.36.0 approved prefix (batches 035 to 038)",
    "Migrate the item condition resolver",
    "Extend the completed-prefix ItemBoundedMetricResolver through a reviewed import",
    "Keep the presentation descriptor factory injected by composition",
    "Preserve one hundred seven project modules, ninety-nine activations and one hundred forty-three bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
