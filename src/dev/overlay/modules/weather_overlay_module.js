import { OverlayModule } from "../overlay_module.js";

const PRECIPITATION = Object.freeze({ clear: "ясно", rain: "дощ", storm: "гроза" });
const WIND = Object.freeze({ "-1": "← вліво", 0: "немає", 1: "вправо →" });

const share = (value) => (Number(value) || 0).toFixed(2);
const pixels = (value) => (Number(value) || 0).toFixed(1);

// DEV overlay «🌦 Погода й хвилі» (TK-291): the weather and the waves as they are right now, refreshed with the
// overlay: the precipitation state, the rain's, storm's and fog's strengths (0…1), the wind (direction and the strength
// the sea uses), the night share, and the waves' actual amplitude, length and speed (base × the sea state's current
// factors, the same the water and the float use) with their direction. Reads GameCompositionRoot.getWeatherReading()
// through readWeather (null before the game exists).
export class WeatherOverlayModule extends OverlayModule {
  #readWeather;

  constructor(options = {}) {
    super("weather", options);
    if (typeof options.readWeather !== "function") throw new TypeError("WeatherOverlayModule requires readWeather");
    this.#readWeather = options.readWeather;
  }

  render() {
    let html = this.formatHeader("🌦 ПОГОДА Й ХВИЛІ", "#66ccff");
    const reading = this.#readWeather();
    if (!reading) return `${html}<div class="debug-overlay__line">Гра ще не створена.</div>`;
    const waves = reading.waves;
    const state = `${PRECIPITATION[reading.precipitation] ?? reading.precipitation}${reading.frozen ? " (вручну)" : ""}`;
    html += this.plainRow("Опади", state, { color: "#ffffff", metricKey: "weather.precipitation" });
    html += this.plainRow("Гроза 0…1", share(reading.storm), { color: "#ff8866", metricKey: "weather.storm" });
    html += this.plainRow("Дощ 0…1", share(reading.rain), { color: "#88bbff", metricKey: "weather.rain" });
    html += this.plainRow("Туман 0…1", share(reading.fog), { color: "#cccccc", metricKey: "weather.fog" });
    html += this.plainRow("Вітер", `${WIND[reading.windDirection] ?? reading.windDirection}${reading.windForced ? " (вручну)" : ""}`,
      { color: "#ffffff", metricKey: "weather.windDirection" });
    html += this.plainRow("Сила вітру 0…1", share(reading.windStrength), { color: "#ffdd66", metricKey: "weather.windStrength" });
    html += this.plainRow("Ніч 0…1", `${share(reading.night)} · ${reading.phase} · ${pixels(reading.hours)} год`,
      { color: "#aaaaff", metricKey: "weather.night" });
    if (!waves.enabled) {
      html += this.plainRow("Хвилі", "вимкнено", { color: "#888888", metricKey: "weather.waves" });
    } else {
      html += this.plainRow("Амплітуда хвиль", `${pixels(waves.amplitude)} px арту (${pixels(waves.baseAmplitude)} × ${
        share(waves.amplitudeScale)})`, { color: "#66ffcc", metricKey: "weather.waveAmplitude" });
      html += this.plainRow("Довжина хвиль", `${pixels(waves.wavelength)} px арту (${pixels(waves.baseWavelength)} × ${
        share(waves.wavelengthScale)})`, { color: "#66ffcc", metricKey: "weather.waveLength" });
      html += this.plainRow("Швидкість хвиль", `${pixels(waves.speed)} px/с (${pixels(waves.baseSpeed)} × ${
        share(waves.speedScale)}) · ${waves.travel >= 0 ? "→" : "←"}`, { color: "#66ffcc", metricKey: "weather.waveSpeed" });
      if (!waves.seaEnabled) html += this.plainRow("Стан моря", "вимкнено (хвилі як задано)", { color: "#888888",
        metricKey: "weather.seaState" });
    }
    html += this.plainRow("Блискавок", String(reading.strikes), { color: "#ffffff", metricKey: "weather.strikes" });
    return `${html}<div class="debug-overlay__spacer"></div>`;
  }
}
