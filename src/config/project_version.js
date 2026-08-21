/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.31";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "modular-architecture-foundation",
  updatedAt: "2026-08-21",
  notes: Object.freeze([
    "Freeze the evidence-backed Stage 2 ESM migration batches",
    "Enforce architecture boundaries, globals, browser capabilities and dev separation",
    "Provide reproducible native ESM and isolated Vite build infrastructure",
    "Preserve the classic-script runtime and gameplay behavior through Stage 1",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
