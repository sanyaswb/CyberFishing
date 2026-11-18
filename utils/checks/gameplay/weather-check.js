"use strict";
// Spec 172 / spec 180 (TK-325): the weather's independent events (rain, storm with lightning, fog: check + chance, a
// timeline rolled at the start, manual hold per process), and the fields the bite
// chances, the radio and the wind read from EnvironmentSystem; spec 179: the emission, radiation and its storm hold.
// Fixed seeds, explicit time steps.
const assert = require("node:assert/strict");
const {
  WeatherModel,
} = require("../../../src/game/domain/weather/weather_model.js");
const {
  WindModel,
} = require("../../../src/game/domain/weather/wind_model.js");
const {
  WaterEntity,
} = require("../../../src/game/domain/tackle/water_entity.js");
const {
  EnvironmentSystem,
} = require("../../../src/game/application/world/environment_system.js");
const { SeededRng } = require("../../../src/engine/random/seeded_rng.js");
const {
  MAP_DB,
} = require("../../../src/game/config/databases/location_catalog.js");

const { WeatherEventTimeline } = require("../../../src/game/domain/weather/weather_event_timeline.js");

// Spec 180 (TK-325): a test location's events — rain, storm (with lightning) and fog — as check + chance and a timeline.
const event = (extra = {}) => ({
  enabled: true, checkIntervalSec: 60, chancePerCheck: 0.05, chanceGrowthPerCheck: 0, cooldownSec: 120,
  durationSec: [600, 600], peakAtShare: [0.3, 0.3], peakShare: [0.2, 0.2], peakStrength: [0.6, 0.6], smoothSec: 0, ...extra,
});
const settings = () => ({
  initial: { rain: 0, storm: 0, fog: 0 },
  rain: event(),
  storm: event({ chancePerCheck: 0.02,
    lightning: { chance: 1, startShare: [0.1, 0.1], endShare: [0.9, 0.9], intervalSec: [25, 6], jitter: 0.5, distance: [0.2, 1] } }),
  fog: event({ chancePerCheck: 0.1, checkIntervalSec: 600, cooldownSec: 0, durationSec: [3600, 3600],
    hours: [{ fromHour: 4, toHour: 7, chanceMult: 10 }, { fromHour: 22, toHour: 2, chanceMult: 5 }], rainBoost: { perRain: 0.5, max: 2 } }),
  thresholds: { rain: 0.15, fog: 0.3 },
});
// Spec 180 D3: the storm's multipliers are general (CONFIG.weather.storm).
const general = () => ({ storm: { rainChanceMult: 6, rainStrengthMult: 1.5 } });
const { CONFIG: GAME_CONFIG } = require("../../../src/game/config/runtime/game_config.js");
const near = (actual, expected, message, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${message}: ${actual} ≠ ${expected}`);
// clock: { hour, timeScale } (TK-336: fog runs in game time and by hour) or null (real time, no hour).
const step = (model, seconds, clock = null, dt = 0.1) => {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) model.update(dt * 1000, clock);
};

// 1. The location's real settings: every strength in 0…1, all three events happen, storms raise the rain, a storm
//    without rain is possible (owner, spec 180 item 2).
{
  const model = new WeatherModel({ rng: new SeededRng("check:weather"), getSettings: () => MAP_DB.test.weather,
    getGeneralSettings: () => GAME_CONFIG.weather });
  // TK-336: the game's clock at its pace (fog in game time).
  const clock = { hour: 0, timeScale: GAME_CONFIG.debug.timeScale };
  let rainTime = 0, stormTime = 0, rainInStorm = 0, stormsWithoutRain = 0, storms = 0, rained = false, stormSerial = 0;
  for (let second = 0; second < 400 * 3600; second += 1) {
    clock.hour = (second * clock.timeScale / 3600) % 24;
    model.update(1000, clock);
    const w = model.snapshot;
    for (const key of ["rain", "storm", "fog", "cloud"]) assert.ok(w[key] >= 0 && w[key] <= 1, `${key} in 0…1`);
    if (w.rain > 0.15) rainTime += 1;
    if (w.storm > 0.05) { stormTime += 1; if (w.rain > 0.15) { rainInStorm += 1; rained = true; } }
    if (w.events.storm.serial !== stormSerial) {
      if (stormSerial > 0) { storms += 1; if (!rained) stormsWithoutRain += 1; }
      stormSerial = w.events.storm.serial;
      rained = false;
    }
  }
  assert.ok(storms >= 20 && model.snapshot.events.rain.serial >= 100 && model.snapshot.events.fog.serial >= 20,
    `a long run has rain, storms and fog (${model.snapshot.events.rain.serial} / ${storms} / ${model.snapshot.events.fog.serial})`);
  assert.ok(rainInStorm / stormTime > (rainTime / (400 * 3600)) * 1.3, "it rains more during storms");
  assert.ok(stormsWithoutRain > 0, `some storms bring no rain (${stormsWithoutRain} of ${storms})`);
}

// 2. Determinism: the same seed gives the same weather.
{
  const run = () => {
    const model = new WeatherModel({ rng: new SeededRng(42), getSettings: settings });
    const trace = [];
    for (let index = 0; index < 6000; index += 1) {
      model.update(500, { hour: index % 1000 < 500 ? 1 : 12, timeScale: 240 });
      if (index % 50 === 0) trace.push(`${model.snapshot.rain.toFixed(6)}:${model.snapshot.storm.toFixed(6)}:${model.snapshot.fog.toFixed(6)}`);
    }
    return trace.join("|");
  };
  assert.equal(run(), run(), "the weather is deterministic for a seed");
}

// 3. The timeline (D13): rolled whole at the start; 0 → peak (smooth) → flat peak → 0; shares of the duration.
{
  const timeline = new WeatherEventTimeline();
  const rng = new SeededRng(5);
  timeline.roll({ durationSec: [1200, 1200], peakAtShare: [0.35, 0.35], peakShare: [0.15, 0.15], peakStrength: [0.2, 0.2] }, rng);
  assert.deepEqual([timeline.durationSec, timeline.peakStartSec, timeline.peakEndSec], [1200, 420, 600],
    "20 min, the peak from the 7th minute for 3 minutes (owner's example)");
  near(timeline.peakStrength, 0.2, "the peak's strength");
  assert.deepEqual([timeline.strengthAt(0), timeline.strengthAt(1200)], [0, 0], "0 at both ends");
  near(timeline.strengthAt(210), 0.1, "half way up: half the peak (smoothstep is symmetric)");
  near(timeline.strengthAt(500), 0.2, "flat on the peak");
  assert.ok(timeline.strengthAt(900) < 0.2 && timeline.strengthAt(900) > 0, "falling after the peak");
  assert.deepEqual([timeline.phaseAt(100), timeline.phaseAt(500), timeline.phaseAt(900), timeline.phaseAt(1300)],
    ["rise", "peak", "fall", "idle"], "phases");
  const slopes = [];
  for (let t = 1; t < 420; t += 1) slopes.push(timeline.strengthAt(t) - timeline.strengthAt(t - 1));
  assert.ok(slopes[0] < slopes[200] && slopes[418] < slopes[200], "the rise starts and ends softly (no kink at the peak)");
  const varied = new Set();
  for (let index = 0; index < 50; index += 1) {
    timeline.roll(MAP_DB.test.weather.storm, rng);
    const { durationSec, peakAtShare, peakShare, peakStrength } = MAP_DB.test.weather.storm;
    assert.ok(timeline.durationSec >= durationSec[0] && timeline.durationSec <= durationSec[1], "duration in range");
    assert.ok(timeline.peakStartSec >= timeline.durationSec * peakAtShare[0] - 1e-6 &&
      timeline.peakStartSec <= timeline.durationSec * peakAtShare[1] + 1e-6, "peak start in range");
    assert.ok(timeline.peakEndSec - timeline.peakStartSec <= timeline.durationSec * peakShare[1] + 1e-6, "peak length in range");
    assert.ok(timeline.peakStrength >= peakStrength[0] && timeline.peakStrength <= peakStrength[1], "peak strength in range");
    varied.add(Math.round(timeline.peakStartSec));
  }
  assert.ok(varied.size > 40, "the randomness moves the peak along the timeline");
}

// 4. An event's check + chance (D2): one roll per checkIntervalSec, growth per failed roll, a cooldown after the event.
{
  const rolls = { count: 0 };
  const rng = { next: () => { rolls.count += 1; return 0.999; }, range: (min) => min, chance: () => false };
  const config = settings();
  config.rain = event({ chancePerCheck: 0.01, chanceGrowthPerCheck: 0.02, checkIntervalSec: 60 });
  config.storm.enabled = false;
  config.fog.enabled = false;
  const model = new WeatherModel({ rng, getSettings: () => config });
  for (let second = 0; second < 600; second += 1) model.update(1000, null);
  assert.equal(rolls.count, 10, `ten minutes = ten rolls, not one per second (${rolls.count})`);
  near(model.snapshot.events.rain.chance, 0.01 + 0.02 * 10, "the chance grows with each failed roll");
  assert.equal(model.snapshot.events.rain.active, false, "no event while the rolls fail");
  model.start("rain");
  assert.equal(model.snapshot.events.rain.active, true, "an event started");
  const before = rolls.count;
  for (let second = 0; second < 599; second += 1) model.update(1000, null);
  assert.equal(rolls.count, before, "no rolls during an event");
  for (let second = 0; second < 2; second += 1) model.update(1000, null);
  assert.equal(model.snapshot.events.rain.active, false, "the event ends with its timeline");
  assert.ok(model.snapshot.events.rain.cooldownLeftSec > 100, "then the cooldown runs");
}

// 5. The defect of spec 180 (storm switch kept the rain): every process is held alone; in any order of switching the
//    others keep their own course. With the rain's own events off, the rain stays 0 whatever the storm does.
{
  const config = settings();
  config.rain.enabled = false;
  config.storm.enabled = false;
  config.fog.enabled = false;
  const model = new WeatherModel({ rng: new SeededRng(3), getSettings: () => config });
  const run = (seconds) => step(model, seconds);
  model.hold("rain", 0.7, { fadeSec: 5 }); run(10);
  near(model.snapshot.rain, 0.7, "rain switch on");
  model.hold("rain", null, { fadeSec: 5 }); run(10);
  assert.deepEqual([model.snapshot.rain, model.snapshot.events.rain.held], [0, false], "rain switch off: no rain");
  model.hold("storm", 0.8, { fadeSec: 5 }); run(10);
  assert.deepEqual([model.snapshot.storm, model.snapshot.rain], [0.8, 0], "storm switch on: a storm, and no rain made by it");
  model.hold("storm", null, { fadeSec: 5 }); run(10);
  assert.deepEqual([model.snapshot.storm, model.snapshot.rain, model.snapshot.frozen], [0, 0, false],
    "storm switch off: no storm, no rain, nothing held (the old switch left the rain on)");
  const orders = [["rain", "storm", "fog"], ["storm", "fog", "rain"], ["fog", "rain", "storm"]];
  for (const order of orders) {
    for (const kind of order) model.hold(kind, 0.5, { fadeSec: 0 });
    for (const kind of order) {
      model.hold(kind, null, { fadeSec: 0 });
      model.update(16, null);
      for (const other of order.filter((name) => name !== kind)) {
        const held = model.snapshot.events[other].held;
        const releasedBefore = order.indexOf(other) < order.indexOf(kind);
        assert.equal(held, !releasedBefore, `releasing ${kind} leaves ${other} as it was`);
      }
    }
  }
  model.hold("rain", 0.5);
  model.hold("storm", 0.5);
  model.releaseAll();
  assert.equal(model.snapshot.frozen, false, "↺: every process back to its own course");
  assert.equal(model.hold("snow", 1), false, "unknown kinds are refused");
  // TK-358: the DevTools fade («перехід, с») lasts while held and until the release has arrived; the rain's own events
  // afterwards ease in at the location's smoothSec again (it stayed at the hold's fade before).
  config.rain.enabled = true;
  config.rain.smoothSec = 4;
  model.hold("rain", 0.6, { fadeSec: 0 });
  model.update(16, null);
  model.hold("rain", null, { fadeSec: 0 });
  model.update(16, null);
  assert.equal(model.snapshot.rain, 0, "released at once (fade 0)");
  model.start("rain", { peakStrength: 1, atPeak: true });
  model.update(1000, null);
  assert.equal(model.snapshot.rain, 1, "start at the peak shows the peak");
  model.stop("rain");
  model.update(1000, null);
  near(model.snapshot.rain, 1 - 1 / config.rain.smoothSec, "an ordinary end fades at the settings' smoothSec, not the hold's 0");
  config.rain.enabled = false;
}

// 6. A storm raises the rain's chance and strength by its multipliers × its strength.
{
  const config = settings();
  config.storm.enabled = false;
  config.rain.chanceGrowthPerCheck = 0;
  const model = new WeatherModel({ rng: new SeededRng(4), getSettings: () => config, getGeneralSettings: general });
  model.update(1, null);
  near(model.snapshot.events.rain.chance, 0.05, "the rain's own chance");
  model.hold("storm", 1, { fadeSec: 0 });
  model.update(1, null);
  near(model.snapshot.events.rain.chance, 0.05 * 6, "a full storm: × rainChanceMult");
  model.hold("storm", 0.5, { fadeSec: 0 });
  model.update(1, null);
  near(model.snapshot.events.rain.chance, 0.05 * 3.5, "half a storm: half the extra");
  model.start("rain", { peakStrength: 0.4, atPeak: true });
  model.hold("storm", 1, { fadeSec: 0 });
  step(model, 1);
  near(model.snapshot.rain, 0.4 * 1.5, "the rain grows by rainStrengthMult in a full storm");
  model.hold("storm", 0, { fadeSec: 0 });
  step(model, 1);
  near(model.snapshot.rain, 0.4, "and back without the storm");
}

// 7. Lightning belongs to the storm: none without it; rolled at the storm's start; only between its start and end on
//    the storm's timeline; more often as the storm grows; a storm may have none.
{
  const config = settings();
  config.rain.enabled = false;
  config.storm.enabled = false;
  config.fog.enabled = false;
  const model = new WeatherModel({ rng: new SeededRng(17), getSettings: () => config });
  step(model, 600, null, 1);
  assert.equal(model.snapshot.strikeSerial, 0, "no storm, no lightning");
  model.start("storm");
  const strikesAt = [];
  let last = 0;
  for (let second = 0; second < 600; second += 1) {
    model.update(1000, null);
    if (model.snapshot.strikeSerial !== last) { last = model.snapshot.strikeSerial; strikesAt.push(second); }
  }
  assert.ok(strikesAt.length > 5, `a storm with lightning strikes (${strikesAt.length})`);
  assert.ok(strikesAt[0] >= 59 && strikesAt.at(-1) <= 541, "only between 10 % and 90 % of the storm (60…540 s)");
  const gaps = strikesAt.slice(1).map((at, index) => at - strikesAt[index]);
  const peakGaps = gaps.filter((_, index) => strikesAt[index] >= 180 && strikesAt[index] <= 300);
  const edgeGaps = gaps.filter((_, index) => strikesAt[index] < 120);
  const mean = (list) => list.reduce((sum, value) => sum + value, 0) / Math.max(1, list.length);
  assert.ok(peakGaps.length > 0 && edgeGaps.length > 0 && mean(peakGaps) < mean(edgeGaps), "more often at the peak");
  for (const variant of [model.snapshot.strikeVariant]) assert.ok(variant >= 0 && variant <= 3, "variants 0…3");
  config.storm.lightning.chance = 0;
  model.start("storm");
  const before = model.snapshot.strikeSerial;
  step(model, 600, null, 1);
  assert.equal(model.snapshot.strikeSerial, before, "a storm without lightning (its chance said no)");
}

// 8. TK-336 (owner): fog lives in game time; its chance is × its hour window and × the rains since the last fog. The
//    initial weather (D14) starts a session's events at their peak.
{
  const config = settings();
  config.rain.enabled = false;
  config.storm.enabled = false;
  const morning = { hour: 5, timeScale: 240 };
  const model = new WeatherModel({ rng: new SeededRng(8), getSettings: () => config });
  step(model, 2, morning, 0.5);
  assert.equal(model.snapshot.events.fog.active, false, "before the first check (600 game s = 2.5 real s at ×240)");
  assert.equal(model.snapshot.fogHourMult, 10, "the morning window multiplies the chance");
  near(model.snapshot.events.fog.chance, 1, "0.1 × 10 = 1 in the window", 1e-9);
  step(model, 1, morning, 0.5);
  assert.equal(model.snapshot.events.fog.active, true, "the check comes in game time and the window makes it sure");
  step(model, 14, morning, 0.5);
  assert.equal(model.snapshot.events.fog.active, true, "still on at 17 s (it began at 2.5 s)");
  step(model, 1, morning, 0.5);
  assert.equal(model.snapshot.events.fog.active, false, "a 1-game-hour fog ends after 15 real seconds at ×240");
  const realTime = new WeatherModel({ rng: new SeededRng(8), getSettings: () => config });
  step(realTime, 3, { hour: 5, timeScale: 1 }, 0.5);
  assert.equal(realTime.snapshot.events.fog.active, false, "at ×1 the first check waits 600 real seconds");
  // Outside the windows ×1; a window may pass midnight.
  const noon = new WeatherModel({ rng: new SeededRng(8), getSettings: () => config });
  step(noon, 1, { hour: 12, timeScale: 240 }, 0.5);
  assert.equal(noon.snapshot.fogHourMult, 1, "no window at noon");
  near(noon.snapshot.events.fog.chance, 0.1, "the base chance outside the windows", 1e-9);
  step(noon, 1, { hour: 1, timeScale: 240 }, 0.5);
  assert.equal(noon.snapshot.fogHourMult, 5, "22–2 holds one o'clock");
  // Every rain that ends adds perRain (up to max); a fog that starts resets it.
  config.rain.enabled = true;
  config.fog.enabled = false;
  const atNoon = { hour: 12, timeScale: 240 };
  const rains = new WeatherModel({ rng: new SeededRng(9), getSettings: () => config });
  const rainOnce = () => { rains.start("rain"); rains.update(100, atNoon); rains.stop("rain"); rains.update(100, atNoon); };
  rains.update(100, atNoon);
  assert.equal(rains.snapshot.fogRainBoost, 1, "no rain yet: ×1");
  rainOnce();
  assert.equal(rains.snapshot.fogRainBoost, 1.5, "one rain: ×1.5");
  rainOnce();
  rainOnce();
  assert.equal(rains.snapshot.fogRainBoost, 2, "the boost stops at its max");
  config.fog.enabled = true;
  rains.update(100, atNoon);
  near(rains.snapshot.events.fog.chance, 0.2, "the rains double the fog's chance at noon", 1e-9);
  rains.start("fog");
  rains.update(100, atNoon);
  assert.equal(rains.snapshot.fogRainBoost, 1, "a fog that starts resets the rain's boost");
  const initial = settings();
  initial.initial = { rain: 0.6, storm: 0, fog: 0 };
  const started = new WeatherModel({ rng: new SeededRng(8), getSettings: () => initial });
  started.update(16, null);
  near(started.snapshot.rain, 0.6, "a rainy start: the rain at its peak with the initial strength", 1e-6);
  assert.equal(started.snapshot.storm, 0, "nothing else");
}

// TK-367: the water current held by hand — every reader (the physics, the boats through resolveCurrent) gets the held
// speed with the location's direction; the location's config is never written; null returns the location's own object.
{
  const current = { speedPxPerSec: 12, direction: { x: 1, y: 0.2 } };
  const location = { weather: settings(), environment: { current } };
  const environment = new EnvironmentSystem(location, 12, new SeededRng(4), {}, null, null);
  assert.equal(environment.getPhysicsEnv().current, current, "nothing held: the location's own current");
  environment.setCurrentSpeedOverride(0);
  const held = environment.getPhysicsEnv().current;
  assert.equal(JSON.stringify([held.speedPxPerSec, held.direction]), JSON.stringify([0, current.direction]),
    "held at 0: still water in the location's direction");
  assert.equal(current.speedPxPerSec, 12, "the location's config keeps its speed (nothing goes to the weather export)");
  environment.setCurrentSpeedOverride(25);
  assert.equal(environment.resolveCurrent(current), held, "the boats get the same reused record");
  assert.equal(held.speedPxPerSec, 25, "with the new held speed");
  assert.equal(environment.currentSpeedOverride, 25);
  environment.setCurrentSpeedOverride(null);
  assert.equal(environment.resolveCurrent(current), current, "released: the location's current again");
  assert.equal(environment.resolveCurrent(null), null, "a location without a current stays without one");
}

// 9. EnvironmentSystem: thresholds, the continuous rain multiplier, the reused snapshot; without a model the weather
//    stays clear; the wind held by hand.
{
  const config = settings();
  config.rain.enabled = false;
  config.storm.enabled = false;
  config.fog.enabled = false;
  const location = { weather: config, environment: { wind: { rainMultiplier: 2.5 } } };
  const rng = new SeededRng(9);
  const weather = new WeatherModel({ rng, getSettings: () => location.weather });
  const environment = new EnvironmentSystem(location, 12, rng, { timePhases: { day: { startHour: 0, endHour: 24 } } }, null, weather);
  const snapshot = environment.getSnapshot();
  weather.hold("rain", 0.1, { fadeSec: 0 });
  environment.update(16, 1);
  assert.equal(snapshot.isRaining, false, "light drizzle below the threshold does not count as rain");
  near(snapshot.wind.rainMult, 1.15, "rainMult follows the strength");
  weather.hold("rain", 1, { fadeSec: 0 });
  environment.update(16, 1);
  assert.equal(snapshot.isRaining, true, "rain above the threshold");
  near(snapshot.wind.rainMult, 2.5, "full rain gives the configured multiplier");
  weather.hold("fog", 0.4, { fadeSec: 0 });
  environment.update(16, 1);
  assert.equal(snapshot.isFoggy, true, "fog above the threshold");
  assert.equal(environment.getSnapshot(), snapshot, "one snapshot object");
  assert.equal(snapshot.weather, weather.snapshot, "the weather's own snapshot is shared, not copied");
  weather.releaseAll();
  environment.update(16, 1);
  assert.deepEqual([snapshot.isRaining, snapshot.wind.rainMult], [false, 1], "no rain, no multiplier");

  const plain = new EnvironmentSystem({ environment: {} }, 12, new SeededRng(1), { timePhases: {} });
  for (let index = 0; index < 100; index += 1) plain.update(1000, 240);
  assert.deepEqual([plain.getSnapshot().isRaining, plain.getSnapshot().isFoggy, plain.getSnapshot().weather.precipitation],
    [false, false, "clear"], "without a weather model the weather stays clear");

  const windLocation = { weather: config, environment: { wind: { rainMultiplier: 2.5, changesPerDay: [4, 12],
    breezeAngleRange: [10, 15], gustAngleRange: [15, 40], gustChancePerSec: 0.4 } } };
  const windy = new EnvironmentSystem(windLocation, 12, new SeededRng(21), { timePhases: { day: { startHour: 0, endHour: 24 } } });
  windy.update(16, 1);
  windy.setWindOverride(-1);
  assert.deepEqual([windy.getSnapshot().wind.direction, windy.getSnapshot().wind.forced], [-1, true], "the wind held to the left");
  assert.equal(windy.getPhysicsEnv().wind.direction, -1, "the physics feel the held wind");
  for (let index = 0; index < 50; index += 1) windy.update(3600000, 1);
  assert.equal(windy.getSnapshot().wind.direction, -1, "the random wind does not replace a held one");
  windy.setWindOverride(0);
  assert.equal(windy.getPhysicsEnv().wind, null, "calm: no wind in the physics");
  windy.setWindOverride(null);
  assert.equal(windy.getSnapshot().wind.forced, false, "null returns to the random wind");
}

// 10. Spec 172 D7 (TK-289): the sea state from wind, night and storm, smooth, with the waves travelling with the wind.
{
  const {
    SeaStateResolver,
  } = require("../../../src/game/presentation/world/sea_state_resolver.js");
  const {
    CONFIG: GAME,
  } = require("../../../src/game/config/runtime/game_config.js");
  const settings = { ...GAME.canvas.water.seaState, smoothingSec: 2 };
  const environment = {
    time: 13,
    weather: { storm: 0 },
    wind: { direction: 0 },
  };
  const sea = new SeaStateResolver({
    getEnvironment: () => environment,
    getSettings: () => settings,
  });
  let now = 0;
  const settle = (seconds = 60) => {
    for (let t = 0; t < seconds * 10; t += 1) {
      now += 100;
      sea.update(now);
    }
    return sea.state;
  };
  sea.update(now);
  near(
    sea.state.amplitudeScale,
    settings.normal.calmAmplitude,
    "the first frame starts at its target: a calm day",
  );
  environment.wind.direction = 1;
  now += 100;
  sea.update(now);
  assert(
    sea.state.amplitudeScale < settings.normal.calmAmplitude + 0.1,
    "a new wind swells the waves instead of jumping",
  );
  near(
    settle().amplitudeScale,
    settings.normal.windAmplitude,
    "wind: windAmplitude",
  );
  near(sea.state.speedScale, settings.normal.windSpeed, "wind: windSpeed");
  near(sea.state.travel, 1, "the waves travel with the wind (to the right)");
  environment.wind.direction = -1;
  let previous = sea.state.travel,
    biggest = 0;
  for (let t = 0; t < 600; t += 1) {
    now += 100;
    sea.update(now);
    biggest = Math.max(biggest, Math.abs(sea.state.travel - previous));
    previous = sea.state.travel;
  }
  near(sea.state.travel, -1, "a wind to the left turns them left");
  assert(
    biggest < 0.1,
    `the turn is gradual (largest step ${biggest.toFixed(3)} per 0.1 s)`,
  );
  environment.wind.direction = 0;
  near(settle().travel, -1, "a calm keeps the last direction");
  environment.time = 1;
  near(
    settle().amplitudeScale,
    settings.normal.calmAmplitude * settings.normal.nightAmplitude,
    "night: calmer waves",
  );
  environment.time = 20;
  const dusk = settle().amplitudeScale;
  assert(
    dusk > settings.normal.calmAmplitude * settings.normal.nightAmplitude &&
      dusk < settings.normal.calmAmplitude,
    "at dusk the waves calm down with the night background (half way at 20 h)",
  );
  environment.time = 13;
  environment.weather.storm = 1;
  near(
    settle().amplitudeScale,
    settings.normal.windAmplitude * settings.storm.amplitude,
    "storm: full wind and stormAmplitude",
  );
  near(
    sea.state.speedScale,
    settings.normal.windSpeed * settings.storm.speed,
    "storm: faster",
  );
  near(
    sea.state.wavelengthScale,
    settings.storm.wavelength,
    "storm: longer waves",
  );
  settings.enabled = false;
  sea.update((now += 100));
  assert.deepEqual(
    [sea.state.amplitudeScale, sea.state.speedScale, sea.state.wavelengthScale],
    [1, 1, 1],
    "switched off: the waves as configured",
  );
}

// 11. TK-291: the live reading for the overlay «ПОГОДА й хвилі»: the waves' actual values are the base ones times the
// sea state's current factors; the overlay shows them.
{
  const {
    SeaStateResolver,
  } = require("../../../src/game/presentation/world/sea_state_resolver.js");
  const {
    WeatherStatusReader,
  } = require("../../../src/game/presentation/world/weather_status_reader.js");
  const {
    WeatherOverlayModule,
  } = require("../../../src/dev/overlay/modules/weather_overlay_module.js");
  const {
    OverlayHtmlBuilder,
  } = require("../../../src/dev/overlay/services/overlay_html_builder.js");
  const {
    CONFIG: GAME,
  } = require("../../../src/game/config/runtime/game_config.js");
  const water = JSON.parse(JSON.stringify(GAME.canvas.water));
  water.seaState.smoothingSec = 0;
  const environment = {
    time: 13,
    phase: "day",
    weather: {
      precipitation: "storm",
      rain: 1,
      storm: 1,
      fog: 0,
      cloud: 1,
      strikeSerial: 4,
      frozen: true,
    },
    wind: { direction: 1, forced: true },
  };
  const sea = new SeaStateResolver({
    getEnvironment: () => environment,
    getSettings: () => water.seaState,
  });
  const reader = new WeatherStatusReader({
    getEnvironment: () => environment,
    seaState: sea,
    getWater: () => water,
  });
  sea.update(1000);
  const reading = reader.read();
  const normal = water.seaState.normal,
    storm = water.seaState.storm;
  near(
    reading.waves.amplitude,
    water.amplitude * normal.windAmplitude * storm.amplitude,
    "amplitude = base × wind × storm",
  );
  near(
    reading.waves.wavelength,
    water.wavelength * storm.wavelength,
    "length = base × storm",
  );
  near(
    reading.waves.speed,
    water.speed * normal.windSpeed * storm.speed,
    "speed = base × wind × storm",
  );
  assert.deepEqual(
    [
      reading.storm,
      reading.windDirection,
      reading.windStrength,
      reading.windForced,
      reading.strikes,
    ],
    [1, 1, 1, true, 4],
    "storm, wind direction and strength, held wind, strikes",
  );
  assert.equal(reader.read(), reading, "one reading object");
  const module = new WeatherOverlayModule({
    readWeather: () => reader.read(),
    htmlBuilder: new OverlayHtmlBuilder(),
  });
  const html = module.render();
  const visibleText = html.replace(/<[^>]+>/gu, "");
  for (const text of [
    "гроза (вручну)",
    "вправо →",
    reading.waves.amplitude.toFixed(1),
    reading.waves.speed.toFixed(1),
    "Вітер: висота (штиль ×0.55 … вітер ×1.15)",
    "Ніч: затихання (день ×1.00 … ніч ×0.50)",
    "Гроза: штормовий підйом (ясно ×1.00 … гроза ×2.00)",
    "Гроза: розтяг хвилі (ясно ×1.00 … гроза ×1.30)",
    "Вітер: прискорення (штиль ×1.00 … вітер ×1.25)",
    "Гроза: штормове прискорення (ясно ×1.00 … гроза ×1.60)",
    `×${reading.waves.amplitudeScale.toFixed(2)}`,
    `×${reading.waves.wavelengthScale.toFixed(2)}`,
    `×${reading.waves.speedScale.toFixed(2)}`,
  ]) {
    assert(visibleText.includes(text), `the overlay shows ${text}`);
  }
  for (const attr of [
    'id="weather-wave-amplitude"',
    'id="weather-wave-length"',
    'id="weather-wave-speed"',
    'data-overlay-control="devtools-link"',
    'data-overlay-activate="release"',
    // TK-360: the weather rows link to the switches (a strength slider shows only while its element is on).
    'data-devtools-path="WEATHER.controls.storm"',
    // TK-367: the wind's direction and strength show only while it is on — both rows link to its switch.
    'data-devtools-path="WEATHER.controls.wind"',
    'data-devtools-path="CONFIG.spawns.timePhases.night.startHour"',
    'data-devtools-path="CONFIG.canvas.water.amplitude"',
    'data-devtools-path="CONFIG.canvas.water.wavelength"',
    'data-devtools-path="CONFIG.canvas.water.speed"',
    'data-devtools-path="CONFIG.canvas.water.seaState.enabled"',
    'data-devtools-path="CONFIG.canvas.water.seaState.normal.calmAmplitude"',
    'data-devtools-path="CONFIG.canvas.water.seaState.normal.windAmplitude"',
    'data-devtools-path="CONFIG.canvas.water.seaState.normal.nightAmplitude"',
    'data-devtools-path="CONFIG.canvas.water.seaState.normal.windSpeed"',
    'data-devtools-path="CONFIG.canvas.water.seaState.storm.amplitude"',
    'data-devtools-path="CONFIG.canvas.water.seaState.storm.wavelength"',
    'data-devtools-path="CONFIG.canvas.water.seaState.storm.speed"',
    'data-devtools-path="WEATHER.controls.strike"',
  ]) {
    assert(html.includes(attr), `the overlay markup includes ${attr}`);
  }
  assert(
    !html.includes(`(${water.amplitude.toFixed(1)} × ${reading.waves.amplitudeScale.toFixed(2)})`),
    "inline cramped wave formula removed from general rows in favor of sub-items",
  );
  near(
    reading.waves.factors.amplitude.wind,
    normal.windAmplitude,
    "status reader exposes component wind amplitude factor",
  );
  near(
    reading.waves.factors.amplitude.storm,
    storm.amplitude,
    "status reader exposes component storm amplitude factor",
  );
  water.seaState.smoothingSec = 4;
  environment.weather.storm = 0;
  environment.wind.direction = 0;
  sea.update(1100);
  const settlingHtml = module.render();
  assert(
    settlingHtml.includes("→ ціль ×"),
    "overlay shows target multiplier while smoothing is transitioning",
  );
  // Every emitted CONFIG.* hyperlink path must resolve on real CONFIG to a scalar leaf (I-20: never fall back to a section title).
  for (const snippet of [html, settlingHtml]) {
    for (const [, linkPath] of snippet.matchAll(/data-devtools-path="(CONFIG\.[^"]+)"/gu)) {
      let cursor = GAME;
      for (const seg of linkPath.split(".").slice(1)) {
        assert(
          cursor !== null && typeof cursor === "object" && Object.prototype.hasOwnProperty.call(cursor, seg),
          `link path ${linkPath} must resolve segment "${seg}" in CONFIG`,
        );
        cursor = cursor[seg];
      }
      assert(
        cursor !== null && typeof cursor !== "object",
        `link path ${linkPath} must resolve to a leaf value, not a section`,
      );
    }
  }
  water.seaState.enabled = false;
  sea.update(1200);
  const noSeaHtml = module.render();
  assert(
    noSeaHtml.includes("«Стан моря» вимкн.") && !noSeaHtml.includes("Вітер: висота"),
    "when seaState is off, active sea multipliers are hidden",
  );
  water.waves = false;
  assert.equal(
    reader.read().waves.amplitude,
    0,
    "waves switched off: no amplitude",
  );
  assert(
    /вимкнено/u.test(module.render()),
    "and the overlay says the waves are off",
  );
}

// 12. Spec 178 stage A: WindModel — continuous 0…1 strength, calm/light/moderate/strong episodes, real seconds,
// strength === 0 <-> direction === 0 invariant, rain/storm boosts, smooth gusts, manual overrides, and isolated RNG.
{
  const wind = new WindModel({ getGeneralSettings: () => GAME_CONFIG.weather,
    rng: new SeededRng("check:wind"),
    getSettings: () => MAP_DB.test.weather.wind,
  });
  const states = new Set();
  const dirs = new Set();
  let sawGust = false;
  let sawZero = false;
  for (let i = 0; i < 6000; i += 1) {
    const snap = wind.update(1000, { rain: 0, storm: 0 });
    assert(snap.strength >= 0 && snap.strength <= 1, "wind strength stays in 0…1");
    if (snap.strength === 0) {
      assert.equal(snap.direction, 0, "zero wind strength implies zero direction");
      sawZero = true;
    } else {
      assert(
        snap.direction === -1 || snap.direction === 1,
        "positive wind strength picks -1 or 1 direction",
      );
    }
    states.add(snap.state);
    dirs.add(snap.direction);
    if (snap.isGusting) sawGust = true;
  }
  assert(sawZero && sawGust, "long run visits calm and gusts");
  assert.deepEqual([...dirs].sort((a, b) => a - b), [-1, 0, 1], "wind visits left, calm, and right");
  for (const expected of ["calm", "light", "moderate", "strong"]) {
    assert(states.has(expected), `wind visits state ${expected}`);
  }

  // Smooth fade without instant jumps and storm boost pushing minimum wind high.
  const calmFirst = new WindModel({ getGeneralSettings: () => GAME_CONFIG.weather,
    rng: new SeededRng("check:wind:storm"),
    getSettings: () => ({
      ...MAP_DB.test.weather.wind,
      fadeSec: 10,
      states: { calm: { weight: 1, durationSec: [60, 60], strength: [0, 0] } },
    }),
  });
  calmFirst.update(100, { rain: 0, storm: 0 });
  assert.equal(calmFirst.snapshot.strength, 0);
  assert.equal(calmFirst.snapshot.direction, 0);
  calmFirst.update(1000, { rain: 0.8, storm: 1 });
  assert(
    calmFirst.snapshot.strength >= GAME_CONFIG.weather.storm.windMinStrength,
    "full storm lifts wind above calm immediately via stormMinStrength",
  );
  assert(
    calmFirst.snapshot.direction === -1 || calmFirst.snapshot.direction === 1,
    "storm-driven wind picks a non-zero direction when rising from calm",
  );

  // Manual direction & strength overrides + isolated windRng vs weatherRng.
  const custom = new WindModel({ getGeneralSettings: () => GAME_CONFIG.weather,
    rng: new SeededRng("check:wind:override"),
    getSettings: () => MAP_DB.test.weather.wind,
  });
  custom.setStrengthOverride(0);
  custom.update(100, { rain: 0, storm: 0 });
  assert.equal(custom.snapshot.direction, 0, "forced 0 strength leaves direction calm");
  custom.setStrengthOverride(0.45);
  custom.update(100, { rain: 0, storm: 0 });
  assert(
    Math.abs(custom.snapshot.strength - 0.45) < 1e-6 &&
      (custom.snapshot.direction === -1 || custom.snapshot.direction === 1),
    "forced positive strength sets strength and picks a random direction",
  );
  assert.equal(custom.triggerGust({ delta: 0.25, durationSec: 2 }), true, "manual gust starts");
  custom.update(500, { rain: 0, storm: 0 });
  assert(custom.snapshot.isGusting && custom.snapshot.strength > 0.45, "gust adds smoothly over forced strength");
  custom.setDirectionOverride(0);
  assert.equal(custom.snapshot.strength, 0, "forced calm direction clears strength to 0");
  custom.setDirectionOverride(null);
  custom.setStrengthOverride(null);

  // Separate windRng never disturbs weatherRng in EnvironmentSystem.
  const makeWeatherOnly = () =>
    new WeatherModel({ rng: new SeededRng(77), getSettings: () => MAP_DB.test.weather });
  const weatherRef = makeWeatherOnly();
  const weatherWithWind = makeWeatherOnly();
  const windPart = new WindModel({ getGeneralSettings: () => GAME_CONFIG.weather, rng: new SeededRng(88), getSettings: () => MAP_DB.test.weather.wind });
  const env = new EnvironmentSystem(
    MAP_DB.test,
    12,
    new SeededRng(77),
    { timePhases: { day: { startHour: 0, endHour: 24 } } },
    null,
    weatherWithWind,
    windPart,
  );
  for (let i = 0; i < 40; i += 1) {
    weatherRef.update(1000, null);
    env.update(1000, 1);
  }
  assert.deepEqual(
    weatherWithWind.snapshot,
    weatherRef.snapshot,
    "updating WindModel leaves WeatherModel rng sequence completely untouched",
  );
  env.setWindStrengthOverride(0.6);
  env.setWindOverride(1);
  assert.equal(env.getSnapshot().wind.forced, true);
  assert.equal(env.getSnapshot().wind.direction, 1);
  assert(Math.abs(env.getSnapshot().wind.strength - 0.6) < 1e-6);
  assert(Math.abs(env.getPhysicsEnv().wind.strength - 0.6) < 1e-6);
  assert.deepEqual(env.getPhysicsEnv().wind.float, MAP_DB.test.weather.wind.float);

  // Spec 178 stage B: SeaStateResolver scales continuously with wind.strength, and WaterEntity rocks inside returnPctRange.
  const { SeaStateResolver } = require("../../../src/game/presentation/world/sea_state_resolver.js");
  const { CONFIG: GAME } = require("../../../src/game/config/runtime/game_config.js");
  const seaCfg = { ...GAME.canvas.water.seaState, smoothingSec: 0 };
  let liveEnv = { time: 13, weather: { storm: 0 }, wind: { direction: 1, strength: 0.25 } };
  const seaContinuous = new SeaStateResolver({ getEnvironment: () => liveEnv, getSettings: () => seaCfg });
  seaContinuous.update(100);
  const weakAmp = seaContinuous.state.amplitudeScale;
  liveEnv = { time: 13, weather: { storm: 0 }, wind: { direction: 1, strength: 0.9 } };
  seaContinuous.update(200);
  const strongAmp = seaContinuous.state.amplitudeScale;
  assert(
    weakAmp > seaCfg.normal.calmAmplitude && weakAmp < strongAmp && strongAmp < seaCfg.normal.windAmplitude,
    `waves scale smoothly between calm and full wind (${weakAmp.toFixed(3)} < ${strongAmp.toFixed(3)})`,
  );

  const rng = new SeededRng("check:float-wind-swing");
  const floatEntity = new WaterEntity(
    500,
    400,
    { type: "day", maxDepth: 6, quality: 0, windCompensation: [0, 0] },
    6,
    rng,
  );
  const floatEnv = {
    current: null,
    wind: {
      direction: 1,
      strength: 0.9,
      rainMult: 1,
      float: { maxAngleDeg: 40, returnPctRange: [0.3, 0.45], cycleDurationSec: [0.6, 0.8], amplitudeJitter: [1, 1] },
    },
  };
  const bounds = { x: 0, y: 0, width: 1000, height: 1000 };
  const angles = [];
  for (let i = 0; i < 40; i += 1) {
    floatEntity.update(bounds, 50, floatEnv, () => true);
    angles.push(floatEntity._targetWindAngle);
  }
  const minAngle = Math.min(...angles);
  const maxAngle = Math.max(...angles);
  assert(
    minAngle > 15 && maxAngle > minAngle + 6,
    `strong wind tilts float and keeps live return-swing motion (${minAngle.toFixed(1)}°..${maxAngle.toFixed(1)}°)`,
  );
  floatEnv.wind.strength = 0;
  floatEntity.update(bounds, 50, floatEnv, () => true);
  assert.equal(floatEntity._targetWindAngle, 0, "calm clears float wind target angle");

  // 13. Spec 178 stage C: WeatherDevSection location selector, Weather Chances two-way sync,
  // manual wind strength & gust controls, and WeatherOverlayModule WEATHER.* link parity (R20).
  const { WeatherDevSection } = require("../../../src/dev/tools/weather_dev_section.js");
  const { WeatherStatusReader } = require("../../../src/game/presentation/world/weather_status_reader.js");
  const { WeatherOverlayModule } = require("../../../src/dev/overlay/modules/weather_overlay_module.js");
  const { OverlayHtmlBuilder } = require("../../../src/dev/overlay/services/overlay_html_builder.js");
  const liveWind = new WindModel({ getGeneralSettings: () => GAME_CONFIG.weather, rng: new SeededRng("check:dev-wind"), getSettings: () => MAP_DB.test.weather.wind });
  liveWind.setStrengthOverride(0.72);
  liveWind.triggerGust({ delta: 0.2, durationSec: 2 });
  liveWind.update(300, { rain: 0, storm: 0 });
  const stageCEnv = {
    time: 14,
    phase: "day",
    weather: { precipitation: "clear", rain: 0, storm: 0, fog: 0, cloud: 0, strikeSerial: 0, frozen: false,
      events: { rain: { active: false }, storm: { active: false }, fog: { active: false } } },
    wind: { ...liveWind.snapshot, state: "strong", forced: true },
  };
  const waterCfg = JSON.parse(JSON.stringify(GAME.canvas.water));
  const stageCSea = new SeaStateResolver({ getEnvironment: () => stageCEnv, getSettings: () => waterCfg.seaState });
  stageCSea.update(100);
  const stageCReader = new WeatherStatusReader({
    getEnvironment: () => stageCEnv,
    seaState: stageCSea,
    getWater: () => waterCfg,
  });
  const stageCReading = stageCReader.read();
  assert.equal(stageCReading.windState, "strong");
  assert.equal(stageCReading.windGust, true);
  assert.equal(stageCReading.windStrengthForced, true);
  const stageCOverlayHtml = new WeatherOverlayModule({
    readWeather: () => stageCReading,
    htmlBuilder: new OverlayHtmlBuilder(),
  }).render();
  assert(stageCOverlayHtml.includes("сильний"), "overlay displays wind state label");
  assert(stageCOverlayHtml.includes("· порив (вручну)"), "overlay displays gust and manual strength tags");

  const locations = {
    test: { weather: JSON.parse(JSON.stringify(MAP_DB.test.weather)) },
    lake: { weather: JSON.parse(JSON.stringify(MAP_DB.test.weather)) },
  };
  const calls = [];
  const rowsByPath = new Map();
  const fakeNode = () => ({
    className: "",
    textContent: "",
    style: {},
    children: [],
    dataset: {},
    append(child) {
      this.children.push(child);
    },
    replaceChildren(...items) {
      this.children = [...items];
    },
    querySelectorAll() {
      return [];
    },
  });
  const prevDoc = globalThis.document;
  globalThis.document = {
    createElement: () => fakeNode(),
  };
  // TK-367: the rows in the order they are made (the order the user reads in «Керування»).
  const rowOrder = [];
  const buttonGridRows = [];
  try {
    const fakeUi = {
      syncCalls: [],
      createDetailsSection(_label, parent, path) {
        const body = fakeNode();
        if (path) rowsByPath.set(path.join("."), { kind: "section" });
        parent.append(body);
        return body;
      },
      createInfoRow() {},
      // DevToolsUI's contract (TK-367.1): the container the button rows of a two-column grid go into.
      createButtonGrid(parent) {
        const grid = fakeNode();
        grid.buttonGrid = true;
        rowOrder.push("grid");
        parent.append(grid);
        return grid;
      },
      createButtonRow(label, parent, onClick, _danger, _title, path) {
        if (parent?.buttonGrid) buttonGridRows.push(path ? path.join(".") : label);
        rowOrder.push(path ? path.join(".") : `button:${label}`);
        if (path) rowsByPath.set(path.join("."), { kind: "button", label, onClick });
        else rowsByPath.set(`button:${label}`, { kind: "button", label, onClick });
        return { style: {} };
      },
      setSectionLabel() {},
      createSwitcherRow(label, value, parent, onChange, path) {
        if (path) rowOrder.push(path.join("."));
        if (path) rowsByPath.set(path.join("."), { kind: "switcher", value, onChange });
      },
      createRangeRow(label, value, parent, onChange, path) {
        if (path) rowOrder.push(path.join("."));
        if (path) rowsByPath.set(path.join("."), { kind: "range", label, value, onChange });
      },
      createSelectRow(label, _choices, value, parent, onChange, path) {
        if (path) rowsByPath.set(path.join("."), { kind: "select", value, onChange });
      },
      addParameter(parent, { control, label, options, value, onCommit, path, min, max }) {
        if (path) rowOrder.push(path.join("."));
        if (control === "range" && path) rowsByPath.set(path.join("."), { kind: "range", label, value, min, max, onChange: onCommit });
        if (control === "switch" && path) rowsByPath.set(path.join("."), { kind: "switch", value, onChange: onCommit });
        if ((control === "choice" || control === "segments") && path) {
          rowsByPath.set(path.join("."), { kind: "choice", choices: options, value, onChange: onCommit });
        }
      },
      createInputRow(label, value, parent, _type, onChange, path, bindingPath) {
        if (path) rowOrder.push(path.join("."));
        if (path) rowsByPath.set(path.join("."), { kind: "input", value, onChange, bindingPath });
      },
      createTextRow() {},
      releaseValueBindings() {},
      syncValue(path, value) {
        this.syncCalls.push([path.join("."), value]);
      },
    };
    const fakeModel = {
      snapshot: stageCEnv.weather,
      hold(kind, strength) {
        calls.push(["hold", kind, strength]);
      },
      start(kind) {
        calls.push(["start", kind]);
        stageCEnv.weather.events[kind].active = true;
      },
      stop(kind) {
        calls.push(["stop", kind]);
        stageCEnv.weather.events[kind].active = false;
      },
      releaseAll() {
        calls.push(["releaseAll"]);
      },
      strike() {
        calls.push(["strike"]);
      },
    };
    const devState = { ashHold: null, ashEmission: 0, wavesHold: null, currentHold: null };
    const devWeather = new WeatherDevSection({
      ui: fakeUi,
      weather: {
        locationId: "test",
        getModel: () => fakeModel,
        getWind: () => stageCEnv.wind,
        setWind: (dir) => calls.push(["setWind", dir]),
        setWindStrength: (s) => calls.push(["setWindStrength", s]),
        triggerWindGust: () => calls.push(["triggerWindGust"]),
        // TK-367: the live state the switches follow, held as the game holds it.
        getAshHold: () => devState.ashHold,
        getAshStrength: () => devState.ashHold ?? devState.ashEmission,
        holdAsh: (v) => { calls.push(["holdAsh", v]); devState.ashHold = v; },
        getWavesHold: () => devState.wavesHold,
        getWavesScale: () => 1,
        holdWaves: (v) => { calls.push(["holdWaves", v]); devState.wavesHold = v; },
        getCurrentHold: () => devState.currentHold,
        getCurrentSpeed: () => devState.currentHold ?? 12,
        holdCurrent: (v) => { calls.push(["holdCurrent", v]); devState.currentHold = v; },
      },
      rainConfig: () => JSON.parse(JSON.stringify(GAME.canvas.rain)),
      config: () => locations.test.weather,
      locationConfig: (id) => locations[id]?.weather ?? null,
      locationsMap: () => locations,
      createSection: fakeUi.createDetailsSection,
      renderConfigTree: () => {},
      updateConfig: (path, val) => {
        calls.push(["updateConfig", path.join("."), val]);
      },
    });
    const host = fakeNode();
    devWeather.render(host);
    // Every WEATHER.* link emitted by WeatherOverlayModule must resolve to a control/section in WeatherDevSection.
    for (const [, linkPath] of stageCOverlayHtml.matchAll(/data-devtools-path="(WEATHER\.[^"]+)"/gu)) {
      assert(rowsByPath.has(linkPath), `WeatherDevSection registers ${linkPath} linked from WeatherOverlayModule`);
    }
    const locChoice = rowsByPath.get("WEATHER.location.id");
    assert(locChoice && locChoice.value === "Всі", "TK-333.2: the selector starts at «Всі»");
    assert.deepEqual(locChoice.choices.map((option) => option.value), ["Загальні", "Всі", "test", "lake"],
      "TK-327.1, TK-333: the selector lists «Загальні», «Всі» and every location as {value, label} buttons");
    locChoice.onChange("lake");
    // Spec 180 D2: the chances are each event's chance per check on the selected location.
    const rainChance = rowsByPath.get("WEATHER.chances.rainChance");
    assert.deepEqual(
      rainChance.bindingPath,
      ["CONFIG", "locations", "map", "lake", "weather", "rain", "chancePerCheck"],
      "Weather Chances binds directly to selected map's CONFIG weather tree",
    );
    rainChance.onChange(0.05);
    assert(
      calls.some(([k, p, v]) => k === "updateConfig" && p === "CONFIG.locations.map.lake.weather.rain.chancePerCheck" && v === 0.05),
      "Weather Chances updates the rain's chance per check on the selected location",
    );
    rowsByPath.get("WEATHER.chances.fogChance").onChange(1.5);
    assert(
      calls.some(([k, p, v]) => k === "updateConfig" && p === "CONFIG.locations.map.lake.weather.fog.chancePerCheck" && v === 1),
      "Weather Chances clamps fogChance to [0, 1] and calls updateConfig",
    );
    // TK-327.1: an event's switch starts a random event (like the game) and ends it; no «подія зараз» buttons.
    // TK-360 (owner): a strength slider appears only once its element is on, and goes when it is off.
    assert(!rowsByPath.has("WEATHER.controls.stormStrength") && !rowsByPath.has("WEATHER.controls.rainStrength") &&
      !rowsByPath.has("WEATHER.controls.fogStrength") && !rowsByPath.has("WEATHER.controls.rainAt100"),
    "nothing on: no strength sliders (and no rain «at 100» group)");
    rowsByPath.get("WEATHER.controls.storm").onChange(true);
    assert(calls.some(([k, kind]) => k === "start" && kind === "storm"), "the storm switch on starts a random storm");
    assert(rowsByPath.has("WEATHER.controls.stormStrength"), "the storm on: its slider appears");
    rowsByPath.delete("WEATHER.controls.stormStrength");
    rowsByPath.get("WEATHER.controls.storm").onChange(false);
    assert(calls.some(([k, kind]) => k === "stop" && kind === "storm"), "off ends it");
    assert(!rowsByPath.has("WEATHER.controls.stormStrength"), "off: the slider goes");
    assert(!rowsByPath.has("WEATHER.controls.stormStart"), "no «Шторм: подія зараз» button");
    rowsByPath.get("WEATHER.controls.storm").onChange(true);
    rowsByPath.get("WEATHER.controls.rain").onChange(true);
    calls.length = 0;
    // Spec 180 D1, D10: a slider holds its own element only (no «manual» switches); the storm's never touches the rain.
    rowsByPath.get("WEATHER.controls.stormStrength").onChange(40);
    const stormCalls = calls.filter(([k]) => k === "hold");
    assert.deepEqual(stormCalls.map(([, kind, strength]) => [kind, strength]), [["storm", 0.4]],
      "the storm's slider holds the storm only (never the rain)");
    rowsByPath.get("WEATHER.controls.windStrength").onChange(82);
    assert(calls.some(([k, v]) => k === "setWindStrength" && Math.abs(v - 0.82) < 1e-6), "strength slider drives setWindStrength");
    assert(!rowsByPath.has("WEATHER.controls.windStrengthHold"), "no separate «manual wind strength» switch (D10)");
    // TK-367 (owner): «↻ Оновити» on top, «↺ Автоматична погода» right under it; the actions after every control.
    rowOrder.length = 0;
    rowsByPath.get("WEATHER.controls.refresh").onClick();
    const at = (path) => rowOrder.indexOf(path);
    assert(at("WEATHER.controls.refresh") >= 0 && at("WEATHER.controls.auto") === at("WEATHER.controls.refresh") + 1 &&
      at("WEATHER.controls.auto") < at("WEATHER.controls.rain"), "«↻ Оновити» first, «↺ Автоматична погода» under it, then the elements");
    const lastControl = Math.max(at("WEATHER.controls.ash"), at("WEATHER.controls.wind"), at("WEATHER.controls.wavesOn"),
      at("WEATHER.controls.currentOn"), at("WEATHER.controls.fadeSec"));
    assert(at("WEATHER.controls.gust") > lastControl && at("WEATHER.controls.strike") > lastControl,
      "the action buttons come after every control");
    // TK-367.1 (owner): two to a line — the top pair and the actions in button grids; the per-element «↺ авто» not.
    assert.equal(rowOrder[at("WEATHER.controls.refresh") - 1], "grid", "«↻ Оновити» opens a button grid");
    assert(["WEATHER.controls.refresh", "WEATHER.controls.auto", "WEATHER.controls.gust", "WEATHER.controls.strike"]
      .every((path) => buttonGridRows.includes(path)), "the top pair and the actions are in button grids");
    // The wind: «← вліво | авто | вправо →» (no «немає» — calm is its switch off).
    const direction = rowsByPath.get("WEATHER.controls.windDirection");
    assert.equal(JSON.stringify(direction.choices.map((option) => option.label)), JSON.stringify(["← вліво", "авто", "вправо →"]),
      "the wind's direction is three buttons");
    direction.onChange("left");
    assert(calls.some(([k, v]) => k === "setWind" && v === -1), "«← вліво» holds the wind to the left");
    rowsByPath.get("WEATHER.controls.wind").onChange(false);
    assert.deepEqual(calls.filter(([k]) => k === "setWind").at(-1), ["setWind", 0], "the wind off is calm");
    // The ash (owner: managed apart from the emission): off with no emission, on holds the slider, off holds 0.
    assert.equal(rowsByPath.get("WEATHER.controls.ash").value, false, "no emission: the ash's switch is off");
    assert(!rowsByPath.has("WEATHER.controls.ashStrength"), "and it has no slider");
    rowsByPath.get("WEATHER.controls.ash").onChange(true);
    assert.deepEqual(calls.filter(([k]) => k === "holdAsh").at(-1), ["holdAsh", 1], "the ash on: held at the slider's 100 %");
    assert.equal(rowsByPath.get("WEATHER.controls.ash").value, true, "the switch shows it on");
    assert.match(rowsByPath.get("WEATHER.controls.ashStrength").label, /· вручну/u, "its slider says it is held by hand");
    rowsByPath.get("WEATHER.controls.ashStrength").onChange(30);
    assert(calls.some(([k, v]) => k === "holdAsh" && Math.abs(v - 0.3) < 1e-6), "the ash's slider holds the ash");
    rowsByPath.get("WEATHER.controls.ash").onChange(false);
    assert.deepEqual(calls.filter(([k]) => k === "holdAsh").at(-1), ["holdAsh", 0], "the ash off: held at 0 (even in an emission)");
    rowsByPath.get("WEATHER.controls.ashAuto").onClick();
    assert.deepEqual(calls.filter(([k]) => k === "holdAsh").at(-1), ["holdAsh", null], "«↺ авто»: it follows the emission again");
    devState.ashEmission = 0.6;
    devWeather.refreshLive();
    assert.equal(rowsByPath.get("WEATHER.controls.ash").value, true, "an emission's ash turns the open switch on by itself (R26)");
    // The waves: on by themselves; the slider holds the height; off — flat water.
    assert.equal(rowsByPath.get("WEATHER.controls.wavesOn").value, true, "the waves are on by themselves");
    rowsByPath.get("WEATHER.controls.waves").onChange(150);
    assert(calls.some(([k, v]) => k === "holdWaves" && Math.abs(v - 1.5) < 1e-6), "the waves' slider holds their height");
    rowsByPath.get("WEATHER.controls.wavesOn").onChange(false);
    assert.deepEqual(calls.filter(([k]) => k === "holdWaves").at(-1), ["holdWaves", 0], "the waves off: flat water");
    assert.equal(rowsByPath.get("WEATHER.controls.wavesOn").value, false);
    // The current: held in the running game — never written into the location's config (it would go to the export).
    const configWrites = calls.filter(([k]) => k === "updateConfig").length;
    assert.equal(rowsByPath.get("WEATHER.controls.currentOn").value, true, "the location's current is on");
    rowsByPath.get("WEATHER.controls.current").onChange(20);
    assert.deepEqual(calls.filter(([k]) => k === "holdCurrent").at(-1), ["holdCurrent", 20], "the slider holds the current's speed");
    rowsByPath.get("WEATHER.controls.currentOn").onChange(false);
    assert.deepEqual(calls.filter(([k]) => k === "holdCurrent").at(-1), ["holdCurrent", 0], "the current off: still water");
    assert.equal(rowsByPath.get("WEATHER.controls.currentOn").value, false);
    assert.equal(calls.filter(([k]) => k === "updateConfig").length, configWrites, "and no config write");
    // D16: under the rain's strength, its look at 100 for the selected location — a real value within the range.
    const density = rowsByPath.get("WEATHER.controls.rainAt100.maxDrops");
    assert(density && density.value === GAME_CONFIG.canvas.rain.strength.maxDrops[1] && density.max === 2000,
      "the density slider stands at the real value at 100 within its range");
    density.onChange(1100);
    assert(calls.some(([k, p, v]) => k === "updateConfig" && p === "CONFIG.locations.map.lake.weather.look.rain.maxDrops" && v === 1100),
      "with a location selected it writes that location's override at 100");
    // TK-333: «Всі» replaced the «Параметри локації» switch; «Загальні» shows the general parts alone.
    assert(!rowsByPath.has("WEATHER.location.only"), "no «Параметри локації» switch (its «off» is «Всі»)");
    rowsByPath.clear();
    locChoice.onChange("Загальні");
    rowsByPath.get("WEATHER.controls.rainAt100.maxDrops").onChange(900);
    assert(calls.some(([k, p, v]) => k === "updateConfig" && p === "CONFIG.canvas.rain.strength.maxDrops" &&
      JSON.stringify(v) === JSON.stringify([GAME_CONFIG.canvas.rain.strength.maxDrops[0], 900])),
    "with «Загальні» it writes the general end at 100");
    rowsByPath.get("WEATHER.controls.gust").onClick();
    assert(calls.some(([k]) => k === "triggerWindGust"), "gust button calls triggerWindGust");
    rowsByPath.get("WEATHER.controls.auto").onClick();
    assert(calls.some(([k, v]) => k === "setWindStrength" && v === null), "auto button resets forced wind strength");
    assert(["holdAsh", "holdWaves", "holdCurrent"].every((kind) => calls.filter(([k]) => k === kind).at(-1)[1] === null),
      "TK-367: «↺ Автоматична погода» releases the ash, the waves and the current too");
    assert(calls.some(([k]) => k === "releaseAll"), "auto button returns every weather process to its own course");

    // TK-298.1: Location selector stays visible even when only one location is configured.
    rowsByPath.clear();
    const singleMapSection = new WeatherDevSection({
      ui: fakeUi,
      weather: { locationId: "test", getModel: () => fakeModel, getWind: () => stageCEnv.wind },
      rainConfig: () => JSON.parse(JSON.stringify(GAME.canvas.rain)),
      config: () => locations.test.weather,
      locationConfig: (id) => (id === "test" ? locations.test.weather : null),
      locationsMap: () => ({ test: locations.test }),
      createSection: fakeUi.createDetailsSection,
      renderConfigTree: () => {},
    });
    singleMapSection.render(fakeNode());
    assert(rowsByPath.has("WEATHER.location.id"), "location selector is rendered even with a single location");
  } finally {
    globalThis.document = prevDoc;
  }

  // 14. TK-298.1: regressions found by review against commit 14593885.
  // (a) Releasing manual wind strength restores the episode's automatic target and fades within fadeSec.
  const holdReleaseWind = new WindModel({ getGeneralSettings: () => GAME_CONFIG.weather,
    rng: new SeededRng("r1"),
    getSettings: () => MAP_DB.test.weather.wind,
  });
  holdReleaseWind.update(100, { rain: 0, storm: 0 });
  const autoTargetBeforeHold = holdReleaseWind.snapshot.targetStrength;
  holdReleaseWind.setStrengthOverride(0.95);
  for (let i = 0; i < 10; i += 1) holdReleaseWind.update(1000, { rain: 0, storm: 0 });
  holdReleaseWind.setStrengthOverride(null);
  assert.equal(
    holdReleaseWind.snapshot.targetStrength,
    autoTargetBeforeHold,
    "releasing manual strength immediately restores automatic episode target",
  );
  for (let i = 0; i < 15; i += 1) holdReleaseWind.update(1000, { rain: 0, storm: 0 });
  assert(
    holdReleaseWind.snapshot.baseStrength < 0.7,
    `baseStrength fades back toward automatic episode target after release (got ${holdReleaseWind.snapshot.baseStrength})`,
  );

  // (b) Forced non-zero direction never visits calm (0 strength with non-zero direction) across episodes.
  const forcedDirWind = new WindModel({ getGeneralSettings: () => GAME_CONFIG.weather,
    rng: new SeededRng("r2"),
    getSettings: () => MAP_DB.test.weather.wind,
  });
  forcedDirWind.setDirectionOverride(1);
  for (let i = 0; i < 3000; i += 1) {
    const snap = forcedDirWind.update(1000, { rain: 0, storm: 0 });
    assert(
      snap.strength > 0 && snap.direction === 1,
      `forced direction=1 keeps positive wind strength across episodes (step ${i}: strength=${snap.strength}, dir=${snap.direction})`,
    );
  }
  forcedDirWind.setStrengthOverride(0);
  assert.equal(forcedDirWind.snapshot.direction, 0, "setting manual strength to 0 clears direction to 0");

  // (c) Float return-swing is C1-continuous across cycle boundaries, capped by maxAngleDeg, and honors maxAngleDeg: 0.
  const smoothFloat = new WaterEntity(
    500,
    400,
    { type: "day", maxDepth: 6, quality: 0, windCompensation: [0, 0] },
    6,
    new SeededRng("r4"),
  );
  const smoothEnv = {
    current: null,
    wind: {
      direction: 1,
      strength: 0.95,
      rainMult: 1,
      float: {
        maxAngleDeg: 38,
        returnPctRange: [0.15, 0.45],
        cycleDurationSec: [0.45, 0.6],
        amplitudeJitter: [0.8, 1.15],
      },
    },
  };
  let prevTargetAngle = null;
  let maxStepDeg = 0;
  for (let step = 0; step < 300; step += 1) {
    smoothFloat.update(bounds, 16, smoothEnv, () => true);
    const angle = smoothFloat._targetWindAngle;
    assert(angle <= 38 + 1e-6, `float wind target angle (${angle}) never exceeds maxAngleDeg (38)`);
    if (prevTargetAngle !== null) {
      maxStepDeg = Math.max(maxStepDeg, Math.abs(angle - prevTargetAngle));
    }
    prevTargetAngle = angle;
  }
  assert(
    maxStepDeg < 2.2,
    `float target wind angle transitions smoothly across cycle boundaries without jumps (max 16ms step: ${maxStepDeg.toFixed(2)}°)`,
  );
  smoothEnv.wind.float.maxAngleDeg = 0;
  smoothFloat.update(bounds, 16, smoothEnv, () => true);
  assert.equal(smoothFloat._targetWindAngle, 0, "maxAngleDeg: 0 disables float wind lean");

  // 15. TK-298.2:
  // (a) Default equipped float (ITEM_DB.floats.float_day) has windCompensation upper bound < 1 so wind visibly tilts
  //     it out of the box, and syncEquipmentStats updates a cast FloatEntity live without recasting.
  const { ITEM_DB } = require("../../../src/game/config/raw/items/item_database.js");
  const { FloatEntity } = require("../../../src/game/domain/tackle/float_entity.js");
  for (const floatId of ["float_day", "float_night", "float_sliding"]) {
    const comp = ITEM_DB.floats[floatId]?.gameplayStats?.windCompensation;
    assert(
      Array.isArray(comp) && comp[1] <= 0.75,
      `${floatId} default windCompensation[1] leaves visible wind motion (got ${JSON.stringify(comp)})`,
    );
  }
  const castDefaultFloat = new FloatEntity(
    500,
    400,
    { ...ITEM_DB.floats.float_day.gameplayStats, type: "day" },
    6,
    new SeededRng("r5"),
  );
  const liveFloatEnv = {
    current: null,
    wind: {
      direction: 1,
      strength: 0.9,
      gustStrength: 0.2,
      rainMult: 1,
      float: { maxAngleDeg: 38, returnPctRange: [0.15, 0.3], cycleDurationSec: [0.5, 0.6], amplitudeJitter: [1, 1] },
    },
  };
  castDefaultFloat.update(bounds, 50, liveFloatEnv, () => true);
  const defaultTilt = castDefaultFloat._targetWindAngle;
  assert(
    defaultTilt > 8,
    `default float_day tilts visibly under strong wind out of the box (got ${defaultTilt.toFixed(2)}°)`,
  );
  assert.equal(typeof castDefaultFloat.syncEquipmentStats, "function", "FloatEntity exposes syncEquipmentStats");
  castDefaultFloat.syncEquipmentStats({ quality: 0, windCompensation: [0.1, 0.0] });
  castDefaultFloat.update(bounds, 50, liveFloatEnv, () => true);
  assert(
    castDefaultFloat._targetWindAngle > defaultTilt * 2,
    `syncEquipmentStats immediately updates live cast float wind lean without recasting (${defaultTilt.toFixed(2)}° -> ${castDefaultFloat._targetWindAngle.toFixed(2)}°)`,
  );

  // (b) WeatherRenderModelBuilder forwards windGust (gustStrength) for rain gust slant.
  const { WeatherRenderModelBuilder } = require("../../../src/game/presentation/rendering/weather_render_model_builder.js");
  const gustRenderTarget = { rain: 0, storm: 0, fog: 0, cloud: 0, windDirection: 0, windStrength: 0, windGust: 0 };
  let grainShare = 1;
  const gustBuilder = new WeatherRenderModelBuilder({
    getEnvironment: () => ({
      weather: { rain: 0.8, storm: 0, fog: 0, cloud: 0.8 },
      wind: { direction: -1, strength: 0.85, gustStrength: 0.26 },
    }),
    getGrainShare: () => grainShare,
  });
  gustBuilder.buildInto(gustRenderTarget);
  assert(
    Math.abs(gustRenderTarget.windGust - 0.26) < 1e-6,
    `WeatherRenderModelBuilder copies wind.gustStrength into target.windGust (got ${gustRenderTarget.windGust})`,
  );
  // Spec 179 stage K (TK-373): the statuses' share of the hiss reaches the scene (the gas mask: 0.3).
  assert.equal(gustRenderTarget.grainShare, 1, "no gas mask: the full hiss");
  grainShare = 0.3;gustBuilder.buildInto(gustRenderTarget);
  assert.equal(gustRenderTarget.grainShare, 0.3, "the gas mask's share of the hiss reaches the scene");
  const { PlayerStatusEffects } = require("../../../src/game/application/world/player_status_effects.js");
  const { CONFIG: statusConfig } = require("../../../src/game/config/runtime/game_config.js");
  const maskStatuses = new PlayerStatusEffects({ now: () => 0, getDefinitions: () => statusConfig.statusEffects,
    scheduler: { setTimeout() { return 1; }, clearTimeout() {} } });
  assert.equal(maskStatuses.modifier("radiation", "grain"), 1);
  maskStatuses.hold("gasMask", true);
  assert.equal(maskStatuses.modifier("radiation", "grain"), 0.3, "the gas mask in its slot mutes the hiss to 0.3");
  maskStatuses.hold("gasMask", false);
}

// Spec 179 stage A: the emission's parts, intensity, intervals, radiation, its storm hold and the environment's fields.
{
  const { EmissionModel } = require("../../../src/game/domain/weather/emission_model.js");
  const emissionSettings = () => ({
    emission: {
      enabled: true, cooldownSec: 10, checkIntervalSec: 1, chancePerCheck: 1, chanceGrowthPerCheck: 0,
      // Spec 180 D13: the shared timeline — 90 s: onset 20 s, peak 30 s, fade 40 s, full strength.
      durationSec: [90, 90], peakAtShare: [20 / 90, 20 / 90], peakShare: [30 / 90, 30 / 90], peakStrength: [1, 1],
      storm: { rain: 0.9, storm: 0.8 },
    },
    radiation: { base: 0.1, emissionPeak: 0.9 },
  });
  const tick = (model, seconds, dt = 0.1) => {
    for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) model.update(dt * 1000);
  };

  // (a) The real location: enabled, base radiation 0 (owner), a peak of 1.
  const real = MAP_DB.test.weather;
  assert.equal(real.emission.enabled, true, "the test location has the emission");
  assert.equal(real.radiation.base, 0, "the test location's base radiation is 0 (owner, spec 179 Q3)");
  assert.equal(real.radiation.emissionPeak, 1, "the emission's peak radiation is 1");
  const realModel = new EmissionModel({ rng: new SeededRng("check:emission"), getSettings: () => real });
  const realPhases = new Set();
  for (let index = 0; index < 40000; index += 1) {
    realModel.update(1000);
    const snap = realModel.snapshot;
    realPhases.add(snap.phase);
    assert.ok(snap.intensity >= 0 && snap.intensity <= 1 && snap.radiation >= 0 && snap.radiation <= 1, "in 0…1");
    if (snap.phase === "idle") assert.equal(snap.radiation, 0, "no radiation outside an emission (base 0)");
  }
  assert.deepEqual([...realPhases].sort(), ["fade", "idle", "onset", "peak"], "a long run visits every part");
  assert.ok(realModel.snapshot.serial >= 5, `11 hours of real time give several emissions (${realModel.snapshot.serial})`);

  // (b) Parts in order on the timeline; the intensity rises and falls along a smoothstep, 1 on the peak.
  const model = new EmissionModel({ rng: new SeededRng(3), getSettings: emissionSettings });
  model.update(0);
  assert.equal(model.snapshot.phase, "idle", "starts idle");
  near(model.snapshot.cooldownLeftSec, 10, "no rolls during the cooldown after the session's start");
  assert.equal(model.snapshot.phaseLeftSec, 0, "an idle emission holds no time of the next one");
  near(model.snapshot.radiation, 0.1, "base radiation while idle");
  tick(model, 10.95);
  assert.equal(model.snapshot.phase, "idle", "the first roll comes one check interval after the cooldown");
  tick(model, 0.1);
  assert.equal(model.snapshot.phase, "onset", "the onset starts after the first delay");
  assert.equal(model.snapshot.serial, 1, "the first emission is counted");
  tick(model, 9.95);
  assert.ok(Math.abs(model.snapshot.intensity - 0.5) < 0.02, `half the onset = 50% (smoothstep, ${model.snapshot.intensity})`);
  assert.ok(Math.abs(model.snapshot.radiation - (0.1 + 0.8 * model.snapshot.intensity)) < 1e-9,
    "radiation = base + (peak − base) × intensity");
  tick(model, 10.1);
  assert.equal(model.snapshot.phase, "peak", "the peak follows the onset");
  near(model.snapshot.intensity, 1, "the peak holds the full intensity");
  near(model.snapshot.radiation, 0.9, "the peak radiation");
  tick(model, 30);
  assert.equal(model.snapshot.phase, "fade", "the fade follows the peak");
  tick(model, 20);
  assert.ok(Math.abs(model.snapshot.intensity - 0.5) < 0.02, `half the fade = 50% (smoothstep, ${model.snapshot.intensity})`);
  tick(model, 20.1);
  assert.equal(model.snapshot.phase, "idle", "idle after the fade");
  assert.ok(Math.abs(model.snapshot.cooldownLeftSec - 10) < 0.2, "a new cooldown after the emission");
  assert.equal(model.snapshot.phaseLeftSec, 0, "and still no time of the next one");

  // (b2) TK-321.1: one roll per checkIntervalSec; each failed roll raises the chance by chanceGrowthPerCheck.
  {
    const rolls = { count: 0 };
    const counted = { next: () => { rolls.count += 1; return 0.999; }, range: (min) => min };
    const rollSettings = emissionSettings();
    Object.assign(rollSettings.emission, { cooldownSec: 0, checkIntervalSec: 60, chancePerCheck: 0.01, chanceGrowthPerCheck: 0.02 });
    const rolling = new EmissionModel({ rng: counted, getSettings: () => rollSettings });
    for (let second = 0; second < 600; second += 1) rolling.update(1000);
    assert.equal(rolls.count, 10, `ten minutes = ten rolls, not one per second (${rolls.count})`);
    assert.equal(rolling.snapshot.failedChecks, 10, "ten failed rolls");
    near(rolling.snapshot.chance, 0.01 + 0.02 * 10, "the chance grows with each failed roll");
    rollSettings.emission.enabled = false;
    for (let second = 0; second < 600; second += 1) rolling.update(1000);
    assert.equal(rolls.count, 10, "a disabled emission does not roll");

    // Spec 179 D4: an emission waits for its background — no rolls (none failed) until canStart allows them.
    let ready = false;
    const waitRolls = { count: 0 };
    const waitSettings = emissionSettings();
    Object.assign(waitSettings.emission, { cooldownSec: 0, checkIntervalSec: 60, chancePerCheck: 1 });
    const waiting = new EmissionModel({ rng: { next: () => { waitRolls.count += 1; return 0; }, range: (min) => min },
      getSettings: () => waitSettings, canStart: () => ready });
    for (let second = 0; second < 300; second += 1) waiting.update(1000);
    assert.deepEqual([waiting.snapshot.phase, waitRolls.count, waiting.snapshot.failedChecks], ["idle", 0, 0],
      "no roll while the background is missing");
    ready = true;
    for (let second = 0; second < 61; second += 1) waiting.update(1000);
    assert.equal(waiting.snapshot.phase, "onset", "the first roll after the background arrived starts it");
    assert.throws(() => new EmissionModel({ rng: counted, getSettings: () => waitSettings, canStart: true }), /canStart/u);
  }

  // (b3) The location's real settings through the DevTools «РАНДОМАЙЗЕР» probe: most starts 30–60 minutes apart.
  {
    const { EmissionRandomProbe } = require("../../../src/dev/randomizer/emission_random_probe.js");
    const probe = new EmissionRandomProbe({ createModel: (options) => new EmissionModel(options),
      createRng: (seed) => new SeededRng(seed), getSettings: () => MAP_DB.test.weather });
    const report = probe.run({ count: 400, seed: 12345 });
    const row = (label) => report.rows.find(([name]) => name === label)?.[1] ?? "";
    assert.match(row("змодельовано"), /^400 з 400 викидів/u, "the probe collects the requested emissions");
    const within = Number.parseFloat(row("у проміжку 30–60 хв"));
    assert.ok(within >= 65, `the real settings put most emissions 30–60 min apart (${within}%)`);
    const median = Number.parseFloat(row("медіана"));
    assert.ok(median >= 35 && median <= 55, `median start-to-start in 35–55 min (${median})`);
    const shares = report.histogram.reduce((sum, [, share]) => sum + share, 0);
    assert.ok(Math.abs(shares - 1) < 1e-9, "the histogram covers every interval");
    assert.equal(JSON.stringify(probe.run({ count: 50, seed: 7 }).rows),
      JSON.stringify(probe.run({ count: 50, seed: 7 }).rows), "a seed repeats the probe's run");
  }

  // (c) Determinism, freezing, forcing and the radiation override.
  const trace = () => {
    const traced = new EmissionModel({ rng: new SeededRng("check:emission:trace"), getSettings: emissionSettings });
    const out = [];
    for (let index = 0; index < 4000; index += 1) {
      traced.update(500);
      if (index % 40 === 0) out.push(traced.snapshot.phase + traced.snapshot.intensity.toFixed(6));
    }
    return out.join("|");
  };
  assert.equal(trace(), trace(), "the emission is deterministic for a seed");
  model.force("peak", { durationSec: 5 });
  model.setFrozen(true);
  tick(model, 50);
  assert.equal(model.snapshot.phase, "peak", "a frozen emission keeps its part");
  model.setFrozen(false);
  model.setRadiationOverride(0.42);
  near(model.snapshot.radiation, 0.42, "radiation held by hand");
  assert.equal(model.snapshot.radiationForced, true, "the override is reported");
  model.setRadiationOverride(null);
  near(model.snapshot.radiation, 0.9, "the override released");
  const disabledSettings = emissionSettings();
  disabledSettings.emission.enabled = false;
  const disabled = new EmissionModel({ rng: new SeededRng(1), getSettings: () => disabledSettings });
  tick(disabled, 500, 1);
  assert.equal(disabled.snapshot.phase, "idle", "a disabled emission never starts on its own");

  // (d) The environment (spec 180): a running emission holds the storm and the rain at least at its own strengths ×
  //     its intensity; they rise and fall with it; after it the weather runs on its own.
  const location = { weather: { ...settings(), ...emissionSettings() } };
  for (const kind of ["rain", "storm", "fog"]) location.weather[kind].enabled = false;
  location.weather.storm.lightning.chance = 1;
  const weatherRng = new SeededRng(11);
  const weather = new WeatherModel({ rng: weatherRng, getSettings: () => location.weather });
  const emission = new EmissionModel({ rng: new SeededRng("11:emission"), getSettings: () => location.weather });
  const environment = new EnvironmentSystem(location, 12, weatherRng,
    { timePhases: { day: { startHour: 0, endHour: 24 } } }, null, weather, null, emission);
  const run = (seconds) => { for (let t = 0; t < seconds - 1e-9; t += 0.1) environment.update(100, 0); };
  run(5);
  const held = environment.getSnapshot();
  assert.deepEqual([held.weather.storm, held.weather.rain], [0, 0], "clear before the emission");
  near(held.radiation, 0.1, "the environment exposes the base radiation");
  run(6.2);
  assert.equal(held.emission.phase, "onset", "the emission started");
  run(10);
  const half = held.emission.intensity;
  assert.ok(half > 0.3 && half < 0.7, `half way up the onset (${half})`);
  near(held.weather.storm, 0.8 * half, "the storm follows the emission's strength × its own", 0.02);
  near(held.weather.rain, 0.9 * half, "and so does the rain", 0.02);
  run(20);
  assert.equal(held.emission.phase, "peak", "at the peak");
  near(held.weather.storm, 0.8, "the emission's own storm strength", 1e-6);
  near(held.weather.rain, 0.9, "the emission's own rain strength", 1e-6);
  assert.equal(held.weather.frozen, false, "an emission is not a manual hold");
  run(70);
  assert.equal(held.emission.phase, "idle", "the emission ended");
  assert.deepEqual([held.weather.storm, held.weather.rain], [0, 0], "its storm and rain went with it (own events off)");
  near(held.radiation, 0.1, "radiation back to base");

  // (e) A manual hold wins over the emission's floor (DevTools tests the look by hand).
  const handWeather = new WeatherModel({ rng: new SeededRng(5), getSettings: () => location.weather });
  handWeather.hold("rain", 0.3, { fadeSec: 0 });
  handWeather.update(5000, null, { storm: 1, rain: 1 });
  near(handWeather.snapshot.rain, 0.3, "DEV's held rain stays under the emission");
  near(handWeather.snapshot.storm, 1, "the storm follows the emission's floor");

  // (f) Without an emission model the environment has none and no radiation.
  const plain = new EnvironmentSystem(location, 12, new SeededRng(2), { timePhases: { day: { startHour: 0, endHour: 24 } } },
    null, new WeatherModel({ rng: new SeededRng(2), getSettings: () => location.weather }));
  plain.update(1000, 0);
  assert.equal(plain.getSnapshot().emission.phase, "idle", "no emission model: idle");
  assert.equal(plain.getSnapshot().radiation, 0, "no emission model: radiation 0");
}

// TK-321.2: one session seed for every stream — random per launch without a configured seed, kept when configured.
{
  const { resolveSessionSeed } = require("../../../src/engine/random/session_seed.js");
  let fills = 0;
  const fill = (values) => { fills += 1; values[0] = 1000 + fills; };
  const first = resolveSessionSeed(undefined, fill);
  const second = resolveSessionSeed(null, fill);
  assert.notEqual(first, second, "two launches without a seed get different seeds");
  assert.equal(fills, 2, "the seed comes from the random source");
  assert.ok(Number.isInteger(resolveSessionSeed(undefined, null)) && resolveSessionSeed(undefined, null) > 0,
    "without a random source the seed still is a positive integer");
  assert.equal(resolveSessionSeed(42, fill), 42, "a configured seed is kept");
  assert.equal(resolveSessionSeed("test", fill), "test", "a text seed is kept");
  assert.equal(fills, 2, "a configured seed never reads the random source");
  const sequence = (seed) => { const rng = new SeededRng(seed); return [rng.next(), rng.next(), rng.next()].join(); };
  assert.notEqual(sequence(first), sequence(second), "different sessions give different bite sequences");
  assert.equal(sequence(resolveSessionSeed(42)), sequence(42), "the same configured seed repeats the session");
  const rootSource = require("node:fs").readFileSync(require("node:path").join(__dirname,
    "../../../src/bootstrap/production/game_composition_root.js"), "utf8");
  assert.ok(!/new SeededRng\(\s*this\.#config\.debug\?\.seed/u.test(rootSource) && !rootSource.includes('?? "cyber-fishing"'),
    "production builds no stream from a fixed default seed");
  assert.equal((rootSource.match(/this\.#sessionSeed\(\)/gu) || []).length >= 3, true,
    "the fish, environment and DevTools read the one session seed");
}

// Spec 179 stage E (TK-324): exposure (gas mask, cast gate), the screen effect's curves and the DOM veil.
{
  const { EmissionExposure } = require("../../../src/game/application/world/emission_exposure.js");
  const { EmissionScreenEffect, sceneBlurPx } = require("../../../src/game/presentation/weather/emission_screen_effect.js");
  const { EmissionVeilDomRenderer } = require("../../../src/platform/browser/dom/emission_veil_dom_renderer.js");
  const { CONFIG } = require("../../../src/game/config/runtime/game_config.js");
  const { PlayerStatusEffects } = require("../../../src/game/application/world/player_status_effects.js");
  const { EquipmentStatusSource } = require("../../../src/game/application/world/equipment_status_source.js");
  let env = { emission: { phase: "idle", intensity: 0 } };
  let equipped = {};
  let clockMs = 0;
  // A scheduler double with the timer contract: one pending callback per id, run when the test moves the clock.
  const timers = new Map();
  let timerId = 0;
  const scheduler = { setTimeout: (fn, ms) => { timers.set(++timerId, { fn, at: clockMs + ms }); return timerId; },
    clearTimeout: (id) => timers.delete(id) };
  const advance = (toMs) => {
    clockMs = toMs;
    for (const [id, timer] of [...timers]) if (timer.at <= clockMs) { timers.delete(id); timer.fn(); }
  };
  const statuses = new PlayerStatusEffects({ now: () => clockMs, getDefinitions: () => CONFIG.statusEffects, scheduler });
  const inventoryListeners = new Set();
  const equipmentSource = new EquipmentStatusSource({ inventory: { getEquipped: () => equipped,
    onInventoryChanged: (fn) => { inventoryListeners.add(fn); return () => inventoryListeners.delete(fn); } },
  statuses, slots: { gasMask: "gasMask" } });
  const equip = (value) => { equipped = value; for (const fn of inventoryListeners) fn(); };
  // Spec 179 D12 (TK-371): the player's presence in the house.
  const { HousePresence } = require("../../../src/game/application/world/house_presence.js");
  const house = new HousePresence();
  const exposure = new EmissionExposure({ getEnvironment: () => env, getEquipped: () => equipped, statuses, house });
  assert.deepEqual([exposure.intensity(), exposure.isCastBlocked()], [0, false], "no emission: no effect, casting allowed");
  env = { emission: { phase: "onset", intensity: 0.5 } };
  assert.deepEqual([exposure.intensity(), exposure.modifier("vignette"), exposure.isCastBlocked()], [0.5, 1, true], "an emission without a gas mask: effect and no cast");
  house.enter();
  assert.equal(exposure.intensity(), 0, "spec 179 D12: in the house the emission's screen effects stop");
  // TK-371.2: the Geiger counter's sound reads the felt radiation — none in the house (it clicked on before).
  assert.equal(house.feltRadiation(0.8), 0, "in the house no radiation is felt");
  assert.ok(require("node:fs").readFileSync(require("node:path").join(__dirname, "../../../src/bootstrap/production/game_composition_root.js"), "utf8")
    .includes("getRadiation: () => this.#housePresence.feltRadiation("), "the Geiger counter is composed over the felt radiation");
  house.leave();
  assert.equal(exposure.intensity(), 0.5, "back on the location: the effects at the emission's current strength");
  assert.equal(house.feltRadiation(0.8), 0.8, "on the location the radiation is felt");
  equip({ gasMask: { id: "mask" } });
  assert.deepEqual([statuses.has("gasMask"), exposure.modifier("vignette"), exposure.modifier("blur"), exposure.isCastBlocked()], [true, 0, 0, false],
    "a gas mask holds its status: no effect and casting allowed");
  equip({});
  assert.equal(statuses.has("gasMask"), false, "out of its slot, the gas mask's status ends");
  env = { emission: { phase: "fade", intensity: 0.01 } };
  assert.equal(exposure.isCastBlocked(), true, "casting stays closed to the emission's very end");

  // Spec 181 stage A (TK-341): the vodka is a status (CONFIG.statusEffects.vodka) — half the screen effect for 10 minutes;
  // no cast; another bottle renews the time, never adds up; the gas mask still wins; events only on a change.
  const { ITEM_DB } = require("../../../src/game/config/raw/items/item_database.js");
  const vodka = ITEM_DB.drinks.vodka_bottle.gameplayStats.use;
  assert.equal(JSON.stringify(vodka), JSON.stringify({ statusId: "vodka" }), "the bottle names its status");
  const vodkaStatus = CONFIG.statusEffects.vodka;
  assert.equal(JSON.stringify([vodkaStatus.kind, vodkaStatus.durationSec, vodkaStatus.stacking, vodkaStatus.timeBase,
    vodkaStatus.modifiers.emission]), JSON.stringify(["buff", 600, "renew", "real", { vignette: 0.5, blur: 0.5, blurRate: 1 }]),
  "owner Q8: −50 % for 10 minutes, real time (spec 181 Q1)");
  assert.equal(ITEM_DB.gasMasks.gas_mask_basic.itemType, "gas_mask", "the gas mask fits its slot");
  const events = [];
  const unsubscribe = statuses.subscribe((event) => events.push(`${event.type}:${event.id}`));
  env = { emission: { phase: "peak", intensity: 1 } };
  assert.equal(statuses.apply("vodka", { source: "vodka_bottle" }), true, "a drink takes effect");
  assert.deepEqual([exposure.modifier("vignette"), exposure.modifier("blur"), exposure.isCastBlocked()], [0.5, 0.5, true],
    "vodka: half the effect, still no cast");
  for (let frame = 0; frame < 120; frame++) { clockMs += 16; exposure.modifier("vignette"); statuses.list(); }
  assert.equal(events.join(), "start:vodka", "reads every frame emit nothing");
  advance(300000);
  assert.equal(statuses.apply("vodka"), true);
  assert.equal(statuses.modifier("emission", "vignette"), 0.5, "a second bottle does not add up");
  assert.equal(statuses.list().length, 1, "one status, renewed");
  advance(300000 + 599000);
  assert.equal(exposure.modifier("vignette"), 0.5, "and renews the time (10 minutes from the second one)");
  advance(300000 + 600001);
  assert.equal(events.join(), "start:vodka,update:vodka,end:vodka", "the timer ends it with one event");
  assert.deepEqual([exposure.modifier("vignette"), exposure.intensity()], [1, 1], "over: the full effect again");
  assert.equal(timers.size, 0, "no timer once nothing is timed");
  assert.equal(statuses.apply("unknown"), false, "an unknown status does nothing");
  assert.equal(statuses.apply("gasMask"), false, "a status without a timer is never applied as timed");
  statuses.apply("vodka");
  equip({ gasMask: { id: "mask" } });
  assert.deepEqual([exposure.modifier("vignette"), exposure.modifier("blur"), exposure.isCastBlocked()], [0, 0, false],
    "the gas mask wins over the vodka (the product of the shares)");
  statuses.clear();
  assert.equal(JSON.stringify(statuses.list().map((entry) => entry.id)), JSON.stringify(["gasMask"]),
    "«Зняти всі» ends the timed statuses; the slot keeps holding the gas mask's");
  equip({});
  unsubscribe();
  equipmentSource.dispose();
  // The stacking rules on their own descriptions: max keeps the longer time, add stacks up to maxStacks (the share once
  // per stack); a DevTools edit of a description reaches the next apply and the modifiers at once.
  const defs = { long: { kind: "debuff", durationSec: 100, stacking: "max", maxStacks: 1, modifiers: { emission: { blur: 0.5 } } },
    stack: { kind: "buff", durationSec: 10, stacking: "add", maxStacks: 2, modifiers: { emission: { blur: 0.5 } } } };
  clockMs = 0;
  const rules = new PlayerStatusEffects({ now: () => clockMs, getDefinitions: () => defs, scheduler });
  rules.apply("long");
  clockMs = 10000;
  defs.long.durationSec = 50;
  rules.apply("long");
  assert.equal(rules.remainingSec("long"), 90, "max: a shorter apply keeps the longer time left");
  rules.apply("stack"); rules.apply("stack"); rules.apply("stack");
  assert.equal(rules.list().find((entry) => entry.id === "stack").stacks, 2, "add: up to maxStacks");
  assert.equal(rules.modifier("emission", "blur"), 0.5 * 0.25, "the product over statuses, a share per stack");
  defs.long.modifiers.emission.blur = 1;
  assert.equal(rules.modifier("emission", "blur"), 0.25, "a live edit reaches the modifier at once");
  rules.dispose();
  // Spec 181 D4 (TK-345, owner Q2): the debuff «Радіація» is held while the location's radiation is above zero, without a
  // timer and modifiers; it calls the statuses only when the state changes.
  const { RadiationStatusSource } = require("../../../src/game/application/world/radiation_status_source.js");
  const radiationDef = CONFIG.statusEffects.radiation;
  assert.equal(JSON.stringify([radiationDef.kind, radiationDef.badge, radiationDef.durationSec, radiationDef.icon]),
    JSON.stringify(["debuff", true, 0, "radiation"]), "a debuff badge without a timer");
  let radiationEnv = { radiation: 0 };
  const radiationEvents = [];
  const stopRadiationEvents = statuses.subscribe((event) => radiationEvents.push(`${event.type}:${event.id}`));
  const radiationSource = new RadiationStatusSource({ getEnvironment: () => radiationEnv, statuses, house });
  radiationSource.update();
  assert.equal(statuses.has("radiation"), false, "no radiation: no debuff");
  radiationEnv = { radiation: 0.02 };
  for (let frame = 0; frame < 60; frame += 1) { radiationEnv.radiation += 0.01; radiationSource.update(); }
  assert.equal(statuses.has("radiation"), true, "radiation above zero holds the debuff");
  assert.equal(statuses.remainingSec("radiation"), Infinity, "without a timer");
  assert.equal(statuses.modifier("emission", "vignette"), 1, "it changes no effect of the emission");
  house.enter();
  radiationSource.update();
  assert.equal(statuses.has("radiation"), false, "spec 179 D12, spec 181 Q5: in the house the debuff does not act (no badge)");
  house.leave();
  radiationSource.update();
  assert.equal(statuses.has("radiation"), true, "back under radiation: held again");
  radiationEnv = { radiation: 0 };
  radiationSource.update();
  radiationSource.update();
  assert.equal(radiationEvents.join(), "start:radiation,end:radiation,start:radiation,end:radiation",
    "start, out in the house, back, end — once each, never per frame");
  stopRadiationEvents();
  // TK-358: a radiation without its description (removed in DevTools) is picked up once the description is back.
  const liveDefs = { ...CONFIG.statusEffects };
  delete liveDefs.radiation;
  const lateStatuses = new PlayerStatusEffects({ now: () => clockMs, getDefinitions: () => liveDefs, scheduler });
  const lateSource = new RadiationStatusSource({ getEnvironment: () => ({ radiation: 0.5 }), statuses: lateStatuses, house });
  lateSource.update();
  assert.equal(lateStatuses.has("radiation"), false, "no description: nothing held");
  liveDefs.radiation = CONFIG.statusEffects.radiation;
  lateSource.update();
  assert.equal(lateStatuses.has("radiation"), true, "the description back: the radiation's debuff is held");
  // TK-358: disposed statuses forget their pending timer, so a later apply schedules its end again.
  lateStatuses.apply("vodka");
  lateStatuses.dispose();
  const timersBefore = timers.size;
  lateStatuses.apply("vodka"); // renewed at the same moment: the same end as the cleared timer's
  assert.equal(timers.size, timersBefore + 1, "after dispose a renewed status schedules its end again");
  lateStatuses.dispose();
  clockMs = 0;
  timers.clear();
  env = { emission: { phase: "idle", intensity: 0 } };

  // The effect (TK-324.1): sharp irregular blur pulses that quicken and grow toward the peak; a vignette that sways on
  // a wandering swell and closes in deeper than it opens out.
  const settings = CONFIG.emission.screen;
  assert.equal(settings.includeHud, false,
    "TK-324.4 (owner): by default only the world is blurred — the WebGL scene's filter, not the full-resolution CSS veil");
  assert.equal(sceneBlurPx({ visible: true, includeHud: settings.includeHud, blurPx: 3 }), 3,
    "so the default emission blur goes to the scene");
  let seedFx = 5;
  const randomFx = () => { seedFx = (Math.imul(seedFx, 1664525) + 1013904223) >>> 0; return seedFx / 4294967296; };
  const run = (strengthAt, seconds) => {
    const fx = new EmissionScreenEffect({ random: randomFx });
    const out = [];
    for (let t = 0; t < seconds; t += 1 / 60) {
      const record = fx.update(1000 / 60, strengthAt(t), settings);
      out.push({ t, blur: record.blurPx, radius: record.clearRadius, dark: record.darkness, visible: record.visible });
    }
    return out;
  };
  const pulses = (samples) => {
    // A pulse starts where the blur jumps up sharply between two frames.
    const starts = [];
    for (let index = 1; index < samples.length; index += 1) {
      if (samples[index].blur - samples[index - 1].blur > settings.blur.strengthPx * 0.08 &&
        (starts.length === 0 || samples[index].t - starts[starts.length - 1].t > 0.04)) starts.push(samples[index]);
    }
    return starts;
  };
  assert.equal(new EmissionScreenEffect().update(16, 0, settings).visible, false, "strength 0: the veil is hidden");
  const low = run(() => 0.3, 60);
  const peak = run(() => 1, 60);
  const lowPulses = pulses(low);
  const peakPulses = pulses(peak);
  const gaps = (list) => list.slice(1).map((pulse, index) => pulse.t - list[index].t);
  const mean = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;
  const spread = (list) => Math.sqrt(mean(list.map((value) => (value - mean(list)) ** 2))) / mean(list);
  assert.ok(peakPulses.length > lowPulses.length * 2, `pulses quicken toward the peak (${lowPulses.length} → ${peakPulses.length} per minute)`);
  assert.ok(spread(gaps(peakPulses)) > 0.2 && spread(gaps(lowPulses)) > 0.2, "the rhythm is irregular (the gaps differ)");
  const heights = [];
  for (const pulse of peakPulses) {
    const index = peak.indexOf(pulse);
    heights.push(Math.max(...peak.slice(index, index + 6).map((sample) => sample.blur)));
  }
  assert.ok(Math.max(...heights) - Math.min(...heights) > settings.blur.strengthPx * 0.3, "pulse heights vary from weak to strong");
  assert.ok(Math.max(...heights) <= settings.blur.strengthPx + 1e-9, "never above the maximum");
  assert.ok(Math.max(...peak.map((sample) => sample.blur)) > Math.max(...low.map((sample) => sample.blur)) * 2,
    "the blur grows with the emission");
  // Sharp: a pulse climbs within its attack, faster than it falls.
  // Spec 180 D5: sharpness sets the attack (0.2 … 0.03 s) and the decay (0.8 … 0.15 s).
  const climbFrames = Math.ceil((0.2 - 0.17 * settings.blur.sharpness) * 60) + 1;
  const fallFrames = Math.floor((0.8 - 0.65 * settings.blur.sharpness) * 60);
  assert.ok(climbFrames < fallFrames, "a pulse rises faster than it falls (a glitch, not a breath)");
  // The vignette's swell: track the clear middle at full strength; closings reach deeper than the openings.
  const radii = peak.map((sample) => sample.radius);
  const extremes = [];
  for (let index = 1; index < radii.length - 1; index += 1) {
    if ((radii[index] < radii[index - 1] && radii[index] <= radii[index + 1]) ||
      (radii[index] > radii[index - 1] && radii[index] >= radii[index + 1])) extremes.push({ index, value: radii[index] });
  }
  const base = settings.vignette.clearRadius[1];
  const closings = extremes.filter((point) => point.value < base).map((point) => base - point.value);
  const openings = extremes.filter((point) => point.value > base).map((point) => point.value - base);
  assert.ok(closings.length >= 5 && openings.length >= 5, `the middle sways in and out (${closings.length} / ${openings.length})`);
  assert.ok(mean(closings) > mean(openings) * 1.5, "each closing reaches deeper than the opening");
  const swellGaps = gaps(extremes.filter((point) => point.value < base).map((point) => ({ t: point.index / 60 })));
  assert.ok(spread(swellGaps) > 0.05, "the swell has no fixed beat (its period wanders)");
  const ramp = run((t) => Math.min(1, t / 60), 60);
  assert.ok(ramp[600].radius > ramp[3500].radius && ramp[600].dark < ramp[3500].dark,
    "with the emission the clear middle narrows and the edges darken");
  assert.ok(Math.abs(peak[peak.length - 1].dark - settings.vignette.maxDarkness) < settings.vignette.maxDarkness * 0.13,
    "the edges reach about maxDarkness and breathe a little with the swell");
  assert.equal(new EmissionScreenEffect().update(16, 1, { ...settings, enabled: false }).visible, false, "switched off: no veil");
  // TK-324.2: each part on its own.
  const vignetteOnly = run(() => 1, 5).at(-1);
  const onlyVignette = new EmissionScreenEffect({ random: randomFx });
  const blurOff = { ...settings, blur: { ...settings.blur, enabled: false } };
  for (let index = 0; index < 120; index += 1) onlyVignette.update(16, 1, blurOff);
  assert.deepEqual([onlyVignette.record.visible, onlyVignette.record.blurPx > 0, onlyVignette.record.darkness > 0],
    [true, false, true], "blur off: darkening only, no blur");
  const onlyBlur = new EmissionScreenEffect({ random: randomFx });
  const vignetteOff = { ...settings, vignette: { ...settings.vignette, enabled: false } };
  let blurSeen = 0;
  for (let index = 0; index < 600; index += 1) blurSeen = Math.max(blurSeen, onlyBlur.update(16, 1, vignetteOff).blurPx);
  assert.deepEqual([onlyBlur.record.visible, onlyBlur.record.darkness, onlyBlur.record.clearRadius, blurSeen > 0],
    [true, 0, 1, true], "vignette off: blur only, no darkening");
  const none = new EmissionScreenEffect().update(16, 1, { ...settings, vignette: { enabled: false }, blur: { enabled: false } });
  assert.equal(none.visible, false, "both off: the veil hides");
  assert.ok(vignetteOnly.visible, "both on by default");

  // Spec 181 D2 (TK-342): the statuses weaken the OUTPUT — the vodka's 0.5 shows exactly half of the darkness, of the
  // clear middle's narrowing and of the blur at every phase (also 0.4 and 0.6, where the input curve made it 20–30 %),
  // and the pulses keep the emission's rhythm; the gas mask's zeros hide the veil.
  const shared = (strength, shares) => {
    let seed = 11;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const fx = new EmissionScreenEffect({ random });
    const out = [];
    for (let frame = 0; frame < 600; frame += 1) {
      const record = fx.update(1000 / 60, strength, settings, ...shares);
      out.push({ dark: record.darkness, open: 1 - record.clearRadius, blur: record.blurPx, visible: record.visible });
    }
    return out;
  };
  const near = (a, b) => Math.abs(a - b) <= 1e-9;
  for (const strength of [0.4, 0.6, 1]) {
    const full = shared(strength, [1, 1, 1]);
    const vodkaRun = shared(strength, [0.5, 0.5, 1]);
    assert.ok(full.every((sample, index) => near(vodkaRun[index].dark, sample.dark * 0.5) &&
      near(vodkaRun[index].open, sample.open * 0.5) && near(vodkaRun[index].blur, sample.blur * 0.5)),
    `strength ${strength}: the vodka shows exactly half the darkness, narrowing and blur, pulse for pulse`);
    assert.ok(full.some((sample) => sample.dark > 0.05) && full.some((sample) => sample.blur > 0.5), "the effect is there to halve");
  }
  const slowRun = shared(1, [1, 1, 0.5]);
  assert.ok(pulses(slowRun.map((sample, index) => ({ t: index / 60, blur: sample.blur }))).length <
    pulses(shared(1, [1, 1, 1]).map((sample, index) => ({ t: index / 60, blur: sample.blur }))).length * 0.75,
  "blurRate below 1 makes the pulses rarer");
  const stillRun = shared(1, [1, 1, 0]);
  assert.ok(stillRun.every((sample) => near(sample.blur, settings.blur.strengthPx * settings.blur.floor)),
    "blurRate 0: no pulse, the floor stays");
  assert.ok(shared(1, [0, 0, 1]).every((sample) => !sample.visible && sample.dark === 0 && sample.blur === 0),
    "the gas mask (0, 0): no veil at all");

  // The DOM veil: placed between the UI content and the portals (DevTools) or above the scene; written only on change.
  const makeElement = (name) => ({ name, parent: null, isConnected: false, style: { props: {}, setProperty(key, value) { this.props[key] = value; } },
    classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); },
      toggle(c, on) { if (on) this.set.add(c); else this.set.delete(c); } },
    setAttribute() {}, remove() { this.isConnected = false; this.parent = null; } });
  const placed = [];
  const portalRoot = { before: (element) => { element.isConnected = true; element.parent = "before-portals"; placed.push("portals"); } };
  const scene = { after: (element) => { element.isConnected = true; element.parent = "after-scene"; placed.push("scene"); } };
  const gameCanvas = { before: (element) => { element.isConnected = true; element.parent = "before-canvas"; } };
  let created = null;
  const documentRef = { createElement: () => (created = makeElement("veil")), querySelector: (selector) => (selector === ".game-shell__scene" ? scene : null) };
  const veil = new EmissionVeilDomRenderer({ documentRef, portalRoot, gameCanvas });
  veil.apply({ visible: false });
  assert.equal(created.isConnected, false, "hidden before an emission: not even in the page");
  const frame = { visible: true, includeHud: true, darkness: 0.5, clearRadius: 0.4, feather: 0.5, blurPx: 4 };
  veil.apply(frame);
  assert.equal(created.parent, "before-portals", "with the HUD: right before the portals, so DevTools stays sharp");
  assert.ok(created.classList.set.has("emission-veil--visible") && created.style.backdropFilter === "blur(4.00px)", "shown and blurred");
  assert.equal(created.style.props["--emission-veil-darkness"], "0.500", "darkness written");
  created.style.backdropFilter = "untouched";
  veil.apply({ ...frame, blurPx: 4.1, darkness: 0.5001 });
  assert.equal(created.style.backdropFilter, "untouched", "changes too small to see are not written");
  veil.apply({ ...frame, darkness: 0 });
  assert.ok(created.classList.set.has("emission-veil--clear"), "TK-324.2: no darkening — the gradient layer is dropped");
  veil.apply(frame);
  assert.ok(!created.classList.set.has("emission-veil--clear"), "and back with the darkening");
  veil.apply({ ...frame, includeHud: false });
  assert.equal(created.parent, "after-scene", "without the HUD: right above the WebGL scene, under the 2D HUD canvas");
  assert.ok(created.classList.set.has("emission-veil--scene"), "with the scene modifier");
  veil.apply({ visible: false });
  assert.ok(!created.classList.set.has("emission-veil--visible") && created.style.backdropFilter === "none",
    "after the emission: hidden, no backdrop filter left");
  assert.deepEqual(placed, ["portals", "scene"], "placed only when its layer changes");

  // TK-324.3: the world alone (includeHud off) is blurred by the WebGL scene; the veil then only darkens, and hides
  // while there is no darkness. sceneBlurPx is the scene's share: the blur with includeHud off, 0 otherwise.
  const sceneFrame = { ...frame, includeHud: false, blurPx: 5 };
  assert.equal(sceneBlurPx(sceneFrame), 5, "includeHud off: the scene blurs the world");
  assert.equal(sceneBlurPx(frame), 0, "includeHud on: the veil blurs, the scene does not");
  assert.equal(sceneBlurPx({ ...sceneFrame, visible: false }), 0, "nothing shown: no scene blur");
  veil.apply(sceneFrame, false);
  assert.ok(created.classList.set.has("emission-veil--visible") && created.style.backdropFilter === "none",
    "the scene blurs: the veil darkens without a backdrop filter");
  assert.equal(created.style.props["--emission-veil-darkness"], "0.500", "the darkness is still the veil's");
  veil.apply({ ...sceneFrame, darkness: 0 }, false);
  assert.ok(!created.classList.set.has("emission-veil--visible"), "no darkness and the scene blurs: no veil layer at all");
  veil.apply(sceneFrame, true);
  assert.equal(created.style.backdropFilter, "blur(5.00px)", "the scene inactive (2D canvas): the veil blurs again");
  veil.apply({ visible: false });
}

// Spec 180 B (TK-326): the look at a strength — values mixed between their ends, the location's override at 100,
// integer counts rounded, caps for the pools; the DEV wave test background replaces the background.
{
  const { WeatherLookResolver } = require("../../../src/game/presentation/weather/weather_look_resolver.js");
  let overrides = null;
  const looks = new WeatherLookResolver({
    getLooks: () => ({ rain: { color: "#ffffff", strength: { maxDrops: [80, 700], lengthPx: [70, 100] } } }),
    getOverrides: () => overrides,
  });
  const half = looks.resolve("rain", 0.5);
  assert.deepEqual([half.color, half.maxDrops, half.lengthPx, half.maxDropsCap], ["#ffffff", 390, 85, 700],
    "plain values as they are, strength values mixed, a cap for the pool");
  assert.equal(looks.resolve("rain", 0.5), half, "one reused object");
  overrides = { rain: { maxDrops: 300 } };
  assert.deepEqual([looks.resolve("rain", 1).maxDrops, looks.resolve("rain", 0).maxDrops, looks.endAt100("rain", "maxDrops")],
    [300, 80, 300], "the location overrides the end at 100 only");
  assert.equal(looks.resolve("rain", 1).maxDropsCap, 300, "the cap follows the override");
  assert.equal(looks.resolve("snow", 1), null, "no look, nothing");
  assert.equal(GAME_CONFIG.weather.storm.rainChanceMult > 1 && GAME_CONFIG.weather.wind.gust.durationSec.length, 2,
    "CONFIG.weather holds the storm's and the wind's general settings");
  assert.equal(MAP_DB.test.weather.storm.rainChanceMult, undefined, "the storm's multipliers left the location");
  assert.equal(MAP_DB.test.weather.wind.weatherBoost, undefined, "the rain's and storm's effect on the wind left the location");

  const { WorldRenderFrameBuilder } = require("../../../src/game/presentation/rendering/world_render_frame_builder.js");
  const { GameRenderFrame } = require("../../../src/game/presentation/rendering/game_render_frame.js");
  const data = { loaded: true, dynamic: true, assetIds: { day: "D", evening: "E", night: "N" }, eveningOpacity: 0,
    nightOpacity: 0, width: 100, height: 50 };
  const config = { canvas: {}, debug: { waveTestBackground: false }, locations: { map: { lake: { waveTestBackground: "W" } } } };
  let loaded = new Set(["D", "E", "N"]);
  const builder = new WorldRenderFrameBuilder({ map: { getBackgroundRenderData: () => data },
    projector: { virtualToScreen: (x, y, out) => { out.x = x; out.y = y; return out; }, getScale: () => 1 },
    config, canvasMetrics: { width: 100 }, locationId: "lake", isAssetReady: (id) => loaded.has(id),
    boatChumBuilder: { buildInto() {} } });
  const layers = () => {
    const frame = new GameRenderFrame();
    builder.buildInto({ target: frame.world, invalidCastMarker: null, debugEnabled: false });
    const out = [];
    for (let index = 0; index < frame.world.backgroundLayers.count; index += 1) out.push(frame.world.backgroundLayers.getAt(index).assetId);
    return { out, ids: frame.world.backgroundAssetIds };
  };
  assert.deepEqual(layers().out, ["D"], "the day background");
  config.debug.waveTestBackground = true;
  assert.deepEqual(layers().out, ["D"], "the test background has not loaded: the location's stays");
  assert.ok(layers().ids.includes("W"), "the scene is asked to upload it");
  loaded.add("W");
  assert.deepEqual(layers().out, ["W"], "loaded: the striped background replaces every layer");
  config.debug.waveTestBackground = false;
  assert.deepEqual(layers().out, ["D"], "off: back to the location's background");
}

// Spec 180 C (TK-327): the emission held at a steady strength; a section with edits not in the code is marked and can be
// reset; the general parts hide with «Параметри локації».
{
  const { EmissionModel } = require("../../../src/game/domain/weather/emission_model.js");
  const emission = new EmissionModel({ rng: new SeededRng(1), getSettings: () => MAP_DB.test.weather });
  emission.update(16);
  emission.holdIntensity(0.4);
  assert.deepEqual([emission.snapshot.phase, emission.snapshot.intensity, emission.snapshot.intensityHeld], ["peak", 0.4, true],
    "a held emission shows its peak at the held strength");
  emission.holdIntensity(null);
  assert.deepEqual([emission.snapshot.phase, emission.snapshot.intensity], ["idle", 0], "released: its own course");
  emission.holdIntensity(0);
  emission.force("peak");
  assert.deepEqual([emission.snapshot.phase, emission.snapshot.intensityHeld], ["peak", false],
    "TK-330: force('peak') releases a zero manual hold and enters peak");

  const { WeatherDevSection } = require("../../../src/dev/tools/weather_dev_section.js");
  const sections = [];
  const buttons = new Map();
  const resets = [];
  const inlineTrees = [];
  const node = () => ({ replaceChildren() {}, appendChild() {} });
  const ui = {
    createInfoRow() {}, createRangeRow() {}, createSelectRow() {}, createInputRow() {}, createSwitcherRow() {},
    addParameter() {}, releaseValueBindings() {}, createButtonGrid: (parent) => parent,
    createButtonRow(label, parent, onClick, navigation, icon, path) {
      const row = { style: {} };
      buttons.set(path ? path.join(".") : label, onClick);
      if (path) resetRows.set(path.join("."), row);
      return row;
    },
    setSectionLabel(content, text) { liveLabels.set(content, text); },
  };
  const resetRows = new Map();
  const liveLabels = new Map();
  const model = { snapshot: { events: {}, strikeSerial: 0, strikeVariant: 0, strikeDistance: 0 }, hold() {}, start() {},
    releaseAll() {}, strike() {} };
  const locations = { test: { weather: JSON.parse(JSON.stringify(MAP_DB.test.weather)) } };
  let changed = new Set(["canvas.rain"]);
  const section = new WeatherDevSection({
    view: { selected: "test" }, // this block reads the location view
    ui, weather: { locationId: "test", getModel: () => model, getWind: () => null },
    config: () => locations.test.weather, locationConfig: (id) => locations[id]?.weather ?? null, locationsMap: () => locations,
    general: () => ({ rain: GAME_CONFIG.canvas.rain, ash: GAME_CONFIG.canvas.ash, water: GAME_CONFIG.canvas.water,
      storm: GAME_CONFIG.weather.storm, wind: GAME_CONFIG.weather.wind, screen: GAME_CONFIG.emission.screen, debug: {} }),
    createSection: (label, parent, path) => { sections.push([label, path?.join(".") ?? ""]); return node(); },
    renderConfigTree: (value, parent, path, options) => { sections.push(["tree", path.join(".")]); inlineTrees.push(options?.inlineSections === true); },
    edits: { hasOverrides: (parts) => changed.has(parts.join(".")), resetTree: (parts) => { resets.push(parts.join(".")); changed.clear(); } },
  });
  section.render(node());
  assert.ok(inlineTrees.length > 0 && inlineTrees.every(Boolean), "TK-327.1: inside a section the trees open in place");
  const label = (path) => sections.filter(([, at]) => at === path).map(([text]) => text).at(-1);
  const trees = () => sections.filter(([kind]) => kind === "tree").map(([, at]) => at);
  assert.ok(!trees().includes("CONFIG.canvas.rain"), "with the location switch on, the general rain look is hidden");
  assert.ok(trees().includes("CONFIG.locations.map.test.weather.rain"), "and the location's rain event shows");
  assert.equal(label("WEATHER.rain"), "ДОЩ", "the location's rain parts are not edited: no mark");
  sections.length = 0;
  // «Загальні»: the general parts alone, the rain marked as changed with a reset.
  section.dispose();
  const parameterPaths = new Set();
  const general = new WeatherDevSection({
    ui: { ...ui, addParameter(parent, options) {
      if (options.path?.join(".") === "WEATHER.location.id") general.choose = options.onCommit;
      if (options.path) parameterPaths.add(options.path.join("."));
    } },
    weather: { locationId: "test", getModel: () => model, getWind: () => null },
    config: () => locations.test.weather, locationConfig: (id) => locations[id]?.weather ?? null, locationsMap: () => locations,
    general: () => ({ rain: GAME_CONFIG.canvas.rain, ash: GAME_CONFIG.canvas.ash, water: GAME_CONFIG.canvas.water,
      storm: GAME_CONFIG.weather.storm, wind: GAME_CONFIG.weather.wind, screen: GAME_CONFIG.emission.screen, debug: {} }),
    createSection: (text, parent, path) => { sections.push([text, path?.join(".") ?? ""]); return node(); },
    renderConfigTree: (value, parent, path) => sections.push(["tree", path.join(".")]),
    edits: { hasOverrides: (parts) => changed.has(parts.join(".")), resetTree: (parts) => { resets.push(parts.join(".")); changed.clear(); } },
  });
  general.render(node());
  sections.length = 0;
  general.choose("Загальні");
  assert.ok(trees().includes("CONFIG.canvas.rain") && trees().includes("CONFIG.weather.storm") && trees().includes("CONFIG.weather.wind"),
    "«Загальні» shows the general rain, storm and wind");
  assert.ok(!trees().some((path) => path.startsWith("CONFIG.locations.map.test.weather")), "and no location part");
  assert.equal(label("WEATHER.rain"), "ДОЩ · змінено", "a section with edits not in the code is marked");
  buttons.get("WEATHER.rain.reset")();
  assert.deepEqual(resets, ["canvas.rain"], "its reset drops that section's overrides");
  assert.equal(label("WEATHER.rain"), "ДОЩ", "then the mark is gone");

  // TK-333 (owner): «Всі» — every section shows its general and its location parts together.
  sections.length = 0;
  general.choose("Всі");
  const all = trees();
  for (const path of ["CONFIG.canvas.rain", "CONFIG.locations.map.test.weather.rain", "CONFIG.weather.storm",
    "CONFIG.locations.map.test.weather.storm", "CONFIG.weather.wind", "CONFIG.locations.map.test.weather.wind",
    "CONFIG.locations.map.test.weather.fog", "CONFIG.emission.screen.vignette", "CONFIG.emission.screen.blur",
    "CONFIG.locations.map.test.weather.emission",
    "CONFIG.canvas.ash", "CONFIG.canvas.water"]) {
    assert.ok(all.includes(path), `«Всі» shows ${path}`);
  }
  assert.ok(sections.some(([, at]) => at === "WEATHER.start"), "«Всі» shows the location's start and thresholds");
  // TK-337 (owner): the radiation is its own section under the emission.
  assert.ok(sections.some(([, at]) => at === "WEATHER.radiation") && sections.some(([, at]) => at === "WEATHER.radiation.config"),
    "«РАДІАЦІЯ» holds the location's radiation");
  assert.ok(!sections.some(([, at]) => at === "WEATHER.emission.radiationConfig"), "and «ВИКИД» no longer does");
  assert.ok(all.includes("CONFIG.locations.map.test.weather.radiation"), "the radiation tree is drawn");
  assert.ok(parameterPaths.has("WEATHER.emission.screenEnabled"), "the emission screen's own switch shows (it had no control)");
  general.dispose();

  // Spec 182 stage E (TK-354): «ЗОРЕПАД» — the night's state, the strength by hand, a starfall night and a bolide now,
  // the look (general) and the night (location) as live trees, over the real StarfallNight.
  {
    const { StarfallNight } = require("../../../src/game/domain/weather/starfall_night.js");
    const starNight = new StarfallNight({ rng: new SeededRng("dev:starfall"), getSettings: () => locations.test.weather.starfall });
    let gameHour = 12;
    const hours = [];
    starNight.update({ hour: gameHour });
    const switches = new Map(), ranges = new Map(), infos = [];
    const starSections = [];
    const starButtons = new Map();
    const starSection = new WeatherDevSection({
      view: { selected: "Всі" },
      ui: { ...ui, createInfoRow: (label, value) => { infos.push([label, value]); return {}; },
        createSwitcherRow: (label, value, parent, onChange, path) => switches.set(path.join("."), { value, onChange }),
        createRangeRow: (label, value, parent, onChange, path) => ranges.set(path.join("."), onChange),
        createButtonGrid: (parent) => parent,
        createButtonRow: (label, parent, onClick, navigation, icon, path) => { starButtons.set(path ? path.join(".") : label, onClick);
          return { style: {} }; } },
      weather: { locationId: "test", getModel: () => model, getWind: () => null, getStarfallModel: () => starNight,
        setGameHour: (hour) => { hours.push(hour); gameHour = hour; starNight.update({ hour }); return true; } },
      config: () => locations.test.weather, locationConfig: (id) => locations[id]?.weather ?? null, locationsMap: () => locations,
      general: () => ({ rain: GAME_CONFIG.canvas.rain, starfall: GAME_CONFIG.canvas.starfall }),
      createSection: (text, parent, path) => { starSections.push([text, path?.join(".") ?? ""]); return node(); },
      renderConfigTree: (value, parent, path) => starSections.push(["tree", path.join(".")]),
      edits: { hasOverrides: () => false, resetTree() {} },
    });
    starSection.render(node());
    const starTrees = starSections.filter(([kind]) => kind === "tree").map(([, at]) => at);
    assert.ok(starSections.some(([text, at]) => text === "ЗОРЕПАД" && at === "WEATHER.starfall"), "«ЗОРЕПАД» is a weather section");
    assert.ok(starTrees.includes("CONFIG.canvas.starfall") && starTrees.includes("CONFIG.locations.map.test.weather.starfall"),
      "the stars' and the bolide's look (general) and the night (location) as live trees");
    assert.ok(infos.some(([label, value]) => label === "ніч" && /поза вікном/u.test(value)), "the night's state is shown (noon: outside the window)");
    // TK-354.1 (owner): the test controls live in «Стан і керування», not in «ЗОРЕПАД».
    assert.ok(!switches.has("WEATHER.starfall.hold") && !starButtons.has("WEATHER.starfall.night") &&
      !starButtons.has("WEATHER.starfall.bolide"), "«ЗОРЕПАД» has no buttons or manual controls any more");
    switches.get("WEATHER.controls.starfall").onChange(true);
    assert.deepEqual([hours.join(), starNight.snapshot.inWindow, starNight.snapshot.held], ["23", true, true],
      "«Зорепад (ніч)» on: the game clock jumps to the night and the starfall is held");
    ranges.get("WEATHER.controls.starfallStrength")(40);
    starNight.update({ hour: 23.1 });
    assert.equal(starNight.snapshot.strength, 0.4, "«Зорепад: сила» sets it");
    switches.get("WEATHER.controls.starfall").onChange(false);
    assert.equal(starNight.snapshot.held, false, "off: the night's own plan again");
    switches.get("WEATHER.controls.starfall").onChange(true);
    assert.equal(hours.length, 1, "already at night: the clock stays");
    const bolidesBefore = starNight.snapshot.bolideSerial;
    starButtons.get("WEATHER.controls.bolide")();
    assert.equal(starNight.snapshot.bolideSerial, bolidesBefore + 1, "«Болід зараз» under the slider drops one");
    starSection.dispose();
  }

  // TK-360 (owner): «Керування» over the real weather, emission and starfall. Cause of «after the starfall goes off the
  // fog comes on»: the switches showed the state of the last redraw; the starfall's test switch jumps the clock to 23:00
  // (the fog's ×3 window), a fog starts by itself, and the next redraw (the starfall off) revealed it. Now: every switch
  // changes only its own element; a state that changes by itself shows at once (refreshLive); a strength slider only
  // while its element is on; «Болід зараз» last, closing the panel on a phone.
  {
    const { WeatherModel: LiveWeather } = require("../../../src/game/domain/weather/weather_model.js");
    const { EmissionModel: LiveEmission } = require("../../../src/game/domain/weather/emission_model.js");
    const { StarfallNight: LiveStarfall } = require("../../../src/game/domain/weather/starfall_night.js");
    const settings360 = JSON.parse(JSON.stringify(MAP_DB.test.weather));
    const weather = new LiveWeather({ rng: new SeededRng("tk360"), getSettings: () => settings360,
      getGeneralSettings: () => GAME_CONFIG.weather });
    const emission = new LiveEmission({ rng: new SeededRng("tk360:emission"), getSettings: () => settings360 });
    const star = new LiveStarfall({ rng: new SeededRng("tk360:starfall"), getSettings: () => settings360.starfall });
    const clock = { hour: 12, timeScale: 240 };
    const tick = (ms) => {
      weather.update(ms, clock, null);
      emission.update(ms);
      star.update(clock, emission.snapshot.phase !== "idle");
    };
    tick(16);
    let controlsNode = null, rows = [], renders = 0, closed = 0;
    const titles = [], switches360 = new Map(), ranges360 = new Map(), buttons360 = new Map();
    const inControls = (parent, at) => { if (parent === controlsNode) rows.push(at); };
    const section360 = new WeatherDevSection({
      view: { selected: "test" },
      ui: {
        createInfoRow() {}, releaseValueBindings() {}, setSectionLabel() {},
        createSelectRow(label, choices, value, parent, onChange, path) { inControls(parent, path.join(".")); },
        createInputRow(label, value, parent) { inControls(parent, `input:${label}`); },
        addParameter(parent, { path }) { if (path) inControls(parent, path.join(".")); },
        createSwitcherRow(label, value, parent, onChange, path) {
          switches360.set(path.join("."), { value, onChange });
          inControls(parent, path.join("."));
        },
        createRangeRow(label, value, parent, onChange, path) {
          ranges360.set(path.join("."), onChange);
          inControls(parent, path.join("."));
        },
        createButtonGrid: (parent) => parent,
        createButtonRow(label, parent, onClick, navigation, icon, path) {
          const at = path ? path.join(".") : label;
          buttons360.set(at, onClick);
          inControls(parent, at);
          return { style: {} };
        },
      },
      weather: { locationId: "test", getModel: () => weather, getWind: () => null, getEmissionModel: () => emission,
        getStarfallModel: () => star, setGameHour: (next) => { clock.hour = next; star.update(clock); return true; } },
      config: () => settings360, locationConfig: () => settings360, locationsMap: () => ({ test: { weather: settings360 } }),
      general: () => ({ rain: GAME_CONFIG.canvas.rain, ash: GAME_CONFIG.canvas.ash }),
      createSection: (label, parent, path) => {
        const content = { replaceChildren() {}, appendChild() {} };
        if (path?.join(".") === "WEATHER.controls") {
          controlsNode = content;
          titles.push(label);
          rows = [];
          renders += 1;
          switches360.clear();
          ranges360.clear();
        }
        return content;
      },
      renderConfigTree() {},
      closeOnPhone: () => { closed += 1; },
    });
    section360.render({ replaceChildren() {}, appendChild() {} });
    assert.equal(titles.at(-1), "Керування", "the section is «Керування» (was «Стан і керування»)");
    const KINDS360 = ["rain", "storm", "fog", "emission", "starfall"];
    const live = () => {
      const events = weather.snapshot.events;
      const on = KINDS360.filter((kind) => kind === "emission" ? emission.snapshot.phase !== "idle"
        : kind === "starfall" ? star.snapshot.held : events[kind].active || events[kind].held);
      return on.join();
    };
    const shown = () => KINDS360.filter((kind) => switches360.get(`WEATHER.controls.${kind}`)?.value === true).join();
    const sliders = () => KINDS360.filter((kind) => ranges360.has(`WEATHER.controls.${kind}Strength`)).join();
    assert.deepEqual([live(), shown(), sliders()], ["", "", ""], "noon, nothing on: no switch on and no strength slider");
    assert.ok(!rows.includes("WEATHER.controls.rainAt100"), "the rain's «at 100» group waits for the rain too");
    const flip = (kind, on) => {
      switches360.get(`WEATHER.controls.${kind}`).onChange(on);
      tick(16);
      section360.refreshLive();
    };
    // Every switch alone and every pair: a switch turns its own element on or off and nothing else.
    for (const first of KINDS360) {
      flip(first, true);
      assert.deepEqual([live(), shown(), sliders()], [first, first, first], `«${first}» on: only it is on, with its slider`);
      for (const second of KINDS360) {
        if (second === first) continue;
        const both = KINDS360.filter((kind) => kind === first || kind === second).join();
        flip(second, true);
        assert.deepEqual([live(), shown()], [both, both], `«${second}» on beside «${first}»: both on`);
        flip(second, false);
        assert.deepEqual([live(), shown(), sliders()], [first, first, first], `«${second}» off: «${first}» alone stays on`);
      }
      flip(first, false);
      assert.deepEqual([live(), shown(), sliders()], ["", "", ""], `«${first}» off: nothing else came on`);
    }
    assert.equal(clock.hour, 23, "the starfall's test switch moved the clock into the night (the fog's ×3 window)");
    // A fog that starts by itself shows on its switch at once; an unchanged state never redraws.
    const before = renders;
    section360.refreshLive();
    assert.equal(renders, before, "refreshLive with nothing changed draws nothing");
    let seconds360 = 0;
    while (!weather.snapshot.events.fog.active && seconds360 < 3600) {
      tick(1000);
      seconds360 += 1;
    }
    assert.ok(weather.snapshot.events.fog.active, "at 23:00 a fog starts by itself (seeded)");
    section360.refreshLive();
    assert.ok(switches360.get("WEATHER.controls.fog").value === true && ranges360.has("WEATHER.controls.fogStrength"),
      "the fog's switch shows it at once, with its slider — no other control had to redraw the section");
    const redrawn = renders;
    section360.refreshLive();
    assert.equal(renders, redrawn, "and only once");
    // «Болід зараз» is the last row; it drops a bolide and closes the panel on a phone.
    assert.equal(rows.at(-1), "WEATHER.controls.bolide", "«Болід зараз» is the section's last row");
    const bolides = star.snapshot.bolideSerial;
    buttons360.get("WEATHER.controls.bolide")();
    assert.deepEqual([star.snapshot.bolideSerial, closed], [bolides + 1, 1], "a bolide falls and the panel closes on a phone");
    section360.dispose();
  }

  // TK-333.2 (owner): «Всі» by default; the choice outlives the section (the panel draws a new one when it opens again).
  const view = {};
  const sectionWith = () => new WeatherDevSection({
    view, ui: { ...ui, addParameter(parent, options) { if (options.path?.join(".") === "WEATHER.location.id") sectionWith.last = options; } },
    weather: { locationId: "test", getModel: () => model, getWind: () => null },
    config: () => locations.test.weather, locationConfig: (id) => locations[id]?.weather ?? null, locationsMap: () => locations,
    general: () => ({ rain: GAME_CONFIG.canvas.rain }), createSection: () => node(), renderConfigTree() {} });
  const first = sectionWith();
  first.render(node());
  assert.equal(sectionWith.last.value, "Всі", "a fresh panel shows «Всі»");
  sectionWith.last.onCommit("Загальні");
  first.dispose();
  const reopened = sectionWith();
  reopened.render(node());
  assert.equal(sectionWith.last.value, "Загальні", "closing and opening the panel keeps the choice");
  reopened.dispose();

  // TK-333 (agent, browser): an edit marks its section «· змінено» and shows the reset at once — before, the mark waited
  // for the next redraw (a selector press), while the edited group stayed open.
  let onConfigUpdated = null;
  const previousDocument = globalThis.document;
  globalThis.document = { addEventListener: (type, handler) => { if (type === "config-updated") onConfigUpdated = handler; },
    removeEventListener() {} };
  try {
    changed = new Set();
    const contents = new Map();
    const live = new WeatherDevSection({
      ui, weather: { locationId: "test", getModel: () => model, getWind: () => null },
      config: () => locations.test.weather, locationConfig: (id) => locations[id]?.weather ?? null, locationsMap: () => locations,
      general: () => ({ rain: GAME_CONFIG.canvas.rain, ash: GAME_CONFIG.canvas.ash, water: GAME_CONFIG.canvas.water,
        storm: GAME_CONFIG.weather.storm, wind: GAME_CONFIG.weather.wind, screen: GAME_CONFIG.emission.screen, debug: {} }),
      createSection: (text, parent, path) => { const content = node(); contents.set(path?.join("."), content); return content; },
      renderConfigTree() {},
      edits: { hasOverrides: (parts) => changed.has(parts.join(".")), resetTree() {} },
    });
    live.render(node());
    const stormContent = contents.get("WEATHER.storm");
    assert.equal(resetRows.get("WEATHER.storm.reset").style.display, "none", "no edits: the section's reset is hidden");
    changed.add("locations.map.test.weather.storm");
    onConfigUpdated({ detail: { path: ["CONFIG", "locations", "map", "test", "weather", "storm", "chancePerCheck"] } });
    assert.equal(liveLabels.get(stormContent), "ШТОРМ · змінено", "the edit marks its section in place");
    assert.equal(resetRows.get("WEATHER.storm.reset").style.display, "", "and shows the section's reset");
    changed.clear();
    onConfigUpdated({ detail: { path: ["CONFIG", "locations", "map", "test", "weather", "storm", "chancePerCheck"] } });
    assert.equal(liveLabels.get(stormContent), "ШТОРМ", "reset to the code: the mark goes");
    assert.equal(resetRows.get("WEATHER.storm.reset").style.display, "none");
    live.dispose();
  } finally {
    globalThis.document = previousDocument;
  }
}

// Spec 180 stage F (TK-335): the RANDOMIZER's weather probes run the game's own models on the live settings.
{
  const { WeatherModel: Weather } = require("../../../src/game/domain/weather/weather_model.js");
  const { WindModel: Wind } = require("../../../src/game/domain/weather/wind_model.js");
  const { timePhaseAt } = require("../../../src/game/domain/time/time_phase.js");
  const { WeatherEventRandomProbe } = require("../../../src/dev/randomizer/weather_event_random_probe.js");
  const { WindGustRandomProbe } = require("../../../src/dev/randomizer/wind_gust_random_probe.js");
  const phases = GAME_CONFIG.spawns.timePhases;
  assert.equal(timePhaseAt(2, phases), "night", "a range that passes midnight holds 2 o'clock");
  assert.equal(timePhaseAt(23, phases), "night");
  assert.equal(timePhaseAt(4, phases), "morning");
  assert.equal(timePhaseAt(12, phases), "day");
  let settings = JSON.parse(JSON.stringify(MAP_DB.test.weather));
  const time = { timeScale: 240, initialHours: 0, phaseAt: (hour) => timePhaseAt(hour, phases) };
  const probe = (kind, getTime = () => time) => new WeatherEventRandomProbe({ kind, createModel: (options) => new Weather(options),
    createRng: (seed) => new SeededRng(seed), getSettings: () => settings, getGeneral: () => GAME_CONFIG.weather, getTime });
  const row = (report, label) => report.rows.find(([name]) => name === label)?.[1];
  const share = (text) => Number.parseFloat(text) / 100;
  const storm = probe("storm").run({ count: 60, seed: 7 });
  assert.equal(JSON.stringify(storm), JSON.stringify(probe("storm").run({ count: 60, seed: 7 })), "a seed repeats the run");
  assert.ok(row(storm, "змодельовано").startsWith("60 з 60"), "the storm probe collects its events");
  assert.ok(row(storm, "з блискавками") && storm.histogram.length === 13, "storms report lightning and a histogram");
  const rain = probe("rain").run({ count: 300, seed: 7 });
  assert.ok(share(row(rain, "дощить у шторм")) > share(row(rain, "дощить без шторму")),
    "the storm raises the rain's chance (it rains more often in a storm)");
  // Fog only in its phases of the day: never in an endless day.
  // TK-336: fog in game time, mostly in its hour windows.
  const fog = probe("fog").run({ count: 200, seed: 3 });
  assert.ok(row(fog, "змодельовано").startsWith("200 з 200"), "the fog probe collects its events");
  assert.ok(share(row(fog, "почався у вікні годин")) > 0.4, "most fogs start in the hour windows (×4, ×3 there)");
  // The live settings (DevTools edits) are read; the initial weather is left out.
  settings.initial = { rain: 1 };
  settings.rain.chancePerCheck = 0;
  settings.rain.chanceGrowthPerCheck = 0;
  const none = probe("rain").run({ count: 5, seed: 1 });
  assert.equal(row(none, "результат"), "жодної події", "no chance, no rain — and the initial rain is not counted");
  settings = JSON.parse(JSON.stringify(MAP_DB.test.weather));
  const gusts = new WindGustRandomProbe({ createWeather: (options) => new Weather(options), createWind: (options) => new Wind(options),
    createRng: (seed) => new SeededRng(seed), getSettings: () => settings, getGeneral: () => GAME_CONFIG.weather })
    .run({ count: 400, seed: 7 });
  assert.ok(row(gusts, "змодельовано").startsWith("400 з 400"), "the gust probe collects gusts");
  assert.ok(Number.parseFloat(row(gusts, "у шторм")) > Number.parseFloat(row(gusts, "у ясну погоду")),
    "gusts come more often in a storm than in clear weather");
}

// Spec 179 stage D, TK-339: the Geiger counter's clicks — random gaps, a rate by the radiation above the threshold.
{
  const { GeigerClickPlanner } = require("../../../src/game/presentation/weather/geiger_click_planner.js");
  const settings = { ...GAME_CONFIG.ui.audio.geiger };
  const rng = new SeededRng("check:geiger");
  const planner = new GeigerClickPlanner({ rng: () => rng.next() });
  assert.equal(planner.rate(0, settings), 0, "no radiation: silence");
  assert.equal(planner.rate(settings.fromRadiation, settings), 0, "at the threshold: silence");
  assert.equal(planner.rate(1, { ...settings, enabled: false }), 0, "switched off: silence");
  assert.equal(planner.rate(1, settings), settings.clicksPerSec[1], "radiation 1: the top rate");
  const mid = planner.rate((1 + settings.fromRadiation) / 2, settings);
  assert.ok(mid > settings.clicksPerSec[0] && mid < (settings.clicksPerSec[0] + settings.clicksPerSec[1]) / 2,
    "between them the rate grows with the square (sparse ticks, then a crackle)");
  // Many short windows: the count follows the rate, the times stay inside each window and ascend.
  let total = 0;
  for (let window = 0; window < 2000; window += 1) {
    const count = planner.plan(0.2, 1, settings);
    for (let index = 0; index < count; index += 1) {
      const at = planner.times[index];
      assert.ok(at >= 0 && at < 0.2 && (index === 0 || at >= planner.times[index - 1]), "a click inside its window, in order");
    }
    total += count;
  }
  const expected = settings.clicksPerSec[1] * 0.2 * 2000;
  assert.ok(Math.abs(total - expected) < expected * 0.05, `the count follows the rate (${total} of ~${expected})`);
  assert.equal(planner.plan(0.2, 0, settings), 0, "the radiation gone: no clicks");
  const again = (seed) => { const r = new SeededRng(seed); const p = new GeigerClickPlanner({ rng: () => r.next() });
    return Array.from(p.times.slice(0, p.plan(1, 0.8, settings))).join(); };
  assert.equal(again(3), again(3), "a seed repeats the clicks");
}

// Spec 182 stage B (TK-351): the starfall's night — one check as the clock enters 21:00, a timeline of periods of
// random strength (zero too) with cosine transitions, strength only inside 21–5, at most one bolide a night (its chance
// rolled once after a successful check), nothing during an emission, the same plan from the same seed.
{
  const { StarfallNight } = require("../../../src/game/domain/weather/starfall_night.js");
  const base = MAP_DB.test.weather.starfall;
  assert.equal(JSON.stringify([base.enabled, base.fromHour, base.toHour]), JSON.stringify([true, 21, 5]), "owner Q1: 21:00–5:00");
  const STEP = 1 / 60; // one game minute
  // Runs `days` game days from noon, a game minute a step; returns per night: its samples, bolides, the plan.
  const run = (settings, days, seed = "check:starfall", blockedAt = () => false) => {
    const night = new StarfallNight({ rng: new SeededRng(seed), getSettings: () => settings });
    const clock = { hour: 12 };
    const nights = [];
    let current = null;
    let outsideMax = 0;
    for (let step = 0; step < days * 24 * 60; step += 1) {
      clock.hour = (12 + step * STEP) % 24;
      const bolides = night.snapshot.bolideSerial;
      night.update(clock, blockedAt(clock.hour));
      const snapshot = night.snapshot;
      if (snapshot.inWindow && (!current || current.serial !== snapshot.nightSerial)) {
        current = { serial: snapshot.nightSerial, active: snapshot.active, levels: [...snapshot.periodLevels],
          count: snapshot.periodCount, samples: [], bolides: 0, bolideAt: snapshot.bolideAtHours };
        nights.push(current);
      }
      if (snapshot.inWindow) current.samples.push(snapshot.strength);
      else outsideMax = Math.max(outsideMax, snapshot.strength);
      if (current && snapshot.bolideSerial !== bolides) current.bolides += 1;
    }
    return { nights, outsideMax, model: night };
  };
  const always = { ...base, nightChance: 1, bolideChance: 1 };
  const { nights: sure, outsideMax } = run(always, 6);
  assert.equal(sure.length, 6, "one check a night, as the clock enters 21:00");
  assert.equal(outsideMax, 0, "no starfall outside 21:00–5:00");
  for (const night of sure) {
    assert.ok(night.active && night.count >= base.periods[0] && night.count <= base.periods[1],
      `a starfall night has ${base.periods[0]}–${base.periods[1]} periods (${night.count})`);
    assert.ok(night.samples[0] < 0.05 && night.samples.at(-1) < 0.05, "it rises from 0 at 21:00 and returns to 0 by 5:00");
    const jumps = night.samples.slice(1).map((value, index) => Math.abs(value - night.samples[index]));
    assert.ok(Math.max(...jumps) < 0.12, `smooth transitions, no jumps (${Math.max(...jumps).toFixed(3)} a game minute)`);
    assert.ok(Math.max(...night.samples) <= base.maxStrength + 1e-9, "never above maxStrength");
    assert.equal(night.bolides, 1, "bolideChance 1: exactly one bolide a night");
  }
  // Q4: the strength rises and falls several times a night, not evenly: count the turns of its course.
  const turns = (samples) => {
    let count = 0, direction = 0;
    for (let index = 1; index < samples.length; index += 1) {
      const delta = samples[index] - samples[index - 1];
      if (Math.abs(delta) < 1e-6) continue;
      const next = Math.sign(delta);
      if (direction !== 0 && next !== direction) count += 1;
      direction = next;
    }
    return count;
  };
  const many = run({ ...base, nightChance: 1 }, 40).nights;
  assert.ok(many.some((night) => turns(night.samples) >= 3), "a night rises and falls several times");
  assert.ok(many.some((night) => night.levels.includes(0)), "a quiet (zero) period happens");
  assert.ok(new Set(many.map((night) => night.levels.map((level) => level.toFixed(3)).join())).size === many.length,
    "every night has its own plan");
  // The night's chance: about nightChance of the nights; the bolide is rare and at most one.
  const chance = run(base, 400).nights;
  const share = chance.filter((night) => night.active).length / chance.length;
  assert.ok(Math.abs(share - base.nightChance) < 0.08, `about ${base.nightChance} of the nights (${share.toFixed(2)})`);
  assert.ok(chance.every((night) => night.bolides <= 1 && (night.active || night.bolides === 0)),
    "at most one bolide, only on a starfall night");
  assert.ok(chance.every((night) => !night.active ? night.samples.every((value) => value === 0) : true), "no starfall: 0 all night");
  assert.equal(run({ ...base, nightChance: 1, bolideChance: 0 }, 5).nights.reduce((sum, night) => sum + night.bolides, 0), 0,
    "bolideChance 0: no bolide");
  // Q3: no starfall during an emission (the timeline goes on), its bolide skipped.
  const blocked = run(always, 2, "check:starfall", (hour) => hour >= 21 || hour < 5).nights;
  assert.ok(blocked.every((night) => night.samples.every((value) => value === 0) && night.bolides === 0),
    "an emission all night: no stars, no bolide");
  // The same seed — the same nights.
  const plan = (seed) => run(always, 3, seed).nights.map((night) => night.levels.join("/") + "@" + night.bolideAt).join("|");
  assert.equal(plan("a"), plan("a"), "a seed repeats the nights");
  assert.notEqual(plan("a"), plan("b"), "another seed, other nights");
  // A session that starts at night has its own check; DEV hold and a bolide now.
  const late = new StarfallNight({ rng: new SeededRng(1), getSettings: () => always });
  late.update({ hour: 23 });
  assert.equal([late.snapshot.inWindow, late.snapshot.active, late.snapshot.nightSerial].join(), "true,true,1",
    "starting at 23:00 checks this night");
  late.hold(0.7);
  late.update({ hour: 23.5 });
  assert.equal(late.snapshot.strength, 0.7, "DEV hold pins the strength");
  late.hold(null);
  const serial = late.snapshot.bolideSerial;
  late.bolideNow();
  assert.equal(late.snapshot.bolideSerial, serial + 1, "DEV: a bolide now");
  // The environment carries the night and blocks it during an emission.
  const emission = { snapshot: { phase: "peak", intensity: 1, radiation: 0 }, update() {} };
  const starEnv = new EnvironmentSystem({ environment: {} }, 23, new SeededRng(4), { timePhases: {} }, null, null, null,
    emission, new StarfallNight({ rng: new SeededRng(4), getSettings: () => ({ ...always, quietChance: 0 }) }));
  starEnv.update(16, 1);
  assert.equal(starEnv.getSnapshot().starfall.active, true, "the environment's snapshot carries the night");
  assert.equal(starEnv.getSnapshot().starfall.strength, 0, "an emission on: no starfall");
  // DevTools «РАНДОМАЙЗЕР»: the starfall's nights through the real model on the location's settings.
  const { StarfallRandomProbe } = require("../../../src/dev/randomizer/starfall_random_probe.js");
  const starProbe = new StarfallRandomProbe({ createModel: (options) => new StarfallNight(options),
    createRng: (seed) => new SeededRng(seed), getSettings: () => MAP_DB.test.weather });
  const report = starProbe.run({ count: 300, seed: 9 });
  const row = (label) => report.rows.find(([name]) => name === label)?.[1] ?? "";
  assert.ok(row("змодельовано").startsWith("300 ночей"), "the probe runs the asked nights");
  const nightShare = Number(row("зорепадних ночей").match(/\(([\d.]+)%\)/u)?.[1]) / 100;
  assert.ok(Math.abs(nightShare - base.nightChance) < 0.08, `the probe's share follows nightChance (${nightShare})`);
  assert.equal(report.histogram.length, 8, "the histogram: the night's 8 hours (21:00 … 4:00)");
  assert.equal(report.histogram[0][0], "21:00");
  assert.equal(JSON.stringify(starProbe.run({ count: 50, seed: 3 })), JSON.stringify(starProbe.run({ count: 50, seed: 3 })),
    "a seed repeats the report");
}

