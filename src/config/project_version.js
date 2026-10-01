/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.84";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "idle-retrieve-policy-domain",
  updatedAt: "2026-10-01",
  notes: Object.freeze([
    "Migrate the base, passive lure and pole idle retrieve policies and the idle retrieve policy resolver",
    "Import resolveFightPhysicsConfig from the landing policy module and retire its activation from the shared landing policy shim",
    "Preserve one hundred thirty-five project modules, one hundred twenty-six active activations and two hundred one bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
