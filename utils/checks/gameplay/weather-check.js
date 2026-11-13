"use strict";
// Spec 172 stage A (TK-261): the weather model's states, fades, storm, lightning and fog, and the fields the bite
// chances, the radio and the wind read from EnvironmentSystem. Fixed seeds, explicit time steps.
const assert = require("node:assert/strict");
const { WeatherModel } = require("../../../src/game/domain/weather/weather_model.js");
const { EnvironmentSystem } = require("../../../src/game/application/world/environment_system.js");
const { SeededRng } = require("../../../src/engine/random/seeded_rng.js");
const { MAP_DB } = require("../../../src/game/config/databases/location_catalog.js");

const settings = () => ({
  precipitation: {
    clear: { weight: 0.7, durationSec: [180, 900] },
    rain: { weight: 0.25, durationSec: [60, 600], intensity: [0.3, 0.8] },
    storm: { weight: 0.05, durationSec: [60, 240], intensity: [0.6, 1.0] },
    fadeInSec: 20,
    fadeOutSec: 30,
  },
  fog: { chance: 1, phases: ["morning", "night"], idleSec: [10, 10], durationSec: [100, 100], intensity: [0.5, 0.5],
    fadeInSec: 10, fadeOutSec: 10 },
  lightning: { intervalSec: [25, 6], distance: [0.2, 1.0] },
  thresholds: { rain: 0.15, fog: 0.3 },
});
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} ≠ ${expected}`);
const step = (model, seconds, phase = "day", dt = 0.1) => {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) model.update(dt * 1000, phase);
};

// 1. The location's real settings drive a model: states only from the precipitation table, always in range.
{
  const model = new WeatherModel({ rng: new SeededRng("check:weather"), getSettings: () => MAP_DB.test.weather });
  const seen = new Set();
  for (let index = 0; index < 100000; index += 1) {
    model.update(1000, "day");
    const weather = model.snapshot;
    seen.add(weather.precipitation);
    for (const key of ["rain", "storm", "fog", "cloud"]) assert.ok(weather[key] >= 0 && weather[key] <= 1, `${key} in 0…1`);
  }
  assert.deepEqual([...seen].sort(), ["clear", "rain", "storm"], "a long run visits clear, rain and storm");
}

// 2. Determinism: the same seed gives the same weather.
{
  const run = () => {
    const model = new WeatherModel({ rng: new SeededRng(42), getSettings: settings });
    const trace = [];
    for (let index = 0; index < 3000; index += 1) {
      model.update(500, index % 1000 < 500 ? "night" : "day");
      if (index % 50 === 0) trace.push(`${model.snapshot.precipitation}:${model.snapshot.rain.toFixed(6)}:${model.snapshot.fog.toFixed(6)}`);
    }
    return trace.join("|");
  };
  assert.equal(run(), run(), "the weather is deterministic for a seed");
}

// 3. Transitions: a storm only follows rain and only returns to rain; durations are real seconds within their ranges.
{
  const config = settings();
  config.precipitation.storm.weight = 5;
  const model = new WeatherModel({ rng: new SeededRng(7), getSettings: () => config });
  // An episode may repeat its state (clear → clear with a new duration); each episode is measured on its own.
  let previous = null, episode = 0, enteredAt = 0, time = 0, transitions = 0;
  for (let index = 0; index < 200000 && transitions < 300; index += 1) {
    model.update(1000, "day");
    time += 1;
    const state = model.snapshot.precipitation;
    if (model.snapshot.episode !== episode) {
      if (previous !== null) {
        transitions += 1;
        if (state === "storm") assert.equal(previous, "rain", "a storm only follows rain");
        if (previous === "storm") assert.equal(state, "rain", "a storm returns to rain");
        const lasted = time - enteredAt;
        const [min, max] = config.precipitation[previous].durationSec;
        assert.ok(lasted >= min && lasted <= max + 1, `${previous} lasted ${lasted} s, expected ${min}…${max}`);
      }
      episode = model.snapshot.episode;
      enteredAt = time;
    }
    previous = state;
  }
  assert.ok(transitions >= 300, "enough transitions observed");
}

// 4. Fades: a full rise takes fadeInSec, a full fall fadeOutSec; a forced fade overrides both until the next state.
{
  const model = new WeatherModel({ rng: new SeededRng(3), getSettings: settings });
  model.setFrozen(true);
  model.force("precipitation", "rain", { intensity: 0.8 });
  step(model, 8);
  near(model.snapshot.rain, 0.4, "rain rises by 1/20 per second");
  step(model, 20);
  near(model.snapshot.rain, 0.8, "rain stops at its target");
  model.force("precipitation", "clear");
  step(model, 15);
  near(model.snapshot.rain, 0.3, "rain falls by 1/30 per second");
  model.force("precipitation", "rain", { intensity: 1, fadeSec: 2 });
  step(model, 1);
  near(model.snapshot.rain, 0.8, "a forced 2 s fade rises by 0.5 per second");
  model.force("precipitation", "storm", { intensity: 0.9, fadeSec: 0 });
  near(model.snapshot.storm, 0.9, "a zero fade applies at once");
  assert.ok(model.snapshot.rain >= 0.9, "a storm rains at least as hard as its intensity");
  const before = model.snapshot.precipitationLeftSec;
  step(model, 30);
  assert.equal(model.snapshot.precipitation, "storm", "frozen weather keeps its state");
  near(model.snapshot.precipitationLeftSec, before, "frozen weather keeps its timer");
}

// 5. Lightning: none without a storm; strikes at the storm's interval (±50%), variants 0…3, distances in range.
{
  const model = new WeatherModel({ rng: new SeededRng(11), getSettings: settings });
  model.setFrozen(true);
  model.force("precipitation", "rain", { intensity: 1, fadeSec: 0 });
  step(model, 120);
  assert.equal(model.snapshot.strikeSerial, 0, "rain without a storm has no lightning");
  model.force("precipitation", "storm", { intensity: 1, fadeSec: 0 });
  const strikes = [];
  let last = model.snapshot.strikeSerial, time = 0;
  for (let index = 0; index < 6000; index += 1) {
    model.update(100, "day");
    time += 0.1;
    if (model.snapshot.strikeSerial !== last) {
      last = model.snapshot.strikeSerial;
      strikes.push(time);
      assert.ok([0, 1, 2, 3].includes(model.snapshot.strikeVariant), "variant 0…3");
      assert.ok(model.snapshot.strikeDistance >= 0.2 && model.snapshot.strikeDistance <= 1, "distance in range");
    }
  }
  assert.ok(strikes.length >= 600 / 9 && strikes.length <= 600 / 3 + 1, `a full storm strikes every 3…9 s (${strikes.length} in 600 s)`);
  for (let index = 1; index < strikes.length; index += 1) {
    const gap = strikes[index] - strikes[index - 1];
    assert.ok(gap >= 3 - 0.11 && gap <= 9 + 0.11, `strike gap ${gap.toFixed(2)} s`);
  }
  const serial = model.snapshot.strikeSerial;
  model.strike();
  assert.equal(model.snapshot.strikeSerial, serial + 1, "a strike on demand");
}

// 6. Fog: only in its phases; leaving them ends the fog, which fades out.
{
  const model = new WeatherModel({ rng: new SeededRng(5), getSettings: settings });
  step(model, 60, "day");
  assert.equal(model.snapshot.fogState, "none", "no fog outside its phases");
  step(model, 15, "night");
  assert.equal(model.snapshot.fogState, "fog", "fog starts in an allowed phase");
  near(model.snapshot.fog, 0.5, "fog reaches its intensity");
  step(model, 0.1, "day", 0.1);
  assert.equal(model.snapshot.fogState, "none", "leaving the phase ends the fog");
  step(model, 2.5, "day");
  assert.ok(model.snapshot.fog > 0.2 && model.snapshot.fog < 0.3, "the fog fades out instead of vanishing");
}

// 7. EnvironmentSystem: thresholds and the continuous rain multiplier; the snapshot object is reused.
{
  const location = { weather: settings(), environment: { wind: { rainMultiplier: 2.5 } } };
  const rng = new SeededRng(9);
  const weather = new WeatherModel({ rng, getSettings: () => location.weather });
  const environment = new EnvironmentSystem(location, 12, rng, { timePhases: { day: { startHour: 0, endHour: 24 } } }, null, weather);
  const snapshot = environment.getSnapshot();
  weather.setFrozen(true);
  weather.force("precipitation", "rain", { intensity: 0.1, fadeSec: 0 });
  environment.update(16, 1);
  assert.equal(snapshot.isRaining, false, "light drizzle below the threshold does not count as rain");
  near(snapshot.wind.rainMult, 1.15, "rainMult follows the intensity");
  weather.force("precipitation", "rain", { intensity: 1, fadeSec: 0 });
  environment.update(16, 1);
  assert.equal(snapshot.isRaining, true, "rain above the threshold");
  near(snapshot.wind.rainMult, 2.5, "full rain gives the configured multiplier");
  weather.force("fog", "fog", { intensity: 0.4, fadeSec: 0 });
  environment.update(16, 1);
  assert.equal(snapshot.isFoggy, true, "fog above the threshold");
  assert.equal(environment.getSnapshot(), snapshot, "one snapshot object");
  assert.equal(snapshot.weather, weather.snapshot, "the weather's own snapshot is shared, not copied");
  weather.force("precipitation", "clear", { fadeSec: 0 });
  environment.update(16, 1);
  assert.equal(snapshot.isRaining, false);
  assert.equal(snapshot.wind.rainMult, 1, "no rain, no multiplier");
}

// 8. Without a weather model the weather stays clear.
{
  const environment = new EnvironmentSystem({ environment: {} }, 12, new SeededRng(1), { timePhases: {} });
  for (let index = 0; index < 100; index += 1) environment.update(1000, 240);
  const snapshot = environment.getSnapshot();
  assert.equal(snapshot.isRaining, false);
  assert.equal(snapshot.isFoggy, false);
  assert.equal(snapshot.weather.precipitation, "clear");
}

// 9. TK-271: live strength without restarting the state, and the wind held by hand.
{
  const model = new WeatherModel({ rng: new SeededRng(13), getSettings: settings });
  model.setFrozen(true);
  model.force("precipitation", "rain", { intensity: 0.5, fadeSec: 0, durationSec: 100 });
  model.update(1000, "day");
  const left = model.snapshot.precipitationLeftSec;
  assert.equal(model.setIntensity("rain", 0.9), true);
  near(model.snapshot.rainTarget, 0.9, "the rain's target follows the slider");
  near(model.snapshot.precipitationLeftSec, left, "the state and its timer stay");
  step(model, 8);
  near(model.snapshot.rain, 0.9, "the rain rises there with its fade (0.4 in 8 s at 20 s per full rise)");
  model.force("precipitation", "storm", { intensity: 0.6, fadeSec: 0 });
  model.setIntensity("rain", 0.2);
  near(model.snapshot.rainTarget, 0.6, "a storm keeps raining at least as hard as its own strength");
  model.setIntensity("storm", 0.95);
  near(model.snapshot.stormTarget, 0.95, "the storm's strength");
  near(model.snapshot.rainTarget, 0.95, "and its rain with it");
  model.setIntensity("fog", 0.4);
  near(model.snapshot.fogTarget, 0.4, "the fog's strength");
  assert.equal(model.setIntensity("snow", 1), false, "unknown kinds are refused");

  const location = { weather: settings(), environment: { wind: { rainMultiplier: 2.5, changesPerDay: [4, 12],
    breezeAngleRange: [10, 15], gustAngleRange: [15, 40], gustChancePerSec: 0.4 } } };
  const environment = new EnvironmentSystem(location, 12, new SeededRng(21), { timePhases: { day: { startHour: 0, endHour: 24 } } });
  environment.update(16, 1);
  environment.setWindOverride(-1);
  assert.deepEqual([environment.getSnapshot().wind.direction, environment.getSnapshot().wind.forced], [-1, true],
    "the wind held to the left");
  assert.equal(environment.getPhysicsEnv().wind.direction, -1, "the physics feel the held wind");
  for (let index = 0; index < 50; index += 1) environment.update(3600000, 1);
  assert.equal(environment.getSnapshot().wind.direction, -1, "the random wind does not replace a held one");
  environment.setWindOverride(0);
  assert.equal(environment.getPhysicsEnv().wind, null, "calm: no wind in the physics");
  environment.setWindOverride(null);
  assert.equal(environment.getSnapshot().wind.forced, false, "null returns to the random wind");
}

console.log("weather: states, fades, storm, lightning, fog, derived fields, live strength and held wind OK");
