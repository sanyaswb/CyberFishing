/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.43";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "fishing-domain-primitives-ii",
  updatedAt: "2026-08-24",
  notes: Object.freeze([
    "Migrate six dependency-free fishing primitives to named game-domain ESM exports",
    "Extend the single cumulative runtime from nineteen to twenty-five project modules",
    "Preserve six exact legacy exposure positions through approved activation shims",
    "Keep fishing calculations, state ownership and classic consumer behavior unchanged",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
