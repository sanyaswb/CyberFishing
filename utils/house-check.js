"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");

async function main() {
  const { HOUSE_CONFIG } = await import("../src/game/config/raw/house/house_config.js");
  const { RoomUpgradeService } = await import("../src/game/application/house/room_upgrade_service.js");
  const { RoomProgressLocalStore } = await import("../src/platform/browser/storage/room_progress_local_store.js");
  const { composeGameTime } = await import("../src/bootstrap/production/game_time_composition.js");
  const { backgroundTimeBlend } = await import("../src/game/domain/time/background_time_blend.js");
  const { EnvironmentSystem } = await import("../src/game/application/world/environment_system.js");
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let now = 1000000;
  const nowFn = () => now;
  const clock = composeGameTime({ storage, now: nowFn, initialHours: 12, timeScale: 240 });
  assert.equal(clock.getHours(), 12);
  now += 60000;
  assert.equal(clock.getHours(), 16);
  assert.equal(composeGameTime({ storage, now: nowFn, initialHours: 3, timeScale: 1 }).getHours(), 16,
    "the house and location read the same persisted clock");
  now += 90000;
  assert.equal(clock.getHours(), 22);
  const blend = { evening: -1, night: -1 };
  assert.deepEqual(backgroundTimeBlend(12, blend), { evening: 0, night: 0 });
  assert.deepEqual(backgroundTimeBlend(18, blend), { evening: .5, night: 0 });
  assert.deepEqual(backgroundTimeBlend(20, blend), { evening: 1, night: .5 });
  assert.deepEqual(backgroundTimeBlend(22, blend), { evening: 1, night: 1 });
  assert.deepEqual(backgroundTimeBlend(6, blend), { evening: 1, night: .5 });
  assert.deepEqual(backgroundTimeBlend(8, blend), { evening: .5, night: 0 });
  const houseClock = composeGameTime({ storage, now: nowFn, initialHours: 12, timeScale: 240 });
  const env = new EnvironmentSystem({ weather: { chances: { rain: 0, fog: 0 }, updateIntervalMs: 1000 },
    environment: {} }, 12, { chance: () => false }, { timePhases: { day: { startHour: 9, endHour: 21 },
      night: { startHour: 21, endHour: 9 } } }, clock);
  env.update(16, 1);
  assert.equal(env.getSnapshot().time, 22, "world environment reads the shared clock");
  now += 3600000;
  houseClock.sync();
  assert.equal(houseClock.getHours(), 23, "a live time-scale edit propagates to the house clock");

  for (let level = 1; level <= HOUSE_CONFIG.room.maxLevel; level++) {
    const art = HOUSE_CONFIG.room.backgrounds[level];
    for (const phase of ["day", "evening", "night"]) assert(fs.existsSync(art[phase]), art[phase]);
  }
  assert(fs.existsSync(HOUSE_CONFIG.room.aquariumImage));
  assert(fs.existsSync(HOUSE_CONFIG.room.renovationImage));
  const store = new RoomProgressLocalStore(storage);
  let room = new RoomUpgradeService({ config: HOUSE_CONFIG.room, store, now: nowFn });
  assert.equal(room.getView().level, 1);
  const durations = [2, 8, 16, 48];
  for (let level = 2; level <= 5; level++) {
    assert.equal(room.start().ok, true);
    assert.equal(room.getView().targetLevel, level);
    assert.equal(room.start().reason, "already_upgrading");
    room = new RoomUpgradeService({ config: HOUSE_CONFIG.room, store, now: nowFn });
    assert.equal(room.getView().targetLevel, level, "renovation survives reload");
    assert.equal(room.getView().remainingMs, durations[level - 2] * 3600000);
    if (level % 2 === 0) {
      assert.equal(room.finish().ok, true, "free completion works");
    } else {
      now += durations[level - 2] * 3600000;
      assert.equal(room.getView().level, level, "elapsed renovation completes automatically");
    }
    assert.equal(room.getView().level, level);
    assert.equal(room.getView().targetLevel, null);
  }
  assert.equal(room.start().reason, "max_level");
  values.set("cyber_fishing_room_1_v1", "{bad");
  assert.equal(new RoomUpgradeService({ config: HOUSE_CONFIG.room, store, now: nowFn }).getView().level, 1);
  console.log("House passed: shared game time, location blend, all room art, persisted upgrades, countdown and free completion.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
