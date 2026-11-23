import { finiteOr } from "../../../engine/math/number_normalization.js";

// Spec 149 / TK-138: Physical Transistor Radio DSP Synthesizer ("Радіо").
// Track 1 (Static noise bed): looped white/pink noise buffer -> bandpass (1.8 kHz) -> noiseGain -> wet.
// Track 2 (Interference & grit): heterodyne whistle sine oscillator (~2150 Hz) -> whistleGain -> wet.
// Track 3 (Program material / voice):
//   input -> dual HPF (450 Hz, 24 dB/oct) -> asymmetric WaveShaper (dominant 3rd & 5th harmonics) -> makeup gain
//   -> chassis peak EQ (+8 dB @ 2.1 kHz, Q = 2.5) -> dual LPF (3800 Hz, 24 dB/oct) -> AGC compressor -> wet.
// Parallel dry path: input -> dry -> output.
// update(settings) applies live config; setActive(active) mutes generators when the radio is powered off.
export class RadioRack {
  static CURVE_LENGTH = 44100;
  #context = null;
  #nodes = null;
  #applied = {};
  #active = true;
  #rng = null;

  constructor({ rng = null } = {}) {
    this.#rng = rng;
  }

  static curve(drive, length = RadioRack.CURVE_LENGTH) {
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

  setActive(active) {
    this.#active = active === true;
    const nodes = this.#nodes;
    if (!nodes) return;
    const now = Number(this.#context?.currentTime) || 0;
    if (!this.#active) {
      if (nodes.wet.gain.setTargetAtTime) nodes.wet.gain.setTargetAtTime(0, now, 0.02);
      else nodes.wet.gain.value = 0;
      if (nodes.dry.gain.setTargetAtTime) nodes.dry.gain.setTargetAtTime(0, now, 0.02);
      else nodes.dry.gain.value = 0;
      if (nodes.noiseGain?.gain?.setValueAtTime) nodes.noiseGain.gain.setValueAtTime(0, now);
      else if (nodes.noiseGain?.gain) nodes.noiseGain.gain.value = 0;
      if (nodes.whistleGain?.gain?.setValueAtTime) nodes.whistleGain.gain.setValueAtTime(0, now);
      else if (nodes.whistleGain?.gain) nodes.whistleGain.gain.value = 0;
    } else {
      const mix = this.#applied.enabled === false ? 0 : Math.max(0, Math.min(1, finiteOr(this.#applied.mix, 1)));
      if (nodes.wet.gain.setTargetAtTime) nodes.wet.gain.setTargetAtTime(mix, now, 0.02);
      else nodes.wet.gain.value = mix;
      if (nodes.dry.gain.setTargetAtTime) nodes.dry.gain.setTargetAtTime(1 - mix, now, 0.02);
      else nodes.dry.gain.value = 1 - mix;
      this.#applyTuningGains();
    }
  }

  // Builds the stage on a context; update(settings) then sets its values.
  build(context) {
    this.#context = context;
    const input = context.createGain();
    const output = context.createGain();
    const dry = context.createGain();
    const wet = context.createGain();

    // Track 3: Dual 24 dB/oct HPF
    const hpf1 = context.createBiquadFilter();
    hpf1.type = "highpass";
    hpf1.frequency.value = 450;

    const hpf2 = context.createBiquadFilter();
    hpf2.type = "highpass";
    hpf2.frequency.value = 450;

    const shaper = context.createWaveShaper();
    shaper.oversample = "2x";
    shaper.curve = RadioRack.curve(25);

    const makeup = context.createGain();

    // Track 3: Chassis resonance peak
    const peaking = context.createBiquadFilter();
    peaking.type = "peaking";
    peaking.frequency.value = 2100;
    peaking.Q.value = 2.5;
    peaking.gain.value = 8;

    // Track 3: Dual 24 dB/oct LPF
    const lpf1 = context.createBiquadFilter();
    lpf1.type = "lowpass";
    lpf1.frequency.value = 3800;

    const lpf2 = context.createBiquadFilter();
    lpf2.type = "lowpass";
    lpf2.frequency.value = 3800;

    // Track 3: AGC compressor
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -30;
    compressor.knee.value = 3;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.2;

    // Track 1: Static noise bed
    const noiseGain = context.createGain();
    noiseGain.gain.value = 0;
    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 1800;
    noiseFilter.Q.value = 1.0;
    const noiseSource = context.createBufferSource();
    noiseSource.buffer = this.#generateNoiseBuffer(2);
    noiseSource.loop = true;

    // Track 2: Heterodyne carrier whistle
    const whistleGain = context.createGain();
    whistleGain.gain.value = 0;
    const whistleOsc = context.createOscillator();
    whistleOsc.type = "sine";
    whistleOsc.frequency.value = 2150;

    // Parallel dry path
    input.connect(dry);
    dry.connect(output);

    // Audio path: input -> hpf1 -> hpf2 -> shaper -> makeup -> peaking -> lpf1 -> lpf2 -> compressor -> wet
    input.connect(hpf1);
    hpf1.connect(hpf2);
    hpf2.connect(shaper);
    shaper.connect(makeup);
    makeup.connect(peaking);
    peaking.connect(lpf1);
    lpf1.connect(lpf2);
    lpf2.connect(compressor);
    compressor.connect(wet);

    // Additive noise and whistle layers into wet
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(wet);

    whistleOsc.connect(whistleGain);
    whistleGain.connect(wet);

    wet.connect(output);
    dry.gain.value = 1;
    wet.gain.value = 0;

    try {
      noiseSource.start();
      whistleOsc.start();
    } catch {}

    this.#nodes = {
      input, output, dry, wet,
      highpass: hpf1, hpf1, hpf2,
      shaper, makeup,
      peaking,
      lowpass: lpf1, lpf1, lpf2,
      compressor,
      noiseGain, noiseFilter, noiseSource,
      whistleGain, whistleOsc,
    };
    this.#applied = {};
    return this;
  }

  update(settings = {}, rampSeconds = 0.03) {
    const nodes = this.#nodes;
    if (!nodes) return;

    const drive = finiteOr(settings.drive, 25);
    const highpassHz = finiteOr(settings.highpassHz, 450);
    const lowpassHz = finiteOr(settings.lowpassHz, 3800);
    const peakHz = finiteOr(settings.peakHz, 2100);
    const peakQ = finiteOr(settings.peakQ, 2.5);
    const peakGainDb = finiteOr(settings.peakGainDb, 8);
    const tuning = Math.max(0, Math.min(1, finiteOr(settings.tuning, 0.0)));
    const whistleLevel = Math.max(0, finiteOr(settings.whistleLevel, 0.008));
    const noiseLevel = Math.max(0, finiteOr(settings.noiseLevel, 0.04));

    this.#param("hpf1Freq", nodes.hpf1.frequency, highpassHz);
    this.#param("hpf2Freq", nodes.hpf2.frequency, highpassHz);
    this.#param("lpf1Freq", nodes.lpf1.frequency, lowpassHz);
    this.#param("lpf2Freq", nodes.lpf2.frequency, lowpassHz);
    this.#param("peakHz", nodes.peaking.frequency, peakHz);
    this.#param("peakQ", nodes.peaking.Q, peakQ);

    if (this.#applied.drive !== drive) {
      nodes.shaper.curve = RadioRack.curve(drive);
      this.#applied.drive = drive;
    }
    const oversample = settings.oversample || "2x";
    if (this.#applied.oversample !== oversample) {
      nodes.shaper.oversample = oversample;
      this.#applied.oversample = oversample;
    }

    const makeup = (1 / Math.max(1e-6, RadioRack.peak(drive))) * Math.max(0, finiteOr(settings.outputGain, 1));
    this.#param("makeup", nodes.makeup.gain, makeup);

    this.#applied.tuning = tuning;
    this.#applied.whistleLevel = whistleLevel;
    this.#applied.noiseLevel = noiseLevel;
    this.#applied.basePeakGain = peakGainDb;
    this.#applyTuningGains();

    const enabled = settings.enabled !== false;
    this.#applied.enabled = enabled;
    const mix = !enabled ? 0 : Math.max(0, Math.min(1, finiteOr(settings.mix, 1)));
    this.#ramp("mix", nodes.wet.gain, nodes.dry.gain, this.#active ? mix : 0, rampSeconds);
  }

  #applyTuningGains() {
    const nodes = this.#nodes;
    if (!nodes || !this.#active || this.#applied.enabled === false) return;
    const tuning = this.#applied.tuning ?? 0;
    const whistleLevel = this.#applied.whistleLevel ?? 0.008;
    const noiseLevel = this.#applied.noiseLevel ?? 0.04;
    const basePeak = this.#applied.basePeakGain ?? 8;
    const now = Number(this.#context?.currentTime) || 0;

    const targetNoise = noiseLevel * (0.5 + tuning * 3.5);
    const targetWhistle = whistleLevel * (0.6 + tuning * 5.0);
    const targetWhistleFreq = 2150 + tuning * 400;
    const targetPeakGain = Math.max(0, basePeak - tuning * 6);

    if (nodes.noiseGain.gain.setTargetAtTime) nodes.noiseGain.gain.setTargetAtTime(targetNoise, now, 0.05);
    else nodes.noiseGain.gain.value = targetNoise;

    if (nodes.whistleGain.gain.setTargetAtTime) nodes.whistleGain.gain.setTargetAtTime(targetWhistle, now, 0.05);
    else nodes.whistleGain.gain.value = targetWhistle;

    if (nodes.whistleOsc.frequency.setTargetAtTime) nodes.whistleOsc.frequency.setTargetAtTime(targetWhistleFreq, now, 0.05);
    else nodes.whistleOsc.frequency.value = targetWhistleFreq;

    if (nodes.peaking.gain.setTargetAtTime) nodes.peaking.gain.setTargetAtTime(targetPeakGain, now, 0.05);
    else nodes.peaking.gain.value = targetPeakGain;
  }

  dispose() {
    try {
      this.#nodes?.noiseSource?.stop?.();
      this.#nodes?.whistleOsc?.stop?.();
    } catch {}
    for (const node of Object.values(this.#nodes || {})) node.disconnect?.();
    this.#nodes = null;
    this.#context = null;
    this.#applied = {};
  }

  #generateNoiseBuffer(seconds = 2) {
    const rate = Number(this.#context?.sampleRate) || 44100;
    const length = Math.max(1, Math.floor(rate * seconds));
    const buffer = this.#context.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (this.#rng?.next ? this.#rng.next() : Math.random()) * 2 - 1;
    }
    return buffer;
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
