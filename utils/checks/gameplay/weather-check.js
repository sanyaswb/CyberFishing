"use strict";
// Spec 172 stage A (TK-261): the weather model's states, fades, storm, lightning and fog, and the fields the bite
// chances, the radio and the wind read from EnvironmentSystem. Fixed seeds, explicit time steps.
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

const settings = () => ({
  precipitation: {
    clear: { weight: 0.7, durationSec: [180, 900] },
    rain: { weight: 0.25, durationSec: [60, 600], intensity: [0.3, 0.8] },
    storm: { weight: 0.05, durationSec: [60, 240], intensity: [0.6, 1.0] },
    fadeInSec: 20,
    fadeOutSec: 30,
  },
  fog: {
    chance: 1,
    phases: ["morning", "night"],
    idleSec: [10, 10],
    durationSec: [100, 100],
    intensity: [0.5, 0.5],
    fadeInSec: 10,
    fadeOutSec: 10,
  },
  lightning: { intervalSec: [25, 6], distance: [0.2, 1.0] },
  thresholds: { rain: 0.15, fog: 0.3 },
});
const near = (actual, expected, message) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${message}: ${actual} ≠ ${expected}`,
  );
const step = (model, seconds, phase = "day", dt = 0.1) => {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt)
    model.update(dt * 1000, phase);
};

// 1. The location's real settings drive a model: states only from the precipitation table, always in range.
{
  const model = new WeatherModel({
    rng: new SeededRng("check:weather"),
    getSettings: () => MAP_DB.test.weather,
  });
  const seen = new Set();
  for (let index = 0; index < 100000; index += 1) {
    model.update(1000, "day");
    const weather = model.snapshot;
    seen.add(weather.precipitation);
    for (const key of ["rain", "storm", "fog", "cloud"])
      assert.ok(weather[key] >= 0 && weather[key] <= 1, `${key} in 0…1`);
  }
  assert.deepEqual(
    [...seen].sort(),
    ["clear", "rain", "storm"],
    "a long run visits clear, rain and storm",
  );
}

// 2. Determinism: the same seed gives the same weather.
{
  const run = () => {
    const model = new WeatherModel({
      rng: new SeededRng(42),
      getSettings: settings,
    });
    const trace = [];
    for (let index = 0; index < 3000; index += 1) {
      model.update(500, index % 1000 < 500 ? "night" : "day");
      if (index % 50 === 0)
        trace.push(
          `${model.snapshot.precipitation}:${model.snapshot.rain.toFixed(6)}:${model.snapshot.fog.toFixed(6)}`,
        );
    }
    return trace.join("|");
  };
  assert.equal(run(), run(), "the weather is deterministic for a seed");
}

// 3. Transitions: a storm only follows rain and only returns to rain; durations are real seconds within their ranges.
{
  const config = settings();
  config.precipitation.storm.weight = 5;
  const model = new WeatherModel({
    rng: new SeededRng(7),
    getSettings: () => config,
  });
  // An episode may repeat its state (clear → clear with a new duration); each episode is measured on its own.
  let previous = null,
    episode = 0,
    enteredAt = 0,
    time = 0,
    transitions = 0;
  for (let index = 0; index < 200000 && transitions < 300; index += 1) {
    model.update(1000, "day");
    time += 1;
    const state = model.snapshot.precipitation;
    if (model.snapshot.episode !== episode) {
      if (previous !== null) {
        transitions += 1;
        if (state === "storm")
          assert.equal(previous, "rain", "a storm only follows rain");
        if (previous === "storm")
          assert.equal(state, "rain", "a storm returns to rain");
        const lasted = time - enteredAt;
        const [min, max] = config.precipitation[previous].durationSec;
        assert.ok(
          lasted >= min && lasted <= max + 1,
          `${previous} lasted ${lasted} s, expected ${min}…${max}`,
        );
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
  const model = new WeatherModel({
    rng: new SeededRng(3),
    getSettings: settings,
  });
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
  assert.ok(
    model.snapshot.rain >= 0.9,
    "a storm rains at least as hard as its intensity",
  );
  const before = model.snapshot.precipitationLeftSec;
  step(model, 30);
  assert.equal(
    model.snapshot.precipitation,
    "storm",
    "frozen weather keeps its state",
  );
  near(
    model.snapshot.precipitationLeftSec,
    before,
    "frozen weather keeps its timer",
  );
}

// 5. Lightning: none without a storm; strikes at the storm's interval (±50%), variants 0…3, distances in range.
{
  const model = new WeatherModel({
    rng: new SeededRng(11),
    getSettings: settings,
  });
  model.setFrozen(true);
  model.force("precipitation", "rain", { intensity: 1, fadeSec: 0 });
  step(model, 120);
  assert.equal(
    model.snapshot.strikeSerial,
    0,
    "rain without a storm has no lightning",
  );
  model.force("precipitation", "storm", { intensity: 1, fadeSec: 0 });
  const strikes = [];
  let last = model.snapshot.strikeSerial,
    time = 0;
  for (let index = 0; index < 6000; index += 1) {
    model.update(100, "day");
    time += 0.1;
    if (model.snapshot.strikeSerial !== last) {
      last = model.snapshot.strikeSerial;
      strikes.push(time);
      assert.ok(
        [0, 1, 2, 3].includes(model.snapshot.strikeVariant),
        "variant 0…3",
      );
      assert.ok(
        model.snapshot.strikeDistance >= 0.2 &&
          model.snapshot.strikeDistance <= 1,
        "distance in range",
      );
    }
  }
  assert.ok(
    strikes.length >= 600 / 9 && strikes.length <= 600 / 3 + 1,
    `a full storm strikes every 3…9 s (${strikes.length} in 600 s)`,
  );
  for (let index = 1; index < strikes.length; index += 1) {
    const gap = strikes[index] - strikes[index - 1];
    assert.ok(
      gap >= 3 - 0.11 && gap <= 9 + 0.11,
      `strike gap ${gap.toFixed(2)} s`,
    );
  }
  const serial = model.snapshot.strikeSerial;
  model.strike();
  assert.equal(model.snapshot.strikeSerial, serial + 1, "a strike on demand");
}

// 6. Fog: only in its phases; leaving them ends the fog, which fades out.
{
  const model = new WeatherModel({
    rng: new SeededRng(5),
    getSettings: settings,
  });
  step(model, 60, "day");
  assert.equal(model.snapshot.fogState, "none", "no fog outside its phases");
  step(model, 15, "night");
  assert.equal(
    model.snapshot.fogState,
    "fog",
    "fog starts in an allowed phase",
  );
  near(model.snapshot.fog, 0.5, "fog reaches its intensity");
  step(model, 0.1, "day", 0.1);
  assert.equal(
    model.snapshot.fogState,
    "none",
    "leaving the phase ends the fog",
  );
  step(model, 2.5, "day");
  assert.ok(
    model.snapshot.fog > 0.2 && model.snapshot.fog < 0.3,
    "the fog fades out instead of vanishing",
  );
}

// 7. EnvironmentSystem: thresholds and the continuous rain multiplier; the snapshot object is reused.
{
  const location = {
    weather: settings(),
    environment: { wind: { rainMultiplier: 2.5 } },
  };
  const rng = new SeededRng(9);
  const weather = new WeatherModel({
    rng,
    getSettings: () => location.weather,
  });
  const environment = new EnvironmentSystem(
    location,
    12,
    rng,
    { timePhases: { day: { startHour: 0, endHour: 24 } } },
    null,
    weather,
  );
  const snapshot = environment.getSnapshot();
  weather.setFrozen(true);
  weather.force("precipitation", "rain", { intensity: 0.1, fadeSec: 0 });
  environment.update(16, 1);
  assert.equal(
    snapshot.isRaining,
    false,
    "light drizzle below the threshold does not count as rain",
  );
  near(snapshot.wind.rainMult, 1.15, "rainMult follows the intensity");
  weather.force("precipitation", "rain", { intensity: 1, fadeSec: 0 });
  environment.update(16, 1);
  assert.equal(snapshot.isRaining, true, "rain above the threshold");
  near(
    snapshot.wind.rainMult,
    2.5,
    "full rain gives the configured multiplier",
  );
  weather.force("fog", "fog", { intensity: 0.4, fadeSec: 0 });
  environment.update(16, 1);
  assert.equal(snapshot.isFoggy, true, "fog above the threshold");
  assert.equal(environment.getSnapshot(), snapshot, "one snapshot object");
  assert.equal(
    snapshot.weather,
    weather.snapshot,
    "the weather's own snapshot is shared, not copied",
  );
  weather.force("precipitation", "clear", { fadeSec: 0 });
  environment.update(16, 1);
  assert.equal(snapshot.isRaining, false);
  assert.equal(snapshot.wind.rainMult, 1, "no rain, no multiplier");
}

// 8. Without a weather model the weather stays clear.
{
  const environment = new EnvironmentSystem(
    { environment: {} },
    12,
    new SeededRng(1),
    { timePhases: {} },
  );
  for (let index = 0; index < 100; index += 1) environment.update(1000, 240);
  const snapshot = environment.getSnapshot();
  assert.equal(snapshot.isRaining, false);
  assert.equal(snapshot.isFoggy, false);
  assert.equal(snapshot.weather.precipitation, "clear");
}

// 9. TK-271: live strength without restarting the state, and the wind held by hand.
{
  const model = new WeatherModel({
    rng: new SeededRng(13),
    getSettings: settings,
  });
  model.setFrozen(true);
  model.force("precipitation", "rain", {
    intensity: 0.5,
    fadeSec: 0,
    durationSec: 100,
  });
  model.update(1000, "day");
  const left = model.snapshot.precipitationLeftSec;
  assert.equal(model.setIntensity("rain", 0.9), true);
  near(model.snapshot.rainTarget, 0.9, "the rain's target follows the slider");
  near(
    model.snapshot.precipitationLeftSec,
    left,
    "the state and its timer stay",
  );
  step(model, 8);
  near(
    model.snapshot.rain,
    0.9,
    "the rain rises there with its fade (0.4 in 8 s at 20 s per full rise)",
  );
  model.force("precipitation", "storm", { intensity: 0.6, fadeSec: 0 });
  model.setIntensity("rain", 0.2);
  near(
    model.snapshot.rainTarget,
    0.6,
    "a storm keeps raining at least as hard as its own strength",
  );
  model.setIntensity("storm", 0.95);
  near(model.snapshot.stormTarget, 0.95, "the storm's strength");
  near(model.snapshot.rainTarget, 0.95, "and its rain with it");
  model.setIntensity("fog", 0.4);
  near(model.snapshot.fogTarget, 0.4, "the fog's strength");
  assert.equal(
    model.setIntensity("snow", 1),
    false,
    "unknown kinds are refused",
  );

  const location = {
    weather: settings(),
    environment: {
      wind: {
        rainMultiplier: 2.5,
        changesPerDay: [4, 12],
        breezeAngleRange: [10, 15],
        gustAngleRange: [15, 40],
        gustChancePerSec: 0.4,
      },
    },
  };
  const environment = new EnvironmentSystem(location, 12, new SeededRng(21), {
    timePhases: { day: { startHour: 0, endHour: 24 } },
  });
  environment.update(16, 1);
  environment.setWindOverride(-1);
  assert.deepEqual(
    [
      environment.getSnapshot().wind.direction,
      environment.getSnapshot().wind.forced,
    ],
    [-1, true],
    "the wind held to the left",
  );
  assert.equal(
    environment.getPhysicsEnv().wind.direction,
    -1,
    "the physics feel the held wind",
  );
  for (let index = 0; index < 50; index += 1) environment.update(3600000, 1);
  assert.equal(
    environment.getSnapshot().wind.direction,
    -1,
    "the random wind does not replace a held one",
  );
  environment.setWindOverride(0);
  assert.equal(
    environment.getPhysicsEnv().wind,
    null,
    "calm: no wind in the physics",
  );
  environment.setWindOverride(null);
  assert.equal(
    environment.getSnapshot().wind.forced,
    false,
    "null returns to the random wind",
  );
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
    'data-devtools-path="WEATHER.controls.storm"',
    'data-devtools-path="WEATHER.controls.stormStrength"',
    'data-devtools-path="WEATHER.controls.windDirection"',
    'data-devtools-path="WEATHER.controls.windStrength"',
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
  const wind = new WindModel({
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
  const calmFirst = new WindModel({
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
    calmFirst.snapshot.strength >= MAP_DB.test.weather.wind.weatherBoost.stormMinStrength,
    "full storm lifts wind above calm immediately via stormMinStrength",
  );
  assert(
    calmFirst.snapshot.direction === -1 || calmFirst.snapshot.direction === 1,
    "storm-driven wind picks a non-zero direction when rising from calm",
  );

  // Manual direction & strength overrides + isolated windRng vs weatherRng.
  const custom = new WindModel({
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
  const windPart = new WindModel({ rng: new SeededRng(88), getSettings: () => MAP_DB.test.weather.wind });
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
    weatherRef.update(1000, "day");
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
  const liveWind = new WindModel({ rng: new SeededRng("check:dev-wind"), getSettings: () => MAP_DB.test.weather.wind });
  liveWind.setStrengthOverride(0.72);
  liveWind.triggerGust({ delta: 0.2, durationSec: 2 });
  liveWind.update(300, { rain: 0, storm: 0 });
  const stageCEnv = {
    time: 14,
    phase: "day",
    weather: { precipitation: "clear", rain: 0, storm: 0, fog: 0, cloud: 0, strikeSerial: 0, frozen: false },
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
      createButtonRow(label, parent, onClick, _danger, _title, path) {
        if (path) rowsByPath.set(path.join("."), { kind: "button", label, onClick });
        else rowsByPath.set(`button:${label}`, { kind: "button", label, onClick });
      },
      createSwitcherRow(label, value, parent, onChange, path) {
        if (path) rowsByPath.set(path.join("."), { kind: "switcher", value, onChange });
      },
      createRangeRow(label, value, parent, onChange, path) {
        if (path) rowsByPath.set(path.join("."), { kind: "range", value, onChange });
      },
      createSelectRow(label, _choices, value, parent, onChange, path) {
        if (path) rowsByPath.set(path.join("."), { kind: "select", value, onChange });
      },
      createChoiceRow(label, choices, value, parent, onChange, path) {
        if (path) rowsByPath.set(path.join("."), { kind: "choice", choices, value, onChange });
      },
      createInputRow(label, value, parent, _type, onChange, path, bindingPath) {
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
      setFrozen(v) {
        calls.push(["frozen", v]);
      },
      force() {},
      strike() {
        calls.push(["strike"]);
      },
      setIntensity() {},
    };
    const devWeather = new WeatherDevSection({
      ui: fakeUi,
      weather: {
        locationId: "test",
        getModel: () => fakeModel,
        getWind: () => stageCEnv.wind,
        setWind: (dir) => calls.push(["setWind", dir]),
        setWindStrength: (s) => calls.push(["setWindStrength", s]),
        triggerWindGust: () => calls.push(["triggerWindGust"]),
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
    assert(locChoice && locChoice.value === "test", "location selector starts at active map");
    locChoice.onChange("lake");
    const rainChance = rowsByPath.get("WEATHER.chances.rainWeight");
    assert.deepEqual(
      rainChance.bindingPath,
      ["CONFIG", "locations", "map", "lake", "weather", "precipitation", "rain", "weight"],
      "Weather Chances binds directly to selected map's CONFIG weather tree",
    );
    rainChance.onChange(1.5);
    assert(
      calls.some(([k, p, v]) => k === "updateConfig" && p === "CONFIG.locations.map.lake.weather.precipitation.rain.weight" && v === 1.5),
      "Weather Chances updates weight on selected location",
    );
    rowsByPath.get("WEATHER.chances.fogChance").onChange(1.5);
    assert(
      calls.some(([k, p, v]) => k === "updateConfig" && p === "CONFIG.locations.map.lake.weather.fog.chance" && v === 1),
      "Weather Chances clamps fogChance to [0, 1] and calls updateConfig",
    );
    rowsByPath.get("WEATHER.controls.windStrength").onChange(82);
    assert(calls.some(([k, v]) => k === "setWindStrength" && Math.abs(v - 0.82) < 1e-6), "strength slider drives setWindStrength");
    assert(fakeUi.syncCalls.some(([p, v]) => p === "WEATHER.controls.windStrengthHold" && v === true), "dragging strength slider activates hold switcher");
    rowsByPath.get("WEATHER.controls.gust").onClick();
    assert(calls.some(([k]) => k === "triggerWindGust"), "gust button calls triggerWindGust");
    rowsByPath.get("button:↺ Автоматична погода").onClick();
    assert(calls.some(([k, v]) => k === "setWindStrength" && v === null), "auto button resets forced wind strength");

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
  const holdReleaseWind = new WindModel({
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
  const forcedDirWind = new WindModel({
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
  new WeatherRenderModelBuilder({
    getEnvironment: () => ({
      weather: { rain: 0.8, storm: 0, fog: 0, cloud: 0.8 },
      wind: { direction: -1, strength: 0.85, gustStrength: 0.26 },
    }),
  }).buildInto(gustRenderTarget);
  assert(
    Math.abs(gustRenderTarget.windGust - 0.26) < 1e-6,
    `WeatherRenderModelBuilder copies wind.gustStrength into target.windGust (got ${gustRenderTarget.windGust})`,
  );
}

console.log(
  "weather: states, fades, storm, lightning, fog, derived fields, live strength, held wind, the sea state and the live reading OK",
);
