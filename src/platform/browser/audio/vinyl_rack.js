import { finiteOr } from "../../../engine/math/number_normalization.js";
import { WalkieTalkieRack } from "./walkie_talkie_rack.js";

// TK-097, TK-126 (Spec 146): the "vinyl record" stage of the radio's effects chain.
// Audio wet path: delay with turntable wow & flutter -> high-pass rumble filter -> warmth (low-shelf)
// -> low-pass analog top-end roll-off -> warm tube saturation -> makeup gain -> output.
// Surface sound path: crisp crackle, tactile clicks/pops, surface hiss and turntable rumble.
// Parameters:
// - warmth (0..10): single intuitive control shaping low-end warmth, analog high-cut, tube saturation & subtle wow;
// - crackleLevel (0..1.0): volume of vinyl dust/groove crackle;
// - crackleRate (0..60): frequency/density of micro-crackles;
// - popLevel (0..1.0): volume of distinct scratch/dust clicks;
// - popRate (0..8): frequency/density of pops;
// - outputGain (0..2.0) and mix (0..1.0).
// cueTonearm(): synthesizes the mechanical stylus landing thud, lead-in groove friction squeak and crackle flurry.
export class VinylRack {
  static BUFFER_SECONDS = 4;
  #rng;
  #context = null;
  #nodes = null;
  #sources = {};
  #cueSources = new Set();
  #applied = {};

  // rng: the radio's own { next() } (never the gameplay RNG).
  constructor({ rng }) {
    this.#rng = rng;
  }

  get input() {
    return this.#nodes?.input || null;
  }

  get output() {
    return this.#nodes?.output || null;
  }

  build(context) {
    this.#context = context;
    const node = {
      input: context.createGain(), output: context.createGain(), dry: context.createGain(), wet: context.createGain(),
      delay: context.createDelay(0.05), wowOsc: context.createOscillator(), wowDepth: context.createGain(),
      flutterOsc: context.createOscillator(), flutterDepth: context.createGain(),
      highpass: context.createBiquadFilter(), warmth: context.createBiquadFilter(), lowpass: context.createBiquadFilter(),
      shaper: context.createWaveShaper(), makeup: context.createGain(),
      crackleTone: context.createBiquadFilter(), crackle: context.createGain(), pops: context.createGain(),
      hissTone: context.createBiquadFilter(), hiss: context.createGain(),
      rumbleTone: context.createBiquadFilter(), rumble: context.createGain(),
    };
    node.highpass.type = "highpass";
    node.warmth.type = "lowshelf";
    node.lowpass.type = "lowpass";
    node.crackleTone.type = "highpass";
    node.crackleTone.frequency.value = 1000;
    node.hissTone.type = "highpass";
    node.hissTone.frequency.value = 3000;
    node.rumbleTone.type = "lowpass";
    node.wowOsc.type = "sine";
    node.flutterOsc.type = "sine";
    node.input.connect(node.dry);
    node.dry.connect(node.output);
    node.input.connect(node.delay);
    node.wowOsc.connect(node.wowDepth);
    node.wowDepth.connect(node.delay.delayTime);
    node.flutterOsc.connect(node.flutterDepth);
    node.flutterDepth.connect(node.delay.delayTime);
    node.delay.connect(node.highpass);
    node.highpass.connect(node.warmth);
    node.warmth.connect(node.lowpass);
    node.lowpass.connect(node.shaper);
    node.shaper.connect(node.makeup);
    node.makeup.connect(node.wet);
    node.crackleTone.connect(node.crackle);
    node.crackle.connect(node.wet);
    node.pops.connect(node.wet);
    node.hissTone.connect(node.hiss);
    node.hiss.connect(node.wet);
    node.rumbleTone.connect(node.rumble);
    node.rumble.connect(node.wet);
    node.wet.connect(node.output);
    node.dry.gain.value = 1;
    node.wet.gain.value = 0;
    node.wowOsc.start();
    node.flutterOsc.start();
    this.#nodes = node;
    this.#applied = {};
    this.#sources = {};
    this.#loop("hiss", this.#noiseBuffer(), node.hissTone);
    this.#loop("rumble", this.#noiseBuffer(), node.rumbleTone);
    return this;
  }

