/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.20.0";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "render-architecture",
  updatedAt: "2026-06-18",
  notes: Object.freeze([
    "Split the legacy Renderer into focused world, casting, fishing, HUD and outcome renderers",
    "Added a reusable render frame, frame builders, ordered render passes and a render coordinator",
    "Moved game states to render intents instead of direct Canvas draw calls",
    "Centralized Victory layout, image asset preload and render ordering",
    "Added architecture, pipeline, asset, allocation and render regression checks",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
