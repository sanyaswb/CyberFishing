# Implementation Plan: Live Bait, Keepnet and Aquarium

**Branch**: existing develop checkout | **Revision**: 2026-10-12 | **Spec**: [spec.md](spec.md)

## Current scope

The owner replaces species-specific care and unused death-order ties with shared aquarium feed. Every catalog species up to 100 g uses the existing common live_crucian catalog identity, preserving predator matching and inventory saves. Hook motion uses the configured common source swim profile; species appearance and caught facts remain individual. Existing room progression, global time, ordinary groundbait and fights are unchanged.

## Ownership and boundaries

- CaughtFishCollection records remain the authoritative fish identities, dispositions, caught rarity/art/special flags and keepnet lifetime. No duplicate inventory bait record.
- AquariumState owns install/level/capacity and snapshot feed/episode facts. AquariumCareCalculator receives configuration and computes population-adjusted duration. AquariumStarvationPolicy derives independent deadlines from an episode seed and fish ID.
- Inventory owns stock by aquarium pack ID. FeedSupplyState applies consumption to detached command/care projections and owns selected feeder pack/settings. The raw feature catalog supplies three qualities and eleven pack sizes separately from ordinary groundbait.
- LiveBaitCareService applies feed/death events in chronological real time. Manual feeding saves a sampled seed; offline refills advance that seed deterministically. Read projection never calls a live RNG, writes storage or mutates the authoritative snapshot. Commands settle care first and persist one revision, including care elapsed before a rejected command.
- LiveBaitSnapshotStore validates versions 1/2/3/4 and migrates old feature snapshots at the same key. Old portions become Simple 500 g packs and V3 stock transfers once into inventory v4. The smallest occupied species fraction becomes shared Simple protection; unfed legacy countdowns retain their remaining life. Unknown historical anomaly/unique fields remain null and separate. Invalid bytes remain recoverable. Inventory keeps schema v4 and unrelated records stay intact.
- KeepnetViewModel groups only presentation data. Ordinary fish group by species; special or unknown-status catches get individual groups. Rarity, weight and stable ID select a representative. Existing detail commands retain individual identity and confirmation.
- AquariumFishMotion owns visual-only positions, size, speed and direction. AquariumFishView owns cached thumbnail loading, Canvas rendering and resize/animation lifecycle. Configuration and browser scheduling are injected by production bootstrap. No gameplay facts move into rendering.
- Development bootstrap sends validated presentation settings to its same-origin embedded house; production checks message origin and source and imports no DEV. Existing DEV configuration editing provides all motion/grid/zone fields.

## Changed files and organization

Feature config and validator; domain/live_bait duration, starvation and stock policies; application/live_bait care, commands and snapshot; bootstrap composition; presentation/house dedicated motion and view plus house feed controls; presentation/keepnet grouping/cards/styles. Reduced assets mirror assets/fish under assets/fish-thumbnails. convert-images.js adds an explicit noninteractive --thumbnails mode that preserves originals.

## Gameplay decisions

Duration = max(configured one-minute minimum, pack base × quantity − quality penalty × max(0,N−1)). Population changes retain elapsed protection time. Feeding replaces rather than accumulates protection. Empty feed starts the last quality's 1/3/6-hour starvation window, with individual deadlines in (start,end]. New arrivals share the remaining episode window. Feeding clears surviving deadlines; terminal fish cannot revive. Keepnet/hook life remains independently sampled 30–60 minutes and transfers do not reset it.

## Validation

Focused deterministic scenarios cover every pack for one/three fish; random deadline bounds, projection/reload identity, rescue/re-depletion and all-dead horizon; finite automatic stock and threshold; 24-hour absence and backward clocks; legacy/corrupt saves; common bait eligibility and hook identity; rarity/weight representatives and special isolation; visual bounds and resize. Keepnet DOM checks retain focus/scroll/individual commands. Run Architecture, Quick and Full. The owner performs further browser/mobile checks per the latest instruction. Record actual evidence in quickstart.md.

## Remaining feature work outside this revision

T039 full owner gameplay acceptance, T040 owner care/movement play check, T048 multi-room navigation and T052 immutable packaged-release browser smoke remain tracked separately. Full's release check tests the committed release; publication repeats that check after commit. Future cloud progress needs an explicit spec-029 contract/version change. Source push and Pages publication are authorized for v0.34.1.

Release update, 2026-10-14: v0.35.0 completes T040's metadata/documentation preparation and incorporates the staged/additive feed contract in spec 061 plus the shared preview in spec 062. T052 is completed: committed packaging verifies 770 files/669 modules, all seventeen room assets and closed House/catalog module/style graphs; packaged index/DEV/House/catalog console startup is clear. Owner care/movement play acceptance remains T039, and a second room remains T048. The current owner request authorizes source commit/push; it does not request a new Pages deployment.

## v0.34.1 inventory ownership

Resolved item_catalog adds aquarium pack definitions from the existing feed configuration. Inventory keeps schema v4 and owns pack quantities. AquariumFeedInventoryPort reads detached stock projections and prepares targeted inventory changes through FlatInventoryItemRepository; unrelated items/equipment/settings stay intact. Feature snapshot v4 strips projection stock and migrates previous stock once. BrowserSnapshotTransaction journals the inventory/feature compare-and-swap pair and recovers only known before/after states. Game composition initializes inventory before feature care, then synchronizes targeted feed items after commits or iframe storage events.

A dedicated AquariumFeedPicker owns list/dialog selection only; authoritative quantity validation and consumption remain application commands. House composition injects it and removes the former acquisition/dropdown controls. Native phone scrolling requires allowing touch panning at the modal shield and scroll container; pointer grab applies to mouse.
