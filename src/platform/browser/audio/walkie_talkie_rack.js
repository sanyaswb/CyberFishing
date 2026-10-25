// Spec 142 stage 3: the "walkie-talkie" sound between a stream's input and output. Wet path: high-pass -> low-pass ->
// peaking -> WaveShaper (f(x) = (3 + k)·x·20° / (π + k·|x|), 4x oversampling) -> make-up gain; dry path in parallel.
// The S-curve peaks at f(1) ≈ 0.35 for k = 18, so the make-up gain 1 / f(1) keeps both modes equally loud. Switching
// ramps both gains (setTargetAtTime) instead of jumping, so it never clicks. Settings: CONFIG.radio.rack.
export class WalkieTalkieRack {
  static CURVE_LENGTH = 44100;
  #config;
  #enabled = true;
  #context = null;
  #dry = null;
  #wet = null;
  #nodes = [];

  // config: () => CONFIG.radio.rack.
  constructor({ config }) {
    this.#config = config;
  }

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

  // Wires input -> (dry | wet chain) -> output on the context (called once by the player when it builds its graph).
  attach(context, input, output) {
    const cfg = this.#config() || {};
    this.#context = context;
    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = Number(cfg.highpassHz) || 500;
    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = Number(cfg.lowpassHz) || 3000;
    const peaking = context.createBiquadFilter();
    peaking.type = "peaking";
    peaking.frequency.value = Number(cfg.peakHz) || 1800;
    peaking.gain.value = Number.isFinite(Number(cfg.peakGainDb)) ? Number(cfg.peakGainDb) : 8;
    peaking.Q.value = Number(cfg.peakQ) || 2.5;
    const shaper = context.createWaveShaper();
    const drive = Number.isFinite(Number(cfg.drive)) ? Number(cfg.drive) : 18;
    shaper.curve = WalkieTalkieRack.curve(drive);
    shaper.oversample = cfg.oversample || "4x";
    const makeup = context.createGain();
    makeup.gain.value = 1 / Math.max(1e-6, WalkieTalkieRack.peak(drive));
    this.#dry = context.createGain();
    this.#wet = context.createGain();
    input.connect(this.#dry);
    this.#dry.connect(output);
    input.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(peaking);
    peaking.connect(shaper);
    shaper.connect(makeup);
    makeup.connect(this.#wet);
    this.#wet.connect(output);
    this.#nodes = [highpass, lowpass, peaking, shaper, makeup, this.#dry, this.#wet];
    this.#apply(true);
  }

  setEnabled(enabled) {
    const value = enabled === true;
    if (value === this.#enabled) return;
    this.#enabled = value;
    this.#apply(false);
  }

  get enabled() {
    return this.#enabled;
  }

  dispose() {
    for (const node of this.#nodes) node.disconnect?.();
    this.#nodes = [];
    this.#dry = null;
    this.#wet = null;
    this.#context = null;
  }

  #apply(immediate) {
    if (!this.#dry || !this.#wet) return;
    const wet = this.#enabled ? 1 : 0;
    if (immediate) {
      this.#wet.gain.value = wet;
      this.#dry.gain.value = 1 - wet;
      return;
    }
    const now = Number(this.#context?.currentTime) || 0;
    const ramp = Math.max(0.001, Number(this.#config()?.rampSeconds) || 0.03);
    this.#wet.gain.setTargetAtTime(wet, now, ramp);
    this.#dry.gain.setTargetAtTime(1 - wet, now, ramp);
  }
}
