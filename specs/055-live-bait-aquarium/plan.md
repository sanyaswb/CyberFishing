# Implementation Plan: Live Bait, Keepnet and Aquarium

**Branch**: existing develop checkout | **Revision**: 2026-10-12 | **Spec**: [spec.md](spec.md)

## Current scope

The owner replaces species-specific care and unused death-order ties with shared aquarium feed. Every catalog species up to 100 g uses the existing common live_crucian catalog identity, preserving predator matching and inventory saves. Hook motion uses the configured common source swim profile; species appearance and caught facts remain individual. Existing room progression, global time, ordinary groundbait and fights are unchanged.

## Ownership and boundaries

- CaughtFishCollection records remain the authoritative fish identities, dispositions, caught rarity/art/special flags and keepnet lifetime. No duplicate inventory bait record.
- AquariumState owns install/level/capacity and snapshot feed/episode facts. AquariumCareCalculator receives configuration and computes population-adjusted duration. AquariumStarvationPolicy derives independent deadlines from an episode seed and fish ID.
- FeedSupplyState owns stock by aquarium pack ID and selected feeder pack. The raw feature catalog supplies three qualities and eleven pack sizes separately from ordinary groundbait.
- LiveBaitCareService applies feed/death events in chronological real time. Manual feeding saves a sampled seed; offline refills advance that seed deterministically. Read projection never calls a live RNG, writes storage or mutates the authoritative snapshot. Commands settle care first and persist one revision, including care elapsed before a rejected command.
- LiveBaitSnapshotStore validates versions 1/2/3 and migrates old feature snapshots at the same key. Old portions become Simple 500 g packs. The smallest occupied species fraction becomes shared Simple protection; unfed legacy countdowns retain their remaining life. Unknown historical anomaly/unique fields remain null and separate. Invalid bytes remain recoverable. Inventory v4 bytes stay untouched.
- KeepnetViewModel groups only presentation data. Ordinary fish group by species; special or unknown-status catches get individual groups. Rarity, weight and stable ID select a representative. Existing detail commands retain individual identity and confirmation.
- AquariumFishMotion owns visual-only positions, size, speed and direction. AquariumFishView owns cached thumbnail loading, Canvas rendering and resize/animation lifecycle. Configuration and browser scheduling are injected by production bootstrap. No gameplay facts move into rendering.
- Development bootstrap sends validated presentation settings to its same-origin embedded house; production checks message origin and source and imports no DEV. Existing DEV configuration editing provides all motion/grid/zone fields.

## Changed files and organization

Feature config and validator; domain/live_bait duration, starvation and stock policies; application/live_bait care, commands and snapshot; bootstrap composition; presentation/house dedicated motion and view plus house feed controls; presentation/keepnet grouping/cards/styles. Reduced assets mirror assets/fish under assets/fish-thumbnails. convert-images.js adds an explicit noninteractive --thumbnails mode that preserves originals.

## Gameplay decisions

Duration = max(configured one-minute minimum, pack base − quality penalty × max(0,N−1)). Population changes retain elapsed protection time. Feeding replaces rather than accumulates protection. Empty feed starts the last quality's 1/3/6-hour starvation window, with individual deadlines in (start,end]. New arrivals share the remaining episode window. Feeding clears surviving deadlines; terminal fish cannot revive. Keepnet/hook life remains independently sampled 30–60 minutes and transfers do not reset it.

## Validation

Focused deterministic scenarios cover every pack for one/three fish; random deadline bounds, projection/reload identity, rescue/re-depletion and all-dead horizon; finite automatic stock and threshold; 24-hour absence and backward clocks; legacy/corrupt saves; common bait eligibility and hook identity; rarity/weight representatives and special isolation; visual bounds and resize. Keepnet DOM checks retain focus/scroll/individual commands. Run Architecture, Quick, Full and index/dev/house browser smoke. Record actual evidence in quickstart.md.

## Remaining feature work outside this revision

T039 full owner gameplay acceptance, T040 owner care/movement play check, T048 multi-room navigation and T052 immutable packaged-release smoke remain tracked separately. Full's release check tests the committed release, so publication requires a later commit/release validation. Future cloud progress needs an explicit spec-029 contract/version change. No backend or publication action is included here.
