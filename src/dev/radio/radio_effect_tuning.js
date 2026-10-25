// DEV (TK-098): the main parameters of the radio's enabled sound effects, tuned with sliders in the radio's editor next
// to the volume. Writes go to the live configuration through the same config runtime as DevTools, so both show one
// value. Production composes no tuning port: the player never controls the sound quality.
const PARAMETERS = Object.freeze({
  vinyl: Object.freeze([
    Object.freeze({ key: "crackleLevel", label: "Платівка · тріск", min: 0, max: 0.5, step: 0.01 }),
    Object.freeze({ key: "popLevel", label: "Платівка · клацання", min: 0, max: 1, step: 0.01 }),
    Object.freeze({ key: "hissLevel", label: "Платівка · шипіння", min: 0, max: 0.05, step: 0.001 }),
    Object.freeze({ key: "wowDepthMs", label: "Платівка · похитування, мс", min: 0, max: 4, step: 0.1 }),
    Object.freeze({ key: "warmthGainDb", label: "Платівка · тепло, дБ", min: 0, max: 8, step: 0.5 }),
    Object.freeze({ key: "mix", label: "Платівка · мікс", min: 0, max: 1, step: 0.05 }),
  ]),
  walkieTalkie: Object.freeze([
    Object.freeze({ key: "drive", label: "Рація · хрип", min: 0, max: 40, step: 1 }),
    Object.freeze({ key: "lowpassHz", label: "Рація · верхи, Гц", min: 1500, max: 6000, step: 100 }),
    Object.freeze({ key: "highpassHz", label: "Рація · низи, Гц", min: 200, max: 1200, step: 50 }),
    Object.freeze({ key: "mix", label: "Рація · мікс", min: 0, max: 1, step: 0.05 }),
  ]),
});

export class RadioEffectTuning {
  #config;
  #configRuntime;

  // config: () => CONFIG.radio.effects (live); configRuntime: the DEV config runtime ({ set(path, value) }).
  constructor({ config, configRuntime }) {
    this.#config = config;
    this.#configRuntime = configRuntime;
  }

  // [{ effect, key, label, min, max, step, value }] for the enabled effects only.
  list() {
    const effects = this.#config() || {};
    const entries = [];
    for (const [effect, parameters] of Object.entries(PARAMETERS)) {
      if (effects[effect]?.enabled !== true) continue;
      for (const parameter of parameters) {
        const value = Number(effects[effect][parameter.key]);
        entries.push({ effect, ...parameter, value: Number.isFinite(value) ? value : parameter.min });
      }
    }
    return entries;
  }

  set(effect, key, value) {
    if (!PARAMETERS[effect]?.some((parameter) => parameter.key === key)) return;
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    this.#configRuntime.set(["CONFIG", "radio", "effects", effect, key], number);
  }
}
