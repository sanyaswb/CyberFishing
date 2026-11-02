import { finiteOr } from "../../../engine/math/number_normalization.js";

// Spec 142 / TK-097: the "walkie-talkie" stage of the radio's effects chain. Wet path: high-pass -> low-pass -> peaking
// -> WaveShaper (f(x) = (3 + k)·x·20° / (π + k·|x|), oversampled) -> make-up gain 1 / f(1) x outputGain; a dry path in
// parallel. update(settings) applies CONFIG.radio.effects.walkieTalkie live (only changed values are written); the
// enabled flag and mix ramp the dry/wet gains (setTargetAtTime) and never jump.
export class WalkieTalkieRack {
  static CURVE_LENGTH = 44100;
  #context = null;
  #nodes = null;
  #applied = {};

  static curve(drive, length = WalkieTalkieRack.CURVE_LENGTH) {
    const k = Math.max(0, Number(drive) || 0);
    const degree = Math.PI / 180;
    const curve = new Float32Array(length);
    for (let index = 0; index < length; index += 1) {
      const x = (index * 2) / (length - 1) - 1;
      curve[index] = ((3 + k) * x * 20 * degree) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  // The level of a full-scale input after the curve: the make-up gain is its inverse.
  static peak(drive) {
    const k = Math.max(0, Number(drive) || 0);
    return ((3 + k) * 20 * (Math.PI / 180)) / (Math.PI + k);
  }

  get input() {
    return this.#nodes?.input || null;
  }

  get output() {
    return this.#nodes?.output || null;
  }

  // Builds the stage on a context; update(settings) then sets its values.
  build(context) {
    this.#context = context;
    const input = context.createGain();
    const output = context.createGain();
    const dry = context.createGain();
    const wet = context.createGain();
    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    const peaking = context.createBiquadFilter();
    peaking.type = "peaking";
    const shaper = context.createWaveShaper();
    const makeup = context.createGain();
    input.connect(dry);
    dry.connect(output);
    input.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(peaking);
    peaking.connect(shaper);
    shaper.connect(makeup);
    makeup.connect(wet);
    wet.connect(output);
    dry.gain.value = 1;
    wet.gain.value = 0;
    this.#nodes = { input, output, dry, wet, highpass, lowpass, peaking, shaper, makeup };
    this.#applied = {};
    return this;
  }

  update(settings = {}, rampSeconds = 0.03) {
    const nodes = this.#nodes;
    if (!nodes) return;
    const drive = finiteOr(settings.drive, 18);
    this.#param("highpassHz", nodes.highpass.frequency, finiteOr(settings.highpassHz, 500));
    this.#param("lowpassHz", nodes.lowpass.frequency, finiteOr(settings.lowpassHz, 3000));
    this.#param("peakHz", nodes.peaking.frequency, finiteOr(settings.peakHz, 1800));
    this.#param("peakGainDb", nodes.peaking.gain, finiteOr(settings.peakGainDb, 8));
    this.#param("peakQ", nodes.peaking.Q, finiteOr(settings.peakQ, 2.5));
    if (this.#applied.drive !== drive) {
      nodes.shaper.curve = WalkieTalkieRack.curve(drive);
      this.#applied.drive = drive;
    }
    const oversample = settings.oversample || "4x";
    if (this.#applied.oversample !== oversample) {
      nodes.shaper.oversample = oversample;
      this.#applied.oversample = oversample;
    }
    const makeup = (1 / Math.max(1e-6, WalkieTalkieRack.peak(drive))) * Math.max(0, finiteOr(settings.outputGain, 1));
    this.#param("makeup", nodes.makeup.gain, makeup);
    const mix = settings.enabled === false ? 0 : Math.max(0, Math.min(1, finiteOr(settings.mix, 1)));
    this.#ramp("mix", nodes.wet.gain, nodes.dry.gain, mix, rampSeconds);
  }

  dispose() {
    for (const node of Object.values(this.#nodes || {})) node.disconnect?.();
    this.#nodes = null;
    this.#context = null;
    this.#applied = {};
  }

  #param(key, param, value) {
    if (this.#applied[key] === value) return;
    param.value = value;
    this.#applied[key] = value;
  }

  // The first value is set at once (a new stage starts in place); later ones ease, so a switch never clicks.
  #ramp(key, wetParam, dryParam, mix, rampSeconds) {
    if (this.#applied[key] === mix) return;
    if (this.#applied[key] === undefined) {
      wetParam.value = mix;
      dryParam.value = 1 - mix;
    } else {
      const now = Number(this.#context?.currentTime) || 0;
      const constant = Math.max(0.001, Number(rampSeconds) || 0.03);
      wetParam.setTargetAtTime(mix, now, constant);
      dryParam.setTargetAtTime(1 - mix, now, constant);
    }
    this.#applied[key] = mix;
  }

}
