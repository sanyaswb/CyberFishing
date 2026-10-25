# Feature Specification: One power system for devices, battery slot

**Created**: 2026-10-25
**Status**: Specified; Q8–Q14 answered 2026-10-25 (D-P1..D-P7); implementation in progress
**Input**: Owner 2026-10-25 (with spec 142): "rework the discharge so the boat and the radio share one charge/discharge
system, and add a separate slot for the battery". Spec 142 (radio) depends on this spec.

## Current behaviour (verified in code)

- The boat's energy is session-only state: `BaitBoat.energy` (`src/game/application/chum/bait_boat.js:34`), drained in
  `#updateEnergy` by `stats.energyDrainPerSec` (×0.5 while waiting), the boat drifts at 0.
- `ChumService` keeps the last boat's energy in `#boatEnergy` (not saved); `spawnIdleBoat` starts a boat with
  `boatItem.maxEnergy || 100`, although the catalog authors `maxEnergy` per level in `statsByLevel` (60/90/120 for
  levels 1–3), so an idle boat starts at 100 whatever its level. `getBoatEnergy` reads the level from the raw chum
  config, not from the equipped item.
- The inventory meter gets the boat's charge through `setBoatChargeProvider` (`game_composition_root.js:970`).
- A reload restores a full boat: the charge is never persisted.

## Decision

Charge belongs to a **battery item**, not to the device. Devices (the bait boat, the radio, later others) have a
**battery slot** in their assembly and consume the inserted battery. One model serves all of them.

### Model

- **Battery item** (`itemType: "battery"`), e.g. `devices.battery_basic` «Батарейка»: `gameplayStats.capacityUnits`
  (authored capacity, energy units). Its charge is instance state `chargeState.percent` (0–100, missing = 100),
  resolved by the bounded metric capability `charge` (`ItemChargeResolver`, «Заряд»), shown with
  `InventoryResourceMeterRenderer`/`DegradationColorResolver`. Batteries stack only while full (two half batteries
  are two items); the existing assembly/refill signature rules decide.
- **Battery slot:** an assembly slot `battery` (`acceptedTypes: ["battery"]`, capacity 1) added to the `bait_boat`
  profile and to the new `radio` profile. The item editor shows it as a socket tab like any other socket; inserting
  and removing use the existing assembly commands.
- **Consumption profile** per device (authored, configuration): `power.unitsPerSecond` by device state. Boat: moving
  and returning at its rate × level factor, in the water and not moving at one third of it (today ×0.5), drifting
  and not launched 0 (see "Calculation"); radio: while powered on (spec 142, Q12).
- **Domain:** `DevicePowerPolicy` (pure): `drain(chargePercent, capacityUnits, unitsPerSecond, seconds) → percent`,
  never below 0, never above the current value. `DevicePowerState` reading `{ hasBattery, percent, empty }` reused.
- **Application:** `DevicePowerService` is the one writer of battery charge. Devices report how long they consumed at
  which rate; the service applies it to the battery in their slot through the inventory transaction path and returns
  the reading. `BaitBoat` no longer owns energy: it reads `empty` (drift) from the reading. `ChumService.#boatEnergy`,
  `getBoatEnergy` and `setBoatChargeProvider` are replaced by the battery reading.
- No battery inserted = the device does not start (boat: «Немає батарейки» hint at launch; radio: power refused).

### Tamper resistance (owner Q7: "the player must not be able to break the discharge")

The client cannot be made unbreakable while saves are in the browser; the real guarantee is the backend (spec 029,
authoritative time and inventory). Until then the client closes every ordinary way around the discharge, and the
model is ready for the server:

1. **No wall clock.** Consumption is measured with a monotonic clock (`performance.now()` deltas through an injected
   platform port), never `Date.now()`. Changing the system time of the laptop or the phone changes nothing. A single
   gap is clamped (`CONFIG.power.maxStepSeconds`), so sleep/wake cannot add or remove hours at once.
