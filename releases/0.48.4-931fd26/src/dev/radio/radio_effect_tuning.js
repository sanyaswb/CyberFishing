// DEV (TK-098, TK-099): the radio's sound parts tuned in its editor next to the volume: a switch per part (vinyl,
// walkie-talkie, the signal's interference) and sliders for the main parameters of the parts that are on. Writes go to
// the live configuration through the same config runtime as DevTools, so both show one value. Production composes no
// tuning port: the player never controls the sound quality.
const GROUPS = Object.freeze([
  Object.freeze({ group: "vinyl", label: "Платівка", path: Object.freeze(["effects", "vinyl"]), parameters: Object.freeze([
    Object.freeze({ key: "crackleLevel", label: "Платівка · тріск", min: 0, max: 0.5, step: 0.01 }),
    Object.freeze({ key: "popLevel", label: "Платівка · клацання", min: 0, max: 1, step: 0.01 }),
    Object.freeze({ key: "hissLevel", label: "Платівка · шипіння", min: 0, max: 0.05, step: 0.001 }),
    Object.freeze({ key: "wowDepthMs", label: "Платівка · похитування, мс", min: 0, max: 4, step: 0.1 }),
    Object.freeze({ key: "warmthGainDb", label: "Платівка · тепло, дБ", min: 0, max: 8, step: 0.5 }),
    Object.freeze({ key: "mix", label: "Платівка · мікс", min: 0, max: 1, step: 0.05 }),
  ]) }),
  Object.freeze({ group: "walkieTalkie", label: "Рація", path: Object.freeze(["effects", "walkieTalkie"]),
    parameters: Object.freeze([
      Object.freeze({ key: "drive", label: "Рація · хрип", min: 0, max: 40, step: 1 }),
      Object.freeze({ key: "lowpassHz", label: "Рація · верхи, Гц", min: 1500, max: 6000, step: 100 }),
      Object.freeze({ key: "highpassHz", label: "Рація · низи, Гц", min: 200, max: 1200, step: 50 }),
      Object.freeze({ key: "mix", label: "Рація · мікс", min: 0, max: 1, step: 0.05 }),
    ]) }),
  Object.freeze({ group: "signal", label: "Перешкоди сигналу", path: Object.freeze(["signal"]), parameters: Object.freeze([
    Object.freeze({ key: "baseNoise", label: "Перешкоди · шипіння", min: 0, max: 0.05, step: 0.001 }),
    Object.freeze({ key: "rainNoise", label: "Перешкоди · дощ", min: 0, max: 0.3, step: 0.01 }),
    Object.freeze({ key: "maxNoise", label: "Перешкоди · слабка батарейка", min: 0, max: 0.6, step: 0.01 }),
    Object.freeze({ key: "dropoutMax", label: "Перешкоди · розриви", min: 0, max: 1, step: 0.05 }),
    Object.freeze({ key: "lowChargePercent", label: "Перешкоди · поріг заряду, %", min: 0, max: 60, step: 1 }),
  ]) }),
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
    return GROUPS.map(({ group, label }) => ({ group, label, enabled: this.#settings(group)?.enabled === true }));
  }

  setEnabled(group, enabled) {
    const entry = GROUPS.find((candidate) => candidate.group === group);
    if (entry) this.#configRuntime.set(["CONFIG", "radio", ...entry.path, "enabled"], enabled === true);
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

  #settings(group) {
    const entry = GROUPS.find((candidate) => candidate.group === group);
    let value = this.#config() || {};
    for (const part of entry?.path || []) value = value?.[part];
    return value;
  }
}
