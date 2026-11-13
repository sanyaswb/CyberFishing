import { OverlayModule } from "../overlay_module.js";

const PRECIPITATION = Object.freeze({
  clear: "ясно",
  rain: "дощ",
  storm: "гроза",
});
const WIND = Object.freeze({ "-1": "← вліво", 0: "немає", 1: "вправо →" });

const share = (value) => (Number(value) || 0).toFixed(2);
const pixels = (value) => (Number(value) || 0).toFixed(1);
const factor = (value) => `×${share(value)}`;

// DEV overlay «ПОГОДА й хвилі» (TK-291, TK-295): the weather and the waves as they are right now, refreshed with the
// overlay: precipitation state, storm/rain/fog intensities (0…1), wind, night share, and the waves' actual amplitude,
// length and speed as top-level parameters with expandable multiplier sub-items explaining each factor's role, range
// and current value. Reads GameCompositionRoot.getWeatherReading() through readWeather (null before the game exists).
export class WeatherOverlayModule extends OverlayModule {
  #readWeather;

  constructor(options = {}) {
    super("weather", options);
    if (typeof options.readWeather !== "function")
      throw new TypeError("WeatherOverlayModule requires readWeather");
    this.#readWeather = options.readWeather;
  }

  render() {
    let html = this.formatHeader("ПОГОДА Й ХВИЛІ", "#66ccff");
    const reading = this.#readWeather();
    if (!reading)
      return `${html}<div class="debug-overlay__line">Гра ще не створена.</div>`;
    const waves = reading.waves;
    const state = `${PRECIPITATION[reading.precipitation] ?? reading.precipitation}${reading.frozen ? " (вручну)" : ""}`;
    html += this.plainRow("Опади", state, {
      color: "#ffffff",
      metricKey: "weather.precipitation",
      devtoolsPath:
        reading.precipitation === "storm"
          ? "WEATHER.controls.storm"
          : "WEATHER.controls.rain",
    });
    html += this.plainRow("Гроза 0…1", share(reading.storm), {
      color: "#ff8866",
      metricKey: "weather.storm",
      devtoolsPath: "WEATHER.controls.stormStrength",
    });
    html += this.plainRow("Дощ 0…1", share(reading.rain), {
      color: "#88bbff",
      metricKey: "weather.rain",
      devtoolsPath: "WEATHER.controls.rainStrength",
    });
    html += this.plainRow("Туман 0…1", share(reading.fog), {
      color: "#cccccc",
      metricKey: "weather.fog",
      devtoolsPath: "WEATHER.controls.fogStrength",
    });
    html += this.plainRow(
      "Вітер",
      `${WIND[reading.windDirection] ?? reading.windDirection}${reading.windForced ? " (вручну)" : ""}`,
      {
        color: "#ffffff",
        metricKey: "weather.windDirection",
        devtoolsPath: "WEATHER.controls.windDirection",
      },
    );
    html += this.plainRow("Сила вітру 0…1", share(reading.windStrength), {
      color: "#ffdd66",
      metricKey: "weather.windStrength",
      devtoolsPath: "WEATHER.controls.windDirection",
    });
    html += this.plainRow(
      "Ніч 0…1",
      `${share(reading.night)} · ${reading.phase} · ${pixels(reading.hours)} год`,
      {
        color: "#aaaaff",
        metricKey: "weather.night",
        devtoolsPath: "CONFIG.timePhases.night.startHour",
      },
    );
    if (!waves.enabled) {
      html += this.plainRow("Хвилі", "вимкнено", {
        color: "#888888",
        metricKey: "weather.waves",
        devtoolsPath: "CONFIG.canvas.water.waves",
      });
    } else {
      html += this.#renderWaves(waves, reading);
    }
    html += this.plainRow("Блискавок", String(reading.strikes), {
      color: "#ffffff",
      metricKey: "weather.strikes",
      devtoolsPath: "WEATHER.controls.strike",
    });
    return `${html}<div class="debug-overlay__spacer"></div>`;
  }

  #renderWaves(waves, reading) {
    const seaEnabled = waves.seaEnabled === true;
    const factors = waves.factors || {};
    const smoothingSec = Number(factors.smoothingSec) || 0;
    const amp = factors.amplitude || {};
    const length = factors.wavelength || {};
    const speed = factors.speed || {};

