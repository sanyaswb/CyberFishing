# Post-closure cleanup: work package G

Base: release 0.26.0, `stage5-closed`, commit `1e398c00e4b5abdba5ffd1be40eeeeab396b10f7`.
This is a later cleanup, not a rewrite of the Stage 5 closure or original cluster 028.
Preparation 031 is the exact removal successor. Verification is recorded there after execution.

## Removed consumers and providers

The authored source, native import graph, classic DEV document, current test catalog,
build roots and literal references were inspected before deletion. `InventoryUI` in
`src/ui/ui.js` has no construction or reader. Inventory V2 is composed in
`src/app/bootstrap/inventory_ui_bootstrap.js`; loadout saving uses its existing command
path. The only caller of `InventoryManager.saveBuild` was the removed `InventoryUI`.
Delete that 104-line method without changing the remaining inventory implementation.

Removing this consumer retires three exact bridges: HorizontalScrollController,
InventoryEquipTargetSelectionPolicy and its UIUtils bridge. Only the first two lose
their final classic holder and activation. The native horizontal-scroll implementation
stays injected into Inventory V2. UIUtils stays available to actual DEV overlay/drag
readers through their existing bridges and activation. Remove the unused equip-target
policy and its classic shim.

Neither fish profile helper has a native import or authored reader. Remove both ESM
helpers and their two inert classic placeholders. The game-cycle loader previously
loaded these empty placeholders; removing those loads changes no scenario or output.
The eight removed files and exact manifests, surfaces, debts and bytes are listed in
preparation 031. Five browser debts disappear with their sole source `src/ui/ui.js`.
The historical globals baseline remains 852; no exception or guard is expanded.

## Retained candidates and removal conditions

| Candidate | Actual holder / reason | Removal condition |
| --- | --- | --- |
| BuffManager | `utils/game-cycle-check.js`: multiplier stacking and deltaTime expiry scenario | Separate coverage/API review must establish that the scenario is obsolete or has equivalent coverage before deleting the API. Keep the scenario and stdout unchanged here. |
| InventoryGameplayFacade.evaluateBiteReadiness / evaluateChumBonus | `utils/inventory-v2-integration-check.js`: empty stack cannot bite and has no chum bonus | Separate API/coverage decision; preserve these existing contracts in this migration. |
| FishingReadinessPolicy.evaluateChumBonus | Facade above and `utils/inventory-v2-equipment-check.js`: missing chum only removes its bonus | Same separate API/coverage review; no gameplay rule rewrite. |
| Retired classic placeholders and retained global activations | Exact `dev.html` logical slots, cumulative runtime identity contracts, load-order/retirement fixtures and historical record validation | Migrate the listed classic DEV holders to native DEV in Stage 6, remove their exact load tags, then independently audit remaining test/build holders. A retired activation is not evidence that its placeholder can be deleted without updating its live load-order contract. |

## Historical identity and recovery

Four harmless HTML comments retain the removed logical slots 7, 8, 86 and 227.
They execute no code. Slot 228 keeps its nine other members; the parser preserves
every surviving historical slot identity. The existing records gate validates the
exact comments and split successor against preparation 031, and rejects unreviewed
changes. Existing applied records still validate removed targets against their
archived bytes and manifest identities; the live build excludes only recorded removals.

Annotated tag `stage5-dead-code-archive` points to raw-byte snapshot commit
`81ba1feaea248ebdccef5fb4bfdf433290f4a1a6` (parent: the closure commit). This preserves
all eight deleted files and the inventory implementation before method removal,
including mixed line endings. For byte-exact recovery, read the blob with a binary
Git/Node subprocess and write its Buffer directly; shell text pipelines may alter
encoding or line endings. Preparation 031 records raw SHA256 and the exact archive Git blob IDs (`gitBlob`).
Normalized historical blobs are obtained from its baseCommit and may differ for mixed
line endings; they are not byte-exact recovery substitutes. Frozen Stage 3/4 and Stage 5 closure records remain unchanged.

## Acceptance

Require focused inventory/runtime/record checks, unchanged game-cycle stdout SHA256,
Quick 24/24, Architecture 32/32, uncached Full 64/64, and Codex built-in native/DEV
browser acceptance. Verify inventory, save bytes/reload, canonical identities, loop,
live flags, console and cleanup. Record actual coverage and limitations; owner play
is not a gate. A later patch release uses the existing release projection.

Executed result: all gates PASS. Full ran 2026-10-05 11:32:32–11:33:07 UTC on the
closed HEAD plus this cleanup and guard/test successors, with unchanged snapshot
`0da3f5e3915d119ec724545633cec3c4b44abaf12720a7717c627baedd6c647d`.
Quick and Architecture used the same snapshot. AcceptanceReportValidator accepted
the complete uncached report before release or evidence/document updates.
Game-cycle stdout SHA256 remains
`0db62de21427af5589fa5294b53dd833522298356d1d6b7a6ce0a009f2782c6f`.

Reviewed release 002 chooses patch 0.26.1 after 0.26.0 for this proven unused-code
removal. It uses the existing six-file Stage 5 metadata-only projection; no dependency
or gameplay implementation changes follow Full. The normal dev server rebuilt DEV
compatibility before browser acceptance. A stale 0.25.2 badge expectation was corrected
to the current package version, preserving every badge behavior assertion; the final
Full includes this correction. The package contract now states its actual 344 selected
inputs and 26 activations (the complete DEV bundle has 346 project modules).

Current metrics: src 802 JS/JSON files / 80,547 lines, down eight files / 1,509 lines;
utils 216 / 46,782, up 135 lines for exact archival/successor validation and negative
fixtures, below 70,358. The existing 64-check catalog and all historical negative
cases remain. New cases reject invalid removal identity/recovery, an active target
removal and invalid tombstone positions. The live runtime has 50 bridges, 26 active
activations, 380 retired, five inert and 19 debts, with the globals baseline still 852.

Browser acceptance at 0.26.1 confirms native/DEV identities, shared config owner,
Fixed Catch injection, live flags, one loop, identical inventory and all four stored
strings including the DEV section key, reload and zero console issues. The UI correctly
rejects saving an already-owned loadout on both pages; successful operations are
covered by the unchanged inventory tests. pagehide clears handles, loops and managed
listeners. Original saves were restored; owned tabs/server/probes were released.
The browser is a startup/UI/lifecycle smoke, not an owner play or long fight session.
Reports are `architecture/archive/stage5_post_closure_cleanup_acceptance.json` and
`architecture/archive/stage5_post_closure_cleanup_browser.json`; preparation 031 pins
their hashes. Next implementation is native DEV in `../stage_6_handoff.md`.
