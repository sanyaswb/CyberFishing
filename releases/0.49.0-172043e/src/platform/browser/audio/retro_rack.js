import { finiteOr } from "../../../engine/math/number_normalization.js";

// Spec 145 / TK-124: the "retro sound" stage of the radio's effects chain.
// Authentic warm vintage broadcast sound: warm tube body, presence, gentle low/high rolloff,
// and soft analog saturation (never walkie-talkie bandpass/overdrive, never vinyl crackle).
// Wet path: highpass (80 Hz) -> warmth lowshelf (220 Hz) -> presence peaking (2000 Hz) ->
// lowpass (6000 Hz) -> WaveShaper (soft tape/tube saturation) -> makeup -> wet; dry path in parallel.
export class RetroRack {
  static CURVE_LENGTH = 44100;
  #context = null;
  #nodes = null;
  #applied = {};

  // Soft analog saturation curve (smooth sigmoid, gentle harmonic warmth).
  static curve(drive, length = RetroRack.CURVE_LENGTH) {
    const k = Number(drive) || 0;
    const curve = new Float32Array(length);
    if (k <= 0) {
      for (let index = 0; index < length; index += 1) {
        curve[index] = (index * 2) / (length - 1) - 1;
      }
      return curve;
    }
    const norm = Math.tanh(k);
    for (let index = 0; index < length; index += 1) {
      const x = (index * 2) / (length - 1) - 1;
      curve[index] = Math.tanh(k * x) / norm;
    }
    return curve;
  }

  static peak(_drive = 2) {
    return 1.0;
  }

  get input() {
    return this.#nodes?.input || null;
  }

  get output() {
    return this.#nodes?.output || null;
  }

  build(context) {
    this.#context = context;
    const input = context.createGain();
    const output = context.createGain();
    const dry = context.createGain();
    const wet = context.createGain();

    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    const warmth = context.createBiquadFilter();
    warmth.type = "lowshelf";
    const presence = context.createBiquadFilter();
    presence.type = "peaking";
    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    const shaper = context.createWaveShaper();
    const makeup = context.createGain();

    input.connect(dry);
    dry.connect(output);

    input.connect(highpass);
    highpass.connect(warmth);
    warmth.connect(presence);
    presence.connect(lowpass);
    lowpass.connect(shaper);
    shaper.connect(makeup);
    makeup.connect(wet);
    wet.connect(output);

    dry.gain.value = 1;
    wet.gain.value = 0;

    this.#nodes = { input, output, dry, wet, highpass, warmth, presence, lowpass, shaper, makeup };
    this.#applied = {};
    return this;
  }

  update(settings = {}, rampSeconds = 0.03) {
    const nodes = this.#nodes;
    if (!nodes) return;

    const drive = Math.max(0, finiteOr(settings.drive, 2));
    this.#param("highpassHz", nodes.highpass.frequency, finiteOr(settings.highpassHz, 80));
    this.#param("warmthHz", nodes.warmth.frequency, finiteOr(settings.warmthHz, 220));
    this.#param("warmthGainDb", nodes.warmth.gain, finiteOr(settings.warmthGainDb, 3.5));
    this.#param("presenceHz", nodes.presence.frequency, finiteOr(settings.presenceHz, 2000));
    this.#param("presenceGainDb", nodes.presence.gain, finiteOr(settings.presenceGainDb, 2));
    this.#param("presenceQ", nodes.presence.Q, finiteOr(settings.presenceQ, 1.2));
    this.#param("lowpassHz", nodes.lowpass.frequency, finiteOr(settings.lowpassHz, 6000));

    if (this.#applied.drive !== drive) {
      nodes.shaper.curve = RetroRack.curve(drive);
      this.#applied.drive = drive;
    }

    const oversample = settings.oversample || "2x";
    if (this.#applied.oversample !== oversample) {
      nodes.shaper.oversample = oversample;
      this.#applied.oversample = oversample;
    }

    const outputGain = Math.max(0, finiteOr(settings.outputGain, 1));
    this.#param("outputGain", nodes.makeup.gain, outputGain);

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
    this.#applied[key] = value;
    param.value = value;
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
