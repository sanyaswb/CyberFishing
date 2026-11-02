// DEV (TK-098..TK-100, TK-121): all radio sound parameters tuned in its editor next to the volume: a switch per part
// (vinyl, walkie-talkie, signal interference, «only stations with the effect») and sliders for all parameters of the
// parts that are on. Writes go to the live configuration through the same config runtime as DevTools, so both show one
// value. Production composes no tuning port: the player never controls the sound quality.
export const VINYL_SFX_TRACKS = Object.freeze([
  Object.freeze({ id: "vinyl-1", file: "vinyl-1.mp3", label: "vinyl-1 · Оберти 33⅓ (кліки)" }),
  Object.freeze({ id: "vinyl-2", file: "vinyl-2.mp3", label: "vinyl-2 · Текстура поверхні" }),
  Object.freeze({ id: "vinyl-3", file: "vinyl-3.mp3", label: "vinyl-3 · Шум та тріск борозенок" }),
  Object.freeze({ id: "vinyl-4", file: "vinyl-4.mp3", label: "vinyl-4 · Посадка голки (луп)" }),
  Object.freeze({ id: "vinyl-5", file: "vinyl-5.mp3", label: "vinyl-5 · Фоновий вініл (довгий)" }),
  Object.freeze({ id: "vinyl-6", file: "next_track-vinyl.mp3", label: "next_track-vinyl · Скрип канавки та голка" }),
]);

