import { backgroundTimeBlend } from "../../domain/time/background_time_blend.js";

const MAX_STEP_SEC = 0.25;

const clamp01 = (value) => (value <= 0 ? 0 : value >= 1 ? 1 : value);
const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const positive = (value, fallback) => Math.max(0, number(value, fallback));

// Spec 172 D7 (TK-289): the state of the sea, which both the water's picture and the float's rocking follow, so they
// always agree. From the weather, the wind and the time of day it gives multipliers of the waves' amplitude, speed and
// length and the direction they travel:
// - the normal state (settings.normal): a calm sea has calmAmplitude, a wind windAmplitude (and windSpeed); the waves
//   travel with the wind (a calm keeps the last direction); as the night background fades in (backgroundTimeBlend),
//   the amplitude goes down to nightAmplitude (nights are mostly calm);
// - the storm event (settings.storm, TK-291): at full storm the amplitude, speed and length grow by its amplitude,
//   speed and wavelength factors (a storm also counts as full wind).
// Every value moves toward its target with the time constant smoothingSec (real time), so the sea swells and calms down
// instead of jumping. update() runs once a frame (the world's render model); readers take state. Allocation-free.
export class SeaStateResolver {
  #getEnvironment;
  #getSettings;
  #blend = { evening: 0, night: 0 };
  #lastNowMs = NaN;
  #ready = false;
  #travelTarget = 1;
  #state = { amplitudeScale: 1, speedScale: 1, wavelengthScale: 1, travel: 1, wind: 0, night: 0, storm: 0 };

  // getEnvironment: () => EnvironmentSystem's snapshot ({ time, weather, wind }) or null; getSettings: () =>
  // CONFIG.canvas.water.seaState (read every frame: DEV edits apply at once).
  constructor({ getEnvironment, getSettings }) {
    if (typeof getEnvironment !== "function" || typeof getSettings !== "function") {
      throw new TypeError("SeaStateResolver requires getEnvironment and getSettings");
    }
    this.#getEnvironment = getEnvironment;
    this.#getSettings = getSettings;
  }

  // { amplitudeScale, speedScale, wavelengthScale, travel (−1 … 1: the waves' direction along x), wind, night, storm }.
  get state() {
    return this.#state;
  }

  update(nowMs) {
    const now = number(nowMs, 0);
    const dt = Number.isFinite(this.#lastNowMs) ? Math.min(MAX_STEP_SEC, Math.max(0, (now - this.#lastNowMs) / 1000)) : 0;
    this.#lastNowMs = now;
    const settings = this.#getSettings();
    const state = this.#state;
    if (settings?.enabled !== true) {
      state.amplitudeScale = 1; state.speedScale = 1; state.wavelengthScale = 1;
      state.wind = 0; state.night = 0; state.storm = 0;
      this.#ready = false;
      return state;
    }
    const environment = this.#getEnvironment();
    const storm = clamp01(number(environment?.weather?.storm, 0));
    const direction = Math.max(-1, Math.min(1, number(environment?.wind?.direction, 0)));
    const wind = Math.max(Math.abs(direction), storm);
    if (direction !== 0) this.#travelTarget = Math.sign(direction);
    const night = Number.isFinite(Number(environment?.time))
      ? clamp01(backgroundTimeBlend(Number(environment.time), this.#blend).night) : 0;
    const normal = settings.normal;
    const event = settings.storm;
    const calm = positive(normal?.calmAmplitude, 1);
    const windy = positive(normal?.windAmplitude, 1);
    const amplitude = (calm + (windy - calm) * wind) * (1 + (positive(normal?.nightAmplitude, 1) - 1) * night) *
      (1 + (positive(event?.amplitude, 1) - 1) * storm);
    const speed = (1 + (positive(normal?.windSpeed, 1) - 1) * wind) * (1 + (positive(event?.speed, 1) - 1) * storm);
    const wavelength = 1 + (positive(event?.wavelength, 1) - 1) * storm;
    const smoothing = positive(settings.smoothingSec, 0);
    const follow = !this.#ready || smoothing <= 0 ? 1 : 1 - Math.exp(-dt / smoothing);
    this.#ready = true;
    state.amplitudeScale += (amplitude - state.amplitudeScale) * follow;
    state.speedScale += (speed - state.speedScale) * follow;
    state.wavelengthScale += (wavelength - state.wavelengthScale) * follow;
    state.travel += (this.#travelTarget - state.travel) * follow;
    state.wind += (wind - state.wind) * follow;
    state.night += (night - state.night) * follow;
    state.storm += (storm - state.storm) * follow;
    return state;
  }
}
