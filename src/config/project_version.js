/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.86";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "equipment-compatibility-policy-domain",
  updatedAt: "2026-10-01",
  notes: Object.freeze([
    "Migrate the equipment compatibility policy with its reviewed global exposure",
    "Import the slot catalog, slot visibility, terminal-line and rod capability collaborators",
    "Preserve one hundred forty-two project modules, one hundred thirty-two active activations and one hundred ninety-seven bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
