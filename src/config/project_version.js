/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.76";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "assemblies-profile-registry-domain",
  updatedAt: "2026-09-28",
  notes: Object.freeze([
    "Migrate the assembly profile registry",
    "Keep the profile table injected by the composition roots",
    "Complete the Stage 3.36.0 approved prefix",
    "Preserve one hundred thirteen project modules, one hundred two activations and one hundred forty-three bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
