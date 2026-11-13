import { DevSavingSection } from "./export/dev_saving_section.js";
import {
  buildWeatherFile,
  canonicalLocationWeather,
  canonicalRain,
  changedWeatherParts,
  locationWeatherHash,
  rainHash,
  validateWeatherFile,
  weatherFileName,
} from "../weather/weather_export_format.js";

// DevTools «ПОГОДА» (spec 172 stage A TK-261, rain controls TK-271, saving/export spec 175 TK-286): the weather
// model's state; rain, storm and fog switched on by hand with live strength sliders (a switched-on state freezes the
// weather's timers, so it stays until switched off; all off returns to the automatic weather); the wind's direction
// (automatic, left, calm, right); the transition time; a lightning strike now; the rain's look (CONFIG.canvas.rain,
// live), the location's weather settings (CONFIG.locations.map.<id>.weather, live), and saving via DevSavingSection.
const PRECIPITATION_LABELS = Object.freeze({
  clear: "ясно",
  rain: "дощ",
  storm: "гроза",
});
const FOG_LABELS = Object.freeze({ none: "немає", fog: "туман" });
const WIND_CHOICES = Object.freeze([
  Object.freeze({ label: "авто", direction: null }),
  Object.freeze({ label: "← вліво", direction: -1 }),
  Object.freeze({ label: "немає", direction: 0 }),
  Object.freeze({ label: "вправо →", direction: 1 }),
]);
const WIND_NAMES = Object.freeze({ "-1": "вліво", 0: "немає", 1: "вправо" });
const WIND_STATE_LABELS = Object.freeze({
  calm: "штиль",
  light: "слабкий",
  moderate: "середній",
  strong: "сильний",
});
const CHANCE_FIELDS = Object.freeze([
  Object.freeze(["Ясно (вага)", "clearWeight", ["precipitation", "clear", "weight"], 0, Infinity]),
  Object.freeze(["Дощ (вага)", "rainWeight", ["precipitation", "rain", "weight"], 0, Infinity]),
  Object.freeze(["Гроза (вага)", "stormWeight", ["precipitation", "storm", "weight"], 0, Infinity]),
  Object.freeze(["Туман (шанс 0…1)", "fogChance", ["fog", "chance"], 0, 1]),
  Object.freeze(["Штиль (вага)", "windCalmWeight", ["wind", "states", "calm", "weight"], 0, Infinity]),
  Object.freeze(["Слабкий вітер (вага)", "windLightWeight", ["wind", "states", "light", "weight"], 0, Infinity]),
  Object.freeze(["Середній вітер (вага)", "windModerateWeight", ["wind", "states", "moderate", "weight"], 0, Infinity]),
  Object.freeze(["Сильний вітер (вага)", "windStrongWeight", ["wind", "states", "strong", "weight"], 0, Infinity]),
]);
const PART_LABELS = Object.freeze({
  rain: "Вигляд дощу",
  locationWeather: "Параметри локації",
});

const percent = (value) => `${Math.round((Number(value) || 0) * 100)}%`;
const seconds = (value) => `${Math.round(Number(value) || 0)} с`;
const readNested = (object, segments) => {
  let cursor = object;
  for (const seg of segments) cursor = cursor?.[seg];
  return cursor;
};

export class WeatherDevSection {
  #ui;
  #weather;
  #config;
  #locationConfig;
  #locationsMap;
  #rainConfig;
  #createSection;
  #renderConfigTree;
  #updateConfig;
  #getBaseRain;
  #getBaseLocationWeather;
  #resetWeather;
  #gameVersion;
  #now;
  #savingSection;
  #content = null;
  #selectedLocationId = null;
  #listening = false;
  #rain = 70;
  #storm = 80;
  #fog = 60;
  #windStrength = 40;
  #fadeSec = 5;
  #onConfigUpdated = (event) => {
    if (!this.#savingSection.hasStatusElement) return;
    const path = event?.detail?.path;
    if (!Array.isArray(path) || path[0] !== "CONFIG") return;
    const isRain = path[1] === "canvas" && path[2] === "rain";
    const isLocation =
      path[1] === "locations" &&
      path[2] === "map" &&
      path[3] === this.#locationId() &&
      path[4] === "weather";
    if (isRain || isLocation) this.#savingSection.refreshStatus();
  };

