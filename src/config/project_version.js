/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.75";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "items-bait-freshness-progression-resolvers-domain",
  updatedAt: "2026-09-27",
  notes: Object.freeze([
    "Migrate the bait effectiveness, item freshness and item progression resolvers",
    "Import their owner-created policies and descriptors from the completed prefix",
    "Keep the presentation descriptor factories injected by composition",
    "Move the reviewed globalThis exposures to the exact activation shims",
    "Retire the BaitEffectivenessMatch, ItemBoundedMetricResolver and ItemProgressionDescriptor activations",
    "Preserve one hundred twelve project modules, one hundred one activations and one hundred forty-one bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
