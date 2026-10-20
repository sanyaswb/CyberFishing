# TK-011 — Targeted compatible pick filters

Owner request: 2026-10-20. Implementation: v0.45.31; owner acceptance pending.

An empty equipment cell or editor socket starts the Compatible category scoped to that exact target,
including rod readiness/type rules and assembly parent/socket identity. Select all available subtype groups
for that list (rod families, reels, lines, tackle, auxiliary items or header consumables). Changing the target
replaces the automatic group selection; an empty target stays empty. Explicit category/subfilter browsing,
rarity filters, ordering and the TK-010 repeated selection contract remain available.

InventoryViewModelFactory reuses authoritative compatibility policies for the visible list and projects the
initial subtype IDs with the existing InventorySubfilterResolver. Bootstrap injects that query into commands;
InventoryUiState remains the sole owner of the selected IDs. No presentation/browser imports in application,
new globals, save changes or per-frame queries. Projection queries never mutate equipment or UI state.

Existing inventory-integration check first reproduced mixed rod/boat/net/chum results, then passes for rod
families, manual narrowing, changed auxiliary target, explicit All browsing and an exact reel-line socket.
No replaced tool, helper, fixture or dependency. Full ran: 64/65 pass, including Architecture/Quick;
the Pages working-graph check uses HEAD paths and needs the prior pair's new pick-cancel controller committed.
Owner checks remain pending; no browser visual inspection by the agent.

## Owner acceptance correction — v0.45.34 (2026-10-21)

Repeating a green equipment cell called the loose-root path, bypassing assembly initialization. A hook
appeared equipped but had no bait target; feeder rigs and other attachment-capable roots shared that path.
Initialize/prepare their assembly state within the existing equip transaction before assigning equipment.
The header command also repairs an already equipped loose single root missing its assembly, preserving
identity and item counts; its equipment reservation is released/restored only inside an atomic transaction.
Read models remain pure, saved loadouts keep their existing handling and the save schema is unchanged.
Integration tests first reproduce the missing hook socket, then verify both layout modes, stacks, immediate
bait/chum attachment, repaired save/reload and full rollback of counts/state/equipment on persistence failure.
