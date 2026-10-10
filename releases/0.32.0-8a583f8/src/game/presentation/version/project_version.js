/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
export const CURRENT_PROJECT_VERSION = "0.32.0";

export const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "isolated-dev-fight-stages",
  updatedAt: "2026-10-10",
  notes: Object.freeze([
    "Production composes inactive DEV ports: GodMode, debug events, session diagnostics and listener counting stay off whatever the configuration says",
    "Fight physics runs as nine per-session pipeline stages; the DEV fight snapshot builder lives in DEV",
    "A new player's inventory starts in the current save format without the legacy conversion; Pages releases are immutable directories",
  ]),
});

