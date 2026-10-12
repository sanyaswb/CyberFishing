# Local Save, Page, and Asset Contract

## Local snapshot

- Key: `player_live_bait_v1` through an injected adapter using the existing storage prefix; `schemaVersion` is exactly `1`.
- Canonical fields: `revision`, `lastAppliedAtMs`, `fish[]`, `resolvedCatchIds`, `aquarium`, `feedSupply`, `selectedFishId`. Serialize no computed bar widths, formatted countdowns, DOM state, raw species physics, or full config copies.
- Validate finite weights/timestamps, safe integer counts/revisions, known dispositions, unique fish/catch IDs, catalog species, reference integrity, capacity, and `[0,1]` feed fractions before hydration. Preserve unknown/corrupt stored bytes and surface an error.
- Save once after an accepted command/care settlement, never every frame. Detect observed stale revisions from another page/tab and surface conflict before overwriting; do not automatically merge. Browser localStorage does not provide atomic compare-and-swap, so truly simultaneous cross-tab writes remain a documented limitation until authoritative storage exists.
- An absent key means empty feature state, not a reset of inventory `player_inventory_v2` or location chum.
- Future cloud progress requires an explicit versioned update of spec 029's envelope/server validation; do not silently append this section to v1.
- Room progress uses `cyber_fishing_room_1_v1` with level, target level and completion time; day/night time uses `cyber_fishing_game_time_v1` with a wall-clock anchor and scale. Both are separate from live-bait and inventory saves.

## Page entry and imports

`fisherman-house.html` loads exactly one module entry, `src/entrypoints/house.entry.js`, which imports only production bootstrap. Production bootstrap composes domain/application, presentation, and browser adapters; it imports no DEV module. Temporary house navigation is injected into DEV tools through development bootstrap. Register house as a production entry in architecture checks and release reachability.

## Art

| Owner-provided filename | Destination in repository | Role |
| --- | --- | --- |
| Fifteen room level JPEGs | `assets/house/room-1/lvl-1` through `lvl-5` | Day/evening/night backgrounds |
| `room--1_aqua.png` | `assets/house/room-1/room--1_aqua.png` | Separate aquarium layer on table |
| `under-renovation.png` | `assets/house/room-1/under-renovation.png` | Transparent art above the renovation dimmer |

The room JPEGs are 2752×1536; both overlay PNGs carry alpha. Keep the aquarium separate and align it with the central table. Verify desktop/mobile placement and include the house page, CSS, production module graph, and all seventeen art files in immutable release and version-copy paths.