const GROUPS = Object.freeze([
  Object.freeze({
    group: "retro",
    label: "Ретро",
    path: Object.freeze(["effects", "retro"]),
    parameters: Object.freeze([
      Object.freeze({ key: "warmthGainDb", label: "Ретро · тепло, дБ", min: 0, max: 10, step: 0.5 }),
      Object.freeze({ key: "warmthHz", label: "Ретро · частота тепла, Гц", min: 50, max: 600, step: 10 }),
      Object.freeze({ key: "presenceGainDb", label: "Ретро · присутність, дБ", min: 0, max: 8, step: 0.5 }),
      Object.freeze({ key: "presenceHz", label: "Ретро · частота присутності, Гц", min: 800, max: 5000, step: 100 }),
      Object.freeze({ key: "presenceQ", label: "Ретро · присутність (добротність Q)", min: 0.2, max: 5, step: 0.1 }),
      Object.freeze({ key: "lowpassHz", label: "Ретро · зріз верхів, Гц", min: 1000, max: 22000, step: 500 }),
      Object.freeze({ key: "highpassHz", label: "Ретро · зріз низів, Гц", min: 10, max: 300, step: 5 }),
      Object.freeze({ key: "drive", label: "Ретро · сатурація", min: 0, max: 6, step: 0.1 }),
      Object.freeze({ key: "outputGain", label: "Ретро · вихідне підсилення", min: 0, max: 2, step: 0.05 }),
      Object.freeze({ key: "mix", label: "Ретро · мікс", min: 0, max: 1, step: 0.05 }),
    ]),
  }),
  Object.freeze({
    group: "vinyl",
    label: "Платівка",
    path: Object.freeze(["effects", "vinyl"]),
    parameters: Object.freeze([
      Object.freeze({ key: "rumbleLevel", label: "Платівка · Д1 гул механіки (10-60 Гц)", min: 0, max: 1, step: 0.02 }),
      Object.freeze({ key: "surfaceLevel", label: "Платівка · Д1 шум поверхні (300-8к Гц)", min: 0, max: 1, step: 0.02 }),
      Object.freeze({ key: "crackleLevel", label: "Платівка · Д2 дрібний тріск (2-8 кГц)", min: 0, max: 1, step: 0.05 }),
      Object.freeze({ key: "popLevel", label: "Платівка · Д2 клацання подряпин (pops)", min: 0, max: 1, step: 0.05 }),
      Object.freeze({ key: "tonalWarmth", label: "Платівка · Д3 теплий EQ (зрізи 35Гц/13кГц, моно-бас)", min: 0, max: 10, step: 0.5 }),
      Object.freeze({ key: "saturation", label: "Платівка · Д3 асиметрична сатурація (2-га гармоніка)", min: 0, max: 10, step: 0.5 }),
      Object.freeze({ key: "innerGrooveDistortion", label: "Платівка · Д3 спотворення канавки (IGD/яблуко)", min: 0, max: 10, step: 0.5 }),
      Object.freeze({ key: "wowFlutter", label: "Платівка · Д3 детонація (wow 0.55 Гц + flutter)", min: 0, max: 10, step: 0.5 }),
      Object.freeze({ key: "cueOverlapSeconds", label: "Платівка · накладення голки, с", min: 0, max: 3, step: 0.1 }),
    ]),
  }),
  Object.freeze({
    group: "radio",
    label: "Радіо",
    path: Object.freeze(["effects", "radio"]),
    parameters: Object.freeze([
      Object.freeze({ key: "drive", label: "Радіо · хрип (сатурація)", min: 0, max: 50, step: 1 }),
      Object.freeze({ key: "tuning", label: "Радіо · розстроювання (detune)", min: 0, max: 1, step: 0.05 }),
      Object.freeze({ key: "noiseLevel", label: "Радіо · шум несучої", min: 0, max: 0.2, step: 0.01 }),
      Object.freeze({ key: "whistleLevel", label: "Радіо · свист гетеродина", min: 0, max: 0.05, step: 0.002 }),
      Object.freeze({ key: "peakGainDb", label: "Радіо · резонанс корпусу, дБ", min: 0, max: 15, step: 0.5 }),
      Object.freeze({ key: "peakHz", label: "Радіо · частота резонансу, Гц", min: 1000, max: 3500, step: 50 }),
      Object.freeze({ key: "lowpassHz", label: "Радіо · верхи (зріз 24дБ), Гц", min: 2000, max: 5000, step: 100 }),
      Object.freeze({ key: "highpassHz", label: "Радіо · низи (зріз 24дБ), Гц", min: 200, max: 1000, step: 25 }),
      Object.freeze({ key: "cueOverlapSeconds", label: "Радіо · накладення хвилі, с", min: 0, max: 3, step: 0.1 }),
      Object.freeze({ key: "outputGain", label: "Радіо · вихідне підсилення", min: 0, max: 2, step: 0.05 }),
      Object.freeze({ key: "mix", label: "Радіо · мікс", min: 0, max: 1, step: 0.05 }),
    ]),
  }),
  Object.freeze({
    group: "walkieTalkie",
    label: "Рація",
    path: Object.freeze(["effects", "walkieTalkie"]),
    parameters: Object.freeze([
      Object.freeze({ key: "drive", label: "Рація · хрип", min: 0, max: 40, step: 1 }),
      Object.freeze({ key: "lowpassHz", label: "Рація · верхи, Гц", min: 1500, max: 6000, step: 100 }),
      Object.freeze({ key: "highpassHz", label: "Рація · низи, Гц", min: 200, max: 1200, step: 50 }),
      Object.freeze({ key: "peakHz", label: "Рація · пік частота, Гц", min: 500, max: 4000, step: 50 }),
      Object.freeze({ key: "peakGainDb", label: "Рація · пік підсилення, дБ", min: 0, max: 18, step: 0.5 }),
      Object.freeze({ key: "peakQ", label: "Рація · пік добротність (Q)", min: 0.5, max: 6, step: 0.1 }),
      Object.freeze({ key: "outputGain", label: "Рація · вихідне підсилення", min: 0, max: 2, step: 0.05 }),
      Object.freeze({ key: "mix", label: "Рація · мікс", min: 0, max: 1, step: 0.05 }),
    ]),
  }),
  Object.freeze({
    group: "signal",
    label: "Перешкоди сигналу",
    path: Object.freeze(["signal"]),
    parameters: Object.freeze([
      Object.freeze({ key: "baseNoise", label: "Перешкоди · шипіння", min: 0, max: 0.05, step: 0.001 }),
      Object.freeze({ key: "maxNoise", label: "Перешкоди · шум при розряді", min: 0, max: 0.6, step: 0.01 }),
      Object.freeze({ key: "maxCrackle", label: "Перешкоди · тріск при розряді", min: 0, max: 15, step: 0.5 }),
      Object.freeze({ key: "maxVolumeSag", label: "Перешкоди · просідання гучності", min: 0, max: 1, step: 0.05 }),
      Object.freeze({ key: "dropoutMax", label: "Перешкоди · розриви", min: 0, max: 1, step: 0.05 }),
      Object.freeze({ key: "lowChargePercent", label: "Перешкоди · поріг заряду, %", min: 0, max: 60, step: 1 }),
    ]),
  }),
  Object.freeze({
    group: "weather",
    label: "Погодні перешкоди",
    path: Object.freeze(["signal", "weather"]),
    parameters: Object.freeze([
      Object.freeze({ key: "rainNoise", label: "Дощ · шум", min: 0, max: 0.5, step: 0.01 }),
      Object.freeze({ key: "rainCrackle", label: "Дощ · тріск", min: 0, max: 15, step: 0.5 }),
      Object.freeze({ key: "rainMultMax", label: "Дощ · множник інтенсивності", min: 1, max: 5, step: 0.1 }),
    ]),
  }),
  // TK-100: a plain flag (CONFIG.radio.onlyEffectStations), no sliders.
  Object.freeze({
    group: "onlyEffectStations",
    label: "Лише станції з ефектом",
    flag: true,
    path: Object.freeze(["onlyEffectStations"]),
    parameters: Object.freeze([]),
  }),
]);

