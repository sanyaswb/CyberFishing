// Spec 172 (TK-271): what the scene's weather effects read this frame, written into GameRenderFrame world.weather:
// the weather model's intensities (rain, storm, fog, cloud: 0…1) and the wind's direction (−1 left, 0 calm, 1 right).
// It copies numbers into the frame's reused record; the scene never reads the game's state directly.
const share = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
};

export class WeatherRenderModelBuilder {
  #getEnvironment;

  // getEnvironment: () => EnvironmentSystem's snapshot ({ weather, wind }) or null.
  constructor({ getEnvironment }) {
    if (typeof getEnvironment !== "function") throw new TypeError("WeatherRenderModelBuilder requires getEnvironment");
    this.#getEnvironment = getEnvironment;
  }

  buildInto(target) {
    const environment = this.#getEnvironment();
    const weather = environment?.weather;
    target.rain = share(weather?.rain);
    target.storm = share(weather?.storm);
    target.fog = share(weather?.fog);
    target.cloud = share(weather?.cloud);
    const direction = Number(environment?.wind?.direction);
    target.windDirection = Number.isFinite(direction) ? Math.max(-1, Math.min(1, direction)) : 0;
    const rawStrength = environment?.wind?.strength;
    const strength = rawStrength !== undefined && rawStrength !== null ? Number(rawStrength) : NaN;
    target.windStrength = Number.isFinite(strength)
      ? Math.min(1, Math.max(0, strength))
      : Math.abs(target.windDirection);
  }
}