    let ampSub = this.#subRow("База (з арту)", `${pixels(waves.baseAmplitude)} px`, "weather.waveAmplitude.base", {
      color: "#9eb8c7",
      devtoolsPath: "CONFIG.canvas.water.amplitude",
    });
    ampSub += this.#subRow(
      seaEnabled ? "Загальний множник (вітер × ніч × гроза)" : "Загальний множник («Стан моря» вимкн.)",
      this.#formatScale(waves.amplitudeScale, amp.targetScale, seaEnabled, smoothingSec),
      "weather.waveAmplitude.scale",
      { color: "#88eedd", devtoolsPath: "CONFIG.canvas.water.seaState.enabled" },
    );
    if (seaEnabled) {
      const activeWindAmpPath = (Number(reading.windStrength) || 0) >= 0.5
        ? "CONFIG.canvas.water.seaState.normal.windAmplitude"
        : "CONFIG.canvas.water.seaState.normal.calmAmplitude";
      ampSub += this.#subRow(
        "Вітер: висота",
        factor(amp.wind ?? waves.amplitudeScale),
        "weather.waveAmplitude.wind",
        {
          labelHtml: `${this.devLink("Вітер: висота", activeWindAmpPath)} (`
            + `${this.devLink(`штиль ${factor(amp.windMin ?? 1)}`, "CONFIG.canvas.water.seaState.normal.calmAmplitude")}`
            + ` … ${this.devLink(`вітер ${factor(amp.windMax ?? 1)}`, "CONFIG.canvas.water.seaState.normal.windAmplitude")})`,
        },
      );
      ampSub += this.#subRow(
        `Ніч: затихання (день ×1.00 … ніч ${factor(amp.nightTarget ?? 1)})`,
        factor(amp.night ?? 1),
        "weather.waveAmplitude.night",
        { devtoolsPath: "CONFIG.canvas.water.seaState.normal.nightAmplitude" },
      );
      ampSub += this.#subRow(
        `Гроза: штормовий підйом (ясно ×1.00 … гроза ${factor(amp.stormTarget ?? 1)})`,
        factor(amp.storm ?? 1),
        "weather.waveAmplitude.storm",
        { devtoolsPath: "CONFIG.canvas.water.seaState.storm.amplitude" },
      );
    }

    let lengthSub = this.#subRow("База (з арту)", `${pixels(waves.baseWavelength)} px`, "weather.waveLength.base", {
      color: "#9eb8c7",
      devtoolsPath: "CONFIG.canvas.water.wavelength",
    });
    lengthSub += this.#subRow(
      seaEnabled ? "Загальний множник (від грози)" : "Загальний множник («Стан моря» вимкн.)",
      this.#formatScale(waves.wavelengthScale, length.targetScale, seaEnabled, smoothingSec),
      "weather.waveLength.scale",
      { color: "#88eedd", devtoolsPath: "CONFIG.canvas.water.seaState.enabled" },
    );
    if (seaEnabled) {
      lengthSub += this.#subRow(
        `Гроза: розтяг хвилі (ясно ×1.00 … гроза ${factor(length.stormTarget ?? 1)})`,
        factor(length.storm ?? waves.wavelengthScale),
        "weather.waveLength.storm",
        { devtoolsPath: "CONFIG.canvas.water.seaState.storm.wavelength" },
      );
    }

    let speedSub = this.#subRow("База швидкості", `${pixels(waves.baseSpeed)} px/с`, "weather.waveSpeed.base", {
      color: "#9eb8c7",
      devtoolsPath: "CONFIG.canvas.water.speed",
    });
    speedSub += this.#subRow(
      seaEnabled ? "Загальний множник (вітер × гроза)" : "Загальний множник («Стан моря» вимкн.)",
      this.#formatScale(waves.speedScale, speed.targetScale, seaEnabled, smoothingSec),
      "weather.waveSpeed.scale",
      { color: "#88eedd", devtoolsPath: "CONFIG.canvas.water.seaState.enabled" },
    );
    if (seaEnabled) {
      speedSub += this.#subRow(
        `Вітер: прискорення (штиль ×1.00 … вітер ${factor(speed.windMax ?? 1)})`,
        factor(speed.wind ?? 1),
        "weather.waveSpeed.wind",
        { devtoolsPath: "CONFIG.canvas.water.seaState.normal.windSpeed" },
      );
      speedSub += this.#subRow(
        `Гроза: штормове прискорення (ясно ×1.00 … гроза ${factor(speed.stormTarget ?? 1)})`,
        factor(speed.storm ?? 1),
        "weather.waveSpeed.storm",
        { devtoolsPath: "CONFIG.canvas.water.seaState.storm.speed" },
      );
    }

    return (
      this.#waveGroup(
        "weather-wave-amplitude",
        this.plainRow("Амплітуда хвиль", `${pixels(waves.amplitude)} px арту`, {
          color: "#66ffcc",
          metricKey: "weather.waveAmplitude",
          devtoolsPath: "CONFIG.canvas.water.amplitude",
        }),
        ampSub,
      )
      + this.#waveGroup(
        "weather-wave-length",
        this.plainRow("Довжина хвиль", `${pixels(waves.wavelength)} px арту`, {
          color: "#66ffcc",
          metricKey: "weather.waveLength",
          devtoolsPath: "CONFIG.canvas.water.wavelength",
        }),
        lengthSub,
      )
      + this.#waveGroup(
        "weather-wave-speed",
        this.plainRow("Швидкість хвиль", `${pixels(waves.speed)} px/с · ${waves.travel >= 0 ? "→" : "←"}`, {
          color: "#66ffcc",
          metricKey: "weather.waveSpeed",
          devtoolsPath: "CONFIG.canvas.water.speed",
        }),
        speedSub,
      )
    );
  }

  #waveGroup(id, summaryRow, bodyHtml) {
    return `<details class="debug-overlay__details" id="${this.escapeAttr(id)}" open>`
      + `<summary class="debug-overlay__summary">${summaryRow}</summary>`
      + `<div class="debug-overlay__details-body">${bodyHtml}</div>`
      + "</details>";
  }

  #subRow(label, value, metricKey, options = {}) {
    return this.plainRow(label, value, { color: "#b9c8d4", metricKey, ...options });
  }

  #formatScale(currentScale, targetScale, seaEnabled, smoothingSec) {
    if (!seaEnabled) return factor(1);
    const current = Number(currentScale) || 0;
    const target = Number.isFinite(Number(targetScale)) ? Number(targetScale) : current;
    if (Math.abs(target - current) < 0.005) return factor(current);
    const suffix = smoothingSec > 0
      ? ` (${this.devLink(`${pixels(smoothingSec)} с`, "CONFIG.canvas.water.seaState.smoothingSec")})`
      : "";
    return `${factor(current)} → ціль ${factor(target)}${suffix}`;
  }
}