{
  // Spec 179 stage G (TK-369): DevTools «РАНДОМАЙЗЕР» → «Кльов: радіація» — the bite's own weight and anomaly at radiation
  // 0 / 50 / 100 % on the real fish: at full radiation more unique fish (unique 4 — about ×5) and a heavier mean.
  const { BiteRadiationRandomProbe } = require("../../../src/dev/randomizer/bite_radiation_random_probe.js");
  const { FISH_DB } = require("../../../src/game/config/databases/fish_database.js");
  const { FishWeightSampler } = require("../../../src/game/domain/fish/fish_weight_sampler.js");
  const { FishAnomalyVariantResolver } = require("../../../src/game/domain/fish/fish_anomaly_variant_resolver.js");
  const { FishRadiationBiteModifier } = require("../../../src/game/domain/fish/fish_radiation_bite_modifier.js");
  const { SeededRng } = require("../../../src/engine/random/seeded_rng.js");
  const probe = new BiteRadiationRandomProbe({ getFishes: () => FISH_DB, getLocationId: () => "test",
    createRng: (seed) => new SeededRng(seed), weightSampler: new FishWeightSampler(),
    anomalyResolver: new FishAnomalyVariantResolver(), radiation: new FishRadiationBiteModifier() });
  const report = probe.run({ count: 20000, seed: 11 });
  for (const fish of FISH_DB) {
    const read = (radiation) => {
      const text = report.rows.find(([name]) => name === `${fish.name} · радіація ${radiation}%`)?.[1] ?? "";
      return { unique: Number(text.match(/унікальних ([\d.]+)%/u)?.[1]) / 100, weight: Number(text.match(/вага ([\d.]+) кг/u)?.[1]) };
    };
    const calm = read(0), peak = read(100), half = read(50);
    const chance = fish.anomalyVariant.chance;
    assert.ok(Math.abs(calm.unique - chance) < chance * 0.5, `${fish.id}: radiation 0 — the species' anomaly chance (${calm.unique})`);
    assert.ok(Math.abs(peak.unique - chance * (1 + fish.radiationMultipliers.unique)) < chance * 1.5,
      `${fish.id}: full radiation — anomaly × (1 + unique) (${peak.unique})`);
    assert.ok(calm.weight < half.weight && half.weight < peak.weight, `${fish.id}: the mean weight grows with radiation`);
  }
  assert.equal(report.histogram.length, FISH_DB.reduce((sum, fish) => sum + fish.weightConfig.maxLevel, 0),
    "the histogram: every species' levels at full radiation");
  assert.equal(JSON.stringify(probe.run({ count: 100, seed: 3 })), JSON.stringify(probe.run({ count: 100, seed: 3 })),
    "a seed repeats the report");
}

console.log(
  "weather: independent events and timelines, per-process holds, storm and rain, lightning, fog, derived fields, held wind, the sea state, the live reading, the emission and the starfall's night OK",
);