  update(settings = {}, rampSeconds = 0.03) {
    const node = this.#nodes;
    if (!node) return;

    // TK-126: Single warmth slider mapping (0..10) with backward compatibility for granular keys
    const hasWarmth = settings.warmth !== undefined;
    const warmth = hasWarmth ? Math.max(0, Math.min(10, Number(settings.warmth) || 0)) : 5;
    const w = warmth / 10;

    const highpassHz = finiteOr(settings.highpassHz, 30);
    const warmthHz = finiteOr(settings.warmthHz, 160);
    const warmthGainDb = hasWarmth ? w * 7.5 : finiteOr(settings.warmthGainDb, 2.5);
    const lowpassHz = hasWarmth ? (18000 - w * 10500) : finiteOr(settings.lowpassHz, 9000);
    const drive = hasWarmth ? (1.0 + w * 2.5) : Math.max(0, finiteOr(settings.drive, 3));
    const wowHz = Math.max(0, finiteOr(settings.wowHz, 0.55));
    const wowDepthMs = hasWarmth ? (0.6 + w * 0.8) : Math.max(0, finiteOr(settings.wowDepthMs, 1.2));
    const flutterHz = Math.max(0, finiteOr(settings.flutterHz, 6.0));
    const flutterDepthMs = Math.max(0, finiteOr(settings.flutterDepthMs, 0.1));

    this.#param("baseDelayMs", node.delay.delayTime, Math.max(0, finiteOr(settings.baseDelayMs, 6)) / 1000);
    this.#param("wowHz", node.wowOsc.frequency, wowHz);
    this.#param("wowDepthMs", node.wowDepth.gain, wowDepthMs / 1000);
    this.#param("flutterHz", node.flutterOsc.frequency, flutterHz);
    this.#param("flutterDepthMs", node.flutterDepth.gain, flutterDepthMs / 1000);
    this.#param("highpassHz", node.highpass.frequency, highpassHz);
    this.#param("warmthHz", node.warmth.frequency, warmthHz);
    this.#param("warmthGainDb", node.warmth.gain, warmthGainDb);
    this.#param("lowpassHz", node.lowpass.frequency, lowpassHz);

    if (this.#applied.drive !== drive) {
      node.shaper.curve = WalkieTalkieRack.curve(drive);
      node.shaper.oversample = "2x";
      this.#applied.drive = drive;
    }
    const outputGain = Math.max(0, finiteOr(settings.outputGain, 1));
    this.#param("makeup", node.makeup.gain,
      (1 / Math.max(1e-6, WalkieTalkieRack.peak(drive))) * outputGain);

    // TK-126: expressive crackle & clicks calibration
    this.#param("crackleToneHz", node.crackleTone.frequency, finiteOr(settings.crackleToneHz, 1000));
    const crackleLevel = Math.max(0, finiteOr(settings.crackleLevel, 0.12));
    this.#param("crackleLevel", node.crackle.gain, crackleLevel * 1.5);

    const popLevel = Math.max(0, finiteOr(settings.popLevel, 0.40));
    this.#param("popLevel", node.pops.gain, popLevel * 1.2);

    this.#param("hissLevel", node.hiss.gain, Math.max(0, finiteOr(settings.hissLevel, 0.006)));
    this.#param("rumbleHz", node.rumbleTone.frequency, Math.max(1, finiteOr(settings.rumbleHz, 30)));
    this.#param("rumbleLevel", node.rumble.gain, Math.max(0, finiteOr(settings.rumbleLevel, 0.02)));

    const crackleRate = Math.max(0, finiteOr(settings.crackleRate, 18));
    if (this.#applied.crackleRate !== crackleRate) {
      this.#loop("crackle", this.#clickBuffer(crackleRate, 0.0018, false), node.crackleTone);
      this.#applied.crackleRate = crackleRate;
    }
    const popRate = Math.max(0, finiteOr(settings.popRate, 1.5));
    if (this.#applied.popRate !== popRate) {
      this.#loop("pops", this.#clickBuffer(popRate, 0.006, true), node.pops);
      this.#applied.popRate = popRate;
    }

    const enabled = settings.enabled !== false;
    this.#applied.enabled = enabled;
    const mix = !enabled ? 0 : Math.max(0, Math.min(1, finiteOr(settings.mix, 1)));
    if (this.#applied.mix !== mix) {
      if (this.#applied.mix === undefined) {
        node.wet.gain.value = mix;
        node.dry.gain.value = 1 - mix;
      } else {
        const now = Number(this.#context?.currentTime) || 0;
        const constant = Math.max(0.001, Number(rampSeconds) || 0.03);
        node.wet.gain.setTargetAtTime(mix, now, constant);
        node.dry.gain.setTargetAtTime(1 - mix, now, constant);
      }
      this.#applied.mix = mix;
    }
  }

