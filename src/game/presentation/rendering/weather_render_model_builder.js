// Spec 172 (TK-271): what the scene's weather effects read this frame, written into GameRenderFrame world.weather:
// the weather model's intensities (rain, storm, fog, cloud: 0…1) and the wind's direction (−1 left, 0 calm, 1 right).
// It copies numbers into the frame's reused record; the scene never reads the game's state directly.
const share = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
};

export class WeatherRenderModelBuilder {
  #getEnvironment;
  #ashHold = null;

  // getEnvironment: () => EnvironmentSystem's snapshot ({ weather, wind }) or null.
  constructor({ getEnvironment }) {
    if (typeof getEnvironment !== "function") throw new TypeError("WeatherRenderModelBuilder requires getEnvironment");
    this.#getEnvironment = getEnvironment;
  }

  // Spec 180 D10: the ash's strength 0…1 held by hand (DevTools «Керування»), null: it follows the emission.
  holdAsh(strength) {
    this.#ashHold = strength === null || !Number.isFinite(Number(strength)) ? null : share(strength);
  }

  get ashHeld() {
    return this.#ashHold !== null;
  }

  // TK-367 (DevTools «Керування»): the held strength (0…1) or null, and the ash's strength now (held, else the
  // emission's) — what the scene draws this frame.
  get ashHold() {
    return this.#ashHold;
  }

  get ashStrength() {
    return this.#ashHold ?? share(this.#getEnvironment()?.emission?.intensity);
  }

  buildInto(target) {
    const environment = this.#getEnvironment();
    const weather = environment?.weather;
    target.rain = share(weather?.rain);
    target.storm = share(weather?.storm);
    target.fog = share(weather?.fog);
    target.cloud = share(weather?.cloud);
    // Spec 179: the emission's intensity (its background layer, the rain's colour).
    target.emission = share(environment?.emission?.intensity);
    // Spec 180 D10: the ash's strength follows the emission unless DevTools holds it.
    target.ash = this.#ashHold ?? target.emission;
    // Spec 179 stage D (TK-338): the location's radiation 0…1 (the hiss over the scene).
    target.radiation = share(environment?.radiation);
    // Spec 182 (TK-352): the starfall's strength now (StarfallNight; 0 outside its nights and during an emission) and
    // the bolides that fell.
    target.starfall = share(environment?.starfall?.strength);
    target.bolideSerial = Number(environment?.starfall?.bolideSerial) || 0;
    const direction = Number(environment?.wind?.direction);
    target.windDirection = Number.isFinite(direction) ? Math.max(-1, Math.min(1, direction)) : 0;
    const rawStrength = environment?.wind?.strength;
    const strength = rawStrength !== undefined && rawStrength !== null ? Number(rawStrength) : NaN;
    target.windStrength = Number.isFinite(strength)
      ? Math.min(1, Math.max(0, strength))
      : Math.abs(target.windDirection);
    const rawGust = environment?.wind?.gustStrength;
    const gust = rawGust !== undefined && rawGust !== null ? Number(rawGust) : 0;
    target.windGust = Number.isFinite(gust) ? Math.min(1, Math.max(0, gust)) : 0;
  }
}