  // weather: { getModel(), getWind(), setWind(dir | null), setWindStrength(0..1 | null), triggerWindGust(), locationId };
  // config: () => active location's weather; locationConfig(id): () => chosen location's weather;
  // locationsMap(): () => CONFIG.locations.map.
  constructor({
    ui,
    weather,
    config,
    locationConfig = null,
    locationsMap = null,
    rainConfig = () => null,
    createSection,
    renderConfigTree,
    updateConfig = null,
    files = null,
    getBaseRain = null,
    getBaseLocationWeather = null,
    resetWeather = null,
    gameVersion = "",
    now = () => new Date(),
  }) {
    this.#ui = ui;
    this.#weather = weather;
    this.#config = config;
    this.#locationConfig = locationConfig;
    this.#locationsMap = locationsMap;
    this.#rainConfig = rainConfig;
    this.#createSection = createSection;
    this.#renderConfigTree = renderConfigTree;
    this.#updateConfig = updateConfig;
    this.#getBaseRain = getBaseRain;
    this.#getBaseLocationWeather = getBaseLocationWeather;
    this.#resetWeather = resetWeather;
    this.#gameVersion = gameVersion;
    this.#now = now;
    this.#selectedLocationId = weather?.locationId ?? null;
    this.#savingSection = new DevSavingSection({
      ui,
      files,
      commandPrefix: "npm run apply:weather",
      useTextStatus: true,
      hasReset: Boolean(resetWeather),
      labels: {
        statusLabel: "Стан погоди",
        exportLabel: "Експорт погоди",
        importLabel: "Імпорт погоди",
        resetLabel: "Скинути зміни погоди до коду",
        description:
          "Експорт погоди завантажує файл вигляду дощу й погоди вибраної локації. У код зміни переносить команда npm run apply:weather -- <файл> (перевірка, конфлікти, підтвердження, бекап); після неї перезавантажте сторінку або скиньте зміни погоди до коду. Імпорт погоди відкриває такий файл тут, щоб продовжити редагування. Без експорту зміни зникають при перезавантаженні.",
      },
      readStatus: () => this.#readSavingStatus(),
      buildExport: (hashText) => this.#buildExport(hashText),
      onImport: (file, setStatus) => this.#applyImport(file, setStatus),
      onReset: () => {
        this.#resetWeather(this.#locationId());
        this.#fill();
      },
    });
  }

  render(parent) {
    this.#content = this.#createSection("ПОГОДА", parent, ["WEATHER"]);
    if (
      !this.#listening &&
      typeof document !== "undefined" &&
      document?.addEventListener
    ) {
      document.addEventListener("config-updated", this.#onConfigUpdated);
      this.#listening = true;
    }
    this.#fill();
  }

  dispose() {
    if (
      this.#listening &&
      typeof document !== "undefined" &&
      document?.removeEventListener
    ) {
      document.removeEventListener("config-updated", this.#onConfigUpdated);
    }
    this.#listening = false;
    this.#savingSection.clear();
    this.#content = null;
  }

  #locationId() {
    const map = this.#locationsMap?.();
    if (this.#selectedLocationId && map?.[this.#selectedLocationId]?.weather) {
      return this.#selectedLocationId;
    }
    return this.#weather.locationId;
  }

  #locationWeather(id = this.#locationId()) {
    return this.#locationConfig?.(id) ?? this.#config();
  }

  #locationChoices() {
    const map = this.#locationsMap?.();
    if (!map || typeof map !== "object") return [this.#weather.locationId];
    const ids = Object.keys(map).filter((id) => map[id]?.weather);
    return ids.length ? ids : [this.#weather.locationId];
  }

  #renderLocationSelector(content) {
    const choices = this.#locationChoices();
    if (!choices.length) return;
    const currentId = this.#locationId();
    const row = this.#createSection("Локація", content, ["WEATHER", "location"]);
    const onSelect = (nextId) => {
      this.#selectedLocationId = nextId;
      this.#fill();
    };
    if (this.#ui.createChoiceRow) {
      this.#ui.createChoiceRow(
        "локація",
        choices,
        currentId,
        row,
        onSelect,
        ["WEATHER", "location", "id"],
      );
    } else {
      this.#ui.createSelectRow?.(
        "локація",
        choices,
        currentId,
        row,
        onSelect,
        ["WEATHER", "location", "id"],
      );
    }
    if (currentId !== this.#weather.locationId) {
      this.#ui.createInfoRow(
        "активна у грі",
        `${this.#weather.locationId} (нижче редагується ${currentId})`,
        row,
      );
    }
  }

  #renderChances(settings, targetId, content) {
    if (!settings) return;
    const section = this.#createSection("Шанси погоди", content, [
      "WEATHER",
      "chances",
    ]);
    for (const [label, key, segments, min, max] of CHANCE_FIELDS) {
      const value = readNested(settings, segments);
      if (typeof value !== "number") continue;
      const cfgPath = ["CONFIG", "locations", "map", targetId, "weather", ...segments];
      this.#ui.createInputRow(
        label,
        value,
        section,
        "number",
        (rawValue) => {
          const parsed = Number(rawValue);
          if (!Number.isFinite(parsed)) return;
          const clamped = Math.max(min, Math.min(max, parsed));
          this.#updateConfig?.(cfgPath, clamped);
          this.#ui.syncValue?.(cfgPath, clamped);
        },
        ["WEATHER", "chances", key],
        cfgPath,
      );
    }
  }

  #fill() {
    const content = this.#content;
    if (!content) return;
    this.#ui.releaseValueBindings?.(content);
    content.replaceChildren();
    this.#savingSection.clear();
    const model = this.#weather.getModel();
    if (!model) {
      this.#ui.createInfoRow("стан", "погода не створена", content);
      return;
    }
    this.#renderStatus(model.snapshot, content);
    this.#renderControls(model, content);
    const rain = this.#rainConfig();
    if (rain) {
      this.#renderConfigTree(
        rain,
        this.#createSection("Вигляд дощу", content, ["WEATHER", "rain"]),
        ["CONFIG", "canvas", "rain"],
      );
    }
    this.#renderLocationSelector(content);
    const targetId = this.#locationId();
    const settings = this.#locationWeather(targetId);
    if (settings) {
      this.#renderChances(settings, targetId, content);
      this.#renderConfigTree(
        settings,
        this.#createSection("Параметри локації", content, [
          "WEATHER",
          "config",
        ]),
        ["CONFIG", "locations", "map", targetId, "weather"],
      );
    }
    this.#savingSection.render(
      this.#createSection("Збереження", content, ["WEATHER", "saving"]),
    );
  }

  #readSavingStatus() {
    const id = this.#locationId();
    const liveRain = this.#rainConfig(),
      liveWeather = this.#locationWeather(id);
    const baseRain = this.#getBaseRain?.(),
      baseWeather = this.#getBaseLocationWeather?.(id);
    if (!liveRain || !liveWeather || !baseRain || !baseWeather)
      return "Параметри погоди завантажено.";
    const changed = changedWeatherParts(
      baseRain,
      liveRain,
      baseWeather,
      liveWeather,
    );
    return changed.length
      ? `Змінено (ще не в коді): ${changed.map((part) => PART_LABELS[part] ?? part).join(", ")}.`
      : "Погода збігається з кодом.";
  }

  async #buildExport(hashText) {
    const id = this.#locationId();
    const liveRain = this.#rainConfig(),
      liveWeather = this.#locationWeather(id);
    if (!liveRain || !liveWeather)
      return { error: "Немає параметрів погоди для експорту." };
    const baseRain = this.#getBaseRain?.() ?? liveRain;
    const baseWeather = this.#getBaseLocationWeather?.(id) ?? liveWeather;
    const moment = this.#now();
    return {
      fileName: weatherFileName(id, this.#gameVersion, moment),
      data: buildWeatherFile({
        locationId: id,
        rain: liveRain,
        locationWeather: liveWeather,
        rainBaseHash: await rainHash(baseRain, hashText),
        locationWeatherBaseHash: await locationWeatherHash(
          baseWeather,
          hashText,
        ),
        gameVersion: this.#gameVersion,
        exportedAt: moment.toISOString(),
      }),
    };
  }

  #applyImport(file, setStatus) {
    const id = this.#locationId();
    if (file?.locationId && file.locationId !== id) {
      setStatus(`Файл для локації ${file.locationId}; зараз відкрито ${id}.`);
      return;
    }
    const errors = validateWeatherFile(file, {
      rainTemplate: this.#getBaseRain?.() ?? this.#rainConfig(),
      locationWeatherTemplate:
        this.#getBaseLocationWeather?.(id) ?? this.#locationWeather(id),
    });
    if (errors.length) {
      setStatus(`Файл не прийнято: ${errors.slice(0, 3).join("; ")}`);
      return;
    }
    this.#updateConfig?.(
      ["CONFIG", "canvas", "rain"],
      canonicalRain(file.rain),
    );
    this.#updateConfig?.(
      ["CONFIG", "locations", "map", id, "weather"],
      canonicalLocationWeather(file.locationWeather),
    );
    this.#fill();
  }

  #renderStatus(weather, content) {
    const wind = this.#weather.getWind?.() ?? null;
    this.#ui.createInfoRow(
      "опади",
      `${PRECIPITATION_LABELS[weather.precipitation] ?? weather.precipitation} · ${
        weather.frozen
          ? "вручну"
          : `ще ${seconds(weather.precipitationLeftSec)}`
      }`,
      content,
    );
    this.#ui.createInfoRow(
      "дощ",
      `${percent(weather.rain)} → ${percent(weather.rainTarget)}`,
      content,
    );
    this.#ui.createInfoRow(
      "гроза",
      `${percent(weather.storm)} → ${percent(weather.stormTarget)}`,
      content,
    );
    this.#ui.createInfoRow(
      "туман",
      `${FOG_LABELS[weather.fogState] ?? weather.fogState} · ${percent(weather.fog)} → ${percent(
        weather.fogTarget,
      )}`,
      content,
    );
    const windText = wind
      ? `${WIND_NAMES[wind.direction] ?? wind.direction}${
          wind.state && wind.direction !== 0
            ? ` · ${WIND_STATE_LABELS[wind.state] ?? wind.state}`
            : ""
        }${wind.isGusting ? " (порив)" : ""}${wind.forced ? " (вручну)" : ""}`
      : "—";
    this.#ui.createInfoRow("вітер", windText, content);
    const windStrength = Number.isFinite(Number(wind?.strength))
      ? Number(wind.strength)
      : wind?.direction
        ? 1
        : 0;
    const windTarget = Number.isFinite(Number(wind?.targetStrength))
      ? Number(wind.targetStrength)
      : windStrength;
    this.#ui.createInfoRow(
      "сила вітру",
      wind
        ? `${percent(windStrength)} → ${percent(windTarget)}${wind.isGusting ? " (порив)" : ""}${wind.forcedStrength != null ? " (вручну)" : ""}`
        : "—",
      content,
    );
    this.#ui.createInfoRow(
      "блискавки",
      `${weather.strikeSerial} · остання: варіант ${weather.strikeVariant + 1}, відстань ${percent(
        weather.strikeDistance,
      )}`,
      content,
    );
    this.#ui.createButtonRow("↻ Оновити", content, () => this.#fill());
  }

  #renderControls(model, content) {
    const weather = model.snapshot;
    const controls = this.#createSection("Керування", content, [
      "WEATHER",
      "controls",
    ]);
    const raining = weather.precipitation !== "clear";
    this.#ui.createSwitcherRow(
      "🌧 Дощ",
      raining,
      controls,
      (on) => {
        if (on) this.#hold(model, "precipitation", "rain", this.#rain);
        else this.#release(model, "precipitation", "clear");
      },
      ["WEATHER", "controls", "rain"],
    );
    this.#ui.createRangeRow(
      "сила дощу, %",
      this.#rain,
      controls,
      (value) => {
        this.#rain = Number(value) || 0;
        if (model.snapshot.precipitation !== "clear")
          model.setIntensity("rain", this.#rain / 100);
      },
      ["WEATHER", "controls", "rainStrength"],
    );
    this.#ui.createSwitcherRow(
      "⛈ Гроза",
      weather.precipitation === "storm",
      controls,
      (on) => {
        if (on) this.#hold(model, "precipitation", "storm", this.#storm);
        else this.#hold(model, "precipitation", "rain", this.#rain);
      },
      ["WEATHER", "controls", "storm"],
    );
    this.#ui.createRangeRow(
      "сила грози, %",
      this.#storm,
      controls,
      (value) => {
        this.#storm = Number(value) || 0;
        if (model.snapshot.precipitation === "storm")
          model.setIntensity("storm", this.#storm / 100);
      },
      ["WEATHER", "controls", "stormStrength"],
    );
    this.#ui.createSwitcherRow(
      "🌫 Туман",
      weather.fogState === "fog",
      controls,
      (on) => {
        if (on) this.#hold(model, "fog", "fog", this.#fog);
        else this.#release(model, "fog", "none");
      },
      ["WEATHER", "controls", "fog"],
    );
    this.#ui.createRangeRow(
      "сила туману, %",
      this.#fog,
      controls,
      (value) => {
        this.#fog = Number(value) || 0;
        if (model.snapshot.fogState === "fog")
          model.setIntensity("fog", this.#fog / 100);
      },
      ["WEATHER", "controls", "fogStrength"],
    );
    if (this.#weather.setWind) {
      const wind = this.#weather.getWind?.() ?? null;
      const current =
        WIND_CHOICES.find(
          (choice) => wind?.forced && choice.direction === wind.direction,
        ) ?? WIND_CHOICES[0];
      this.#ui.createSelectRow(
        "напрям вітру",
        WIND_CHOICES.map((choice) => choice.label),
        current.label,
        controls,
        (label) => {
          this.#weather.setWind(
            WIND_CHOICES.find((choice) => choice.label === label)?.direction ??
              null,
          );
          this.#fill();
        },
        ["WEATHER", "controls", "windDirection"],
      );
    }
    if (this.#weather.setWindStrength) {
      const wind = this.#weather.getWind?.() ?? null;
      const heldStrength = wind?.forcedStrength != null;
      if (heldStrength) {
        this.#windStrength = Math.round(Number(wind.forcedStrength) * 100);
      }
      this.#ui.createSwitcherRow(
        "💨 Ручна сила вітру",
        heldStrength,
        controls,
        (on) => {
          this.#weather.setWindStrength(on ? this.#windStrength / 100 : null);
          this.#fill();
        },
        ["WEATHER", "controls", "windStrengthHold"],
      );
      this.#ui.createRangeRow(
        "сила вітру, %",
        this.#windStrength,
        controls,
        (value) => {
          this.#windStrength = Math.max(0, Math.min(100, Number(value) || 0));
          this.#weather.setWindStrength(this.#windStrength / 100);
          this.#ui.syncValue?.(["WEATHER", "controls", "windStrengthHold"], true);
        },
        ["WEATHER", "controls", "windStrength"],
      );
    }
    if (this.#weather.triggerWindGust) {
      this.#ui.createButtonRow(
        "🌬 Порив вітру зараз",
        controls,
        () => {
          this.#weather.triggerWindGust();
          this.#fill();
        },
        false,
        "",
        ["WEATHER", "controls", "gust"],
      );
    }
    this.#ui.createInputRow(
      "перехід, с",
      this.#fadeSec,
      controls,
      "number",
      (value) => {
        this.#fadeSec = Math.max(0, Number(value) || 0);
      },
    );
    this.#ui.createButtonRow(
      "⚡ Удар блискавки зараз",
      controls,
      () => {
        model.strike();
        this.#fill();
      },
      false,
      "",
      ["WEATHER", "controls", "strike"],
    );
    this.#ui.createSwitcherRow(
      "заморозити погоду",
      weather.frozen === true,
      controls,
      (frozen) => {
        model.setFrozen(frozen);
        this.#fill();
      },
      ["WEATHER", "frozen"],
    );
    this.#ui.createButtonRow("↺ Автоматична погода", controls, () => {
      model.setFrozen(false);
      this.#weather.setWind?.(null);
      this.#weather.setWindStrength?.(null);
      this.#fill();
    });
  }

  // A state switched on by hand: forced with its slider's strength and held (the weather's timers stop).
  #hold(model, process, state, strength) {
    model.force(process, state, {
      intensity: strength / 100,
      fadeSec: this.#fadeSec,
    });
    model.setFrozen(true);
    this.#fill();
  }

  // Switched off: the state ends with the transition time; with nothing else held, the weather runs on its own again.
  #release(model, process, state) {
    model.force(process, state, { fadeSec: this.#fadeSec });
    const weather = model.snapshot;
    if (weather.precipitation === "clear" && weather.fogState === "none")
      model.setFrozen(false);
    this.#fill();
  }
}