  // TK-126: cue tonearm needle drop sound (landing thump, friction squeak into groove, crackle burst)
  cueTonearm() {
    if (!this.#context || !this.#nodes) return;
    if (this.#applied.enabled === false || this.#applied.mix === 0) return;
    try {
      const buffer = this.#cueBuffer();
      const source = this.#context.createBufferSource();
      this.#cueSources.add(source);
      source.buffer = buffer;
      source.connect(this.#nodes.wet);
      source.start();
      source.onended = () => {
        source.disconnect?.();
        this.#cueSources.delete(source);
      };
    } catch {
      // AudioContext state or disposed
    }
  }

  dispose() {
    for (const source of Object.values(this.#sources)) {
      source.stop();
      source.disconnect?.();
    }
    for (const source of this.#cueSources) {
      source.stop?.();
      source.disconnect?.();
    }
    this.#cueSources.clear();
    this.#nodes?.wowOsc.stop();
    this.#nodes?.flutterOsc.stop();
    for (const node of Object.values(this.#nodes || {})) node.disconnect?.();
    this.#nodes = null;
    this.#sources = {};
    this.#context = null;
    this.#applied = {};
  }

  #param(key, param, value) {
    if (this.#applied[key] === value) return;
    param.value = value;
    this.#applied[key] = value;
  }

  // Replaces the looped source of one surface sound.
  #loop(key, buffer, destination) {
    const previous = this.#sources[key];
    previous?.stop();
    previous?.disconnect?.();
    const source = this.#context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(destination);
    source.start();
    this.#sources[key] = source;
  }

  #buffer() {
    const rate = Number(this.#context.sampleRate) || 44100;
    const length = Math.max(1, Math.floor(rate * VinylRack.BUFFER_SECONDS));
    return { buffer: this.#context.createBuffer(1, length, rate), length, rate };
  }

  #noiseBuffer() {
    const { buffer, length } = this.#buffer();
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = this.#rng.next() * 2 - 1;
    return buffer;
  }

  // ratePerSecond clicks of random sign and size, each decaying over about decaySeconds.
  #clickBuffer(ratePerSecond, decaySeconds, isPop = false) {
    const { buffer, length, rate } = this.#buffer();
    const data = buffer.getChannelData(0);
    const count = Math.round(ratePerSecond * VinylRack.BUFFER_SECONDS);
    const decay = Math.max(1, Math.floor(decaySeconds * rate));
    for (let click = 0; click < count; click += 1) {
      const start = Math.floor(this.#rng.next() * length);
      const sign = this.#rng.next() < 0.5 ? -1 : 1;
      const amplitude = (isPop ? 0.7 + this.#rng.next() * 0.3 : 0.5 + this.#rng.next() * 0.5) * sign;
      const span = Math.min(length - start, decay * (isPop ? 6 : 4));
      for (let offset = 0; offset < span; offset += 1) {
        const envelope = Math.exp(-offset / decay);
        const oscillation = isPop
          ? Math.sin(offset * 0.75) * 0.8 + (offset % 2 === 0 ? 0.3 : -0.2)
          : (offset % 2 === 0 ? 1 : -0.6) * Math.cos(offset * 1.5);
        data[start + offset] += amplitude * envelope * oscillation;
      }
    }
    return buffer;
  }

  // Synthesizes the one-shot 0.45s tonearm needle landing sound
  #cueBuffer() {
    const rate = Number(this.#context?.sampleRate) || 44100;
    const duration = 0.45;
    const length = Math.max(1, Math.floor(rate * duration));
    const buffer = this.#context.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);

    // 1. Mechanical needle drop thud (0..0.08s)
    const thudSamples = Math.floor(0.08 * rate);
    for (let i = 0; i < thudSamples && i < length; i += 1) {
      const t = i / rate;
      const freq = 75 - t * 300;
      const env = Math.exp(-t / 0.022);
      data[i] += Math.sin(2 * Math.PI * freq * t) * env * 0.5;
    }

    // 2. Stylus friction squeak / chirp into the groove (0.02..0.22s)
    const squeakStart = Math.floor(0.02 * rate);
    const squeakDuration = 0.20;
    const squeakSamples = Math.floor(squeakDuration * rate);
    for (let i = 0; i < squeakSamples && squeakStart + i < length; i += 1) {
      const t = i / rate;
      const norm = t / squeakDuration;
      const freq = 1350 - norm * 650;
      const env = Math.sin(Math.PI * norm) * Math.exp(-norm * 1.2);
      const squeak = (Math.sin(2 * Math.PI * freq * t) + 0.35 * Math.sin(4 * Math.PI * freq * t)) * env * 0.35;
      data[squeakStart + i] += squeak;
    }

    // 3. Dense flurry of crackles and pops on landing (0..0.45s)
    const burstCount = 20;
    for (let b = 0; b < burstCount; b += 1) {
      const clickStart = Math.floor(this.#rng.next() * length * 0.95);
      const sign = this.#rng.next() < 0.5 ? -1 : 1;
      const amplitude = (0.5 + this.#rng.next() * 0.5) * sign;
      const decay = Math.max(1, Math.floor((0.001 + this.#rng.next() * 0.003) * rate));
      for (let offset = 0; offset < decay * 4 && clickStart + offset < length; offset += 1) {
        data[clickStart + offset] += amplitude * Math.exp(-offset / decay) * (offset % 2 === 0 ? 1 : -0.7) * 0.4;
      }
    }

    return buffer;
  }
}
