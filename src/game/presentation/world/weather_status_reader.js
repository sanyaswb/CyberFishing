// TK-291: the weather and the waves as they are right now, for the DEV overlay «🌦 Погода й хвилі»: the weather model's
// state and strengths, the wind (direction from EnvironmentSystem, strength as the sea state uses it), the night share,
// and the waves' actual amplitude, length and speed: the base values of CONFIG.canvas.water times the sea state's
// current factors (SeaStateResolver, the same ones the water and the float use). read() rewrites one object in place.
const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export class WeatherStatusReader {
  #getEnvironment;
  #seaState;
  #getWater;
  #reading = {
    precipitation: "clear", fogState: "none", rain: 0, storm: 0, fog: 0, cloud: 0, strikes: 0, frozen: false,
    windDirection: 0, windForced: false, windStrength: 0, night: 0, phase: "day", hours: 0,
    waves: { enabled: true, seaEnabled: true, amplitude: 0, wavelength: 0, speed: 0, travel: 1,
      amplitudeScale: 1, speedScale: 1, wavelengthScale: 1, baseAmplitude: 0, baseWavelength: 0, baseSpeed: 0 },
  };

  // getEnvironment: () => EnvironmentSystem's snapshot or null; seaState: SeaStateResolver; getWater: () =>
  // CONFIG.canvas.water.
  constructor({ getEnvironment, seaState, getWater }) {
    if (typeof getEnvironment !== "function" || typeof getWater !== "function" || !seaState) {
      throw new TypeError("WeatherStatusReader requires getEnvironment, seaState and getWater");
    }
    this.#getEnvironment = getEnvironment;
    this.#seaState = seaState;
    this.#getWater = getWater;
  }

  read() {
    const reading = this.#reading;
    const environment = this.#getEnvironment();
    const weather = environment?.weather;
    reading.precipitation = weather?.precipitation ?? "clear";
    reading.fogState = weather?.fogState ?? "none";
    reading.rain = number(weather?.rain, 0);
    reading.storm = number(weather?.storm, 0);
    reading.fog = number(weather?.fog, 0);
    reading.cloud = number(weather?.cloud, 0);
    reading.strikes = number(weather?.strikeSerial, 0);
    reading.frozen = weather?.frozen === true;
    reading.windDirection = number(environment?.wind?.direction, 0);
    reading.windForced = environment?.wind?.forced === true;
    reading.phase = environment?.phase ?? "day";
    reading.hours = number(environment?.time, 0);
    const sea = this.#seaState.state;
    reading.windStrength = number(sea.wind, 0);
    reading.night = number(sea.night, 0);
    const water = this.#getWater() || {};
    const waves = reading.waves;
    waves.enabled = water.enabled === true && water.waves !== false;
    waves.seaEnabled = water.seaState?.enabled === true;
    waves.baseAmplitude = number(water.amplitude, 0);
    waves.baseWavelength = number(water.wavelength, 0);
    waves.baseSpeed = number(water.speed, 0);
    waves.amplitudeScale = number(sea.amplitudeScale, 1);
    waves.speedScale = number(sea.speedScale, 1);
    waves.wavelengthScale = number(sea.wavelengthScale, 1);
    waves.travel = number(sea.travel, 1);
    waves.amplitude = waves.enabled ? waves.baseAmplitude * waves.amplitudeScale : 0;
    waves.wavelength = waves.baseWavelength * waves.wavelengthScale;
    waves.speed = waves.enabled ? waves.baseSpeed * waves.speedScale : 0;
    return reading;
  }
}