2. **Charge only goes down.** No code path raises a battery's percent; a new (full) battery is the only way to power
   up (later: charging, an explicit transaction). Loading clamps to 0–100; capacity comes from the catalog, never
   from the save.
3. **Reload does not refund.** The charge is written every `CONFIG.power.saveIntervalSeconds` (5 s) of consumption
   and on `visibilitychange` hidden / `pagehide`, so a reload returns at most those seconds.
4. **Another tab does not refund.** When the inventory is written, a battery's stored percent that is lower than the
   in-memory one wins (monotonic merge by battery instance id).
5. **Server-ready ledger.** Each consumption step is a record `{ batteryInstanceId, deviceId, seconds, units }`
   aggregated per session; the future backend validates the ledger against its own clock and becomes the owner of
   the charge ("рахувався від сервера").

### Gameplay change

This is a gameplay change for the boat (entry in `docs/gameplay_backlog.md`): its energy now comes from a battery
and persists. The game-cycle report must stay identical or be re-baselined with this reason (owner decision); the
current game-cycle stubs `updateBoats`, so it is expected to stay identical.

## Checks

- `device-power` check (fixed monotonic clock): drain per second for boat states and the radio, empty → drift / off,
  no battery → refused, wall-clock jumps forward/backward change nothing, a large gap is clamped, charge never rises,
  save every 5 s and on hide, reload returns at most 5 s, two-tab monotonic merge, ledger totals.
- Inventory: battery grant (DEV shop), insert/remove in both profiles, save round trip with and without `chargeState`.
- Existing boat/chum checks keep their behaviour with a full battery inserted.

## Owner decisions (2026-10-25, Q8–Q11)

- **D-P1 (Q8) Boat by running time:** the main parameter is the boat's time in motion, not the number of trips. While
  the boat moves (out and back) the battery drains; a full battery gives a level-1 boat **300 s (5 min)** of motion. A
  boat in the water that does not move (waiting at the spot) consumes **three times less**.
- **D-P2 (Q9) Levels:** the boat's level lowers consumption.
- **D-P3 (Q10) Battery kinds:** one ordinary battery to start with; it lasts **1 hour** (nominal capacity).
- **D-P4 (Q11) Start:** the boat has no battery at the start; the player inserts one.

### Calculation

Capacity of the ordinary battery: 1 hour at the nominal 1 unit/s = **3600 units** (`capacityUnits`).

| Boat level | Level factor | Moving, units/s | Moving time per battery | In the water, not moving, units/s | Time per battery |
| --- | --- | --- | --- | --- | --- |
| 1 | × 1 | 3600 / 300 = **12** | 300 s = 5 min | 12 / 3 = **4** | 900 s = 15 min |
| 2 | × 2/3 | **8** | 450 s = 7.5 min | 2.67 | 1350 s = 22.5 min |
| 3 | × 1/2 | **6** | 600 s = 10 min | **2** | 1800 s = 30 min |

Configuration: `power.unitsPerSecond.moving = 12` on the boat item, `power.idleShare = 1/3`, and
`statsByLevel[n].powerFactor` (1, 2/3, 1/2) replacing `maxEnergy`/`energyDrainPerSec`. Drifting with an empty battery
and a boat that is only equipped (not launched) consume 0. Mixed use adds up: e.g. level 1, 200 s moving + 300 s
waiting = 2400 + 1200 = 3600 units, one battery.

## Owner decisions (2026-10-25, Q12–Q14)

- **D-P5 (Q12) Radio:** to start with the radio plays **1 hour** per battery: it consumes the nominal 1 unit/s.
- **D-P6 (Q13) Equipped only:** a boat that is only equipped and not launched consumes nothing.
- **D-P7 (Q14) Production:** one ordinary battery (not inserted) is in the starting inventory. Existing saves get one
  battery once, by a save migration step (the boat would otherwise be unusable on `index.html`).