export class RadioEffectTuning {
  #config;
  #configRuntime;

  // config: () => CONFIG.radio (live); configRuntime: the DEV config runtime ({ set(path, value) }).
  constructor({ config, configRuntime }) {
    this.#config = config;
    this.#configRuntime = configRuntime;
  }

  // [{ group, label, enabled }]: one switch per sound part.
  groups() {
    return GROUPS.map(({ group, label, flag }) => ({ group, label,
      enabled: flag ? this.#settings(group) === true : this.#settings(group)?.enabled === true }));
  }

  isFlag(group) {
    return GROUPS.find((candidate) => candidate.group === group)?.flag === true;
  }

  setEnabled(group, enabled) {
    const entry = GROUPS.find((candidate) => candidate.group === group);
    if (entry) this.#configRuntime.set(["CONFIG", "radio", ...entry.path, ...(entry.flag ? [] : ["enabled"])], enabled === true);
  }

  // [{ effect, key, label, min, max, step, value }] for the parts that are on.
  list() {
    const entries = [];
    for (const { group, parameters } of GROUPS) {
      const settings = this.#settings(group);
      if (settings?.enabled !== true) continue;
      for (const parameter of parameters) {
        const value = Number(settings[parameter.key]);
        entries.push({ effect: group, ...parameter, value: Number.isFinite(value) ? value : parameter.min });
      }
    }
    return entries;
  }

  set(effect, key, value) {
    const entry = GROUPS.find((candidate) => candidate.group === effect);
    if (!entry?.parameters.some((parameter) => parameter.key === key)) return;
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    this.#configRuntime.set(["CONFIG", "radio", ...entry.path, key], number);
  }

  getVinylSfxList() {
    const sfx = this.#settings("vinyl")?.sfx || {};
    return VINYL_SFX_TRACKS.map((track) => ({
      id: track.id,
      file: track.file,
      label: track.label,
      enabled: sfx[track.id]?.enabled === true,
      volume: Number.isFinite(Number(sfx[track.id]?.volume)) ? Number(sfx[track.id].volume) : 0.5,
    }));
  }

  setVinylSfxEnabled(id, enabled) {
    this.#configRuntime.set(["CONFIG", "radio", "effects", "vinyl", "sfx", id, "enabled"], enabled === true);
  }

  setVinylSfxVolume(id, volume) {
    const number = Number(volume);
    if (!Number.isFinite(number)) return;
    this.#configRuntime.set(["CONFIG", "radio", "effects", "vinyl", "sfx", id, "volume"], number);
  }

  #settings(group) {
    const entry = GROUPS.find((candidate) => candidate.group === group);
    let value = this.#config() || {};
    for (const part of entry?.path || []) value = value?.[part];
    if (group === "weather" && !value && this.#config()?.signal) {
      return this.#config().signal;
    }
    return value;
  }
}
