/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.79";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "landing-policy-domain",
  updatedAt: "2026-09-30",
  notes: Object.freeze([
    "Adopt the Stage 3.42.0 replacement prefix",
    "Migrate the reel and pole landing policies and their resolver",
    "Export and activate the pure resolveFightPhysicsConfig helper that the retrieve policies read",
    "Preserve one hundred twenty-four project modules, one hundred eighteen active activations and one hundred eighty-one bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
