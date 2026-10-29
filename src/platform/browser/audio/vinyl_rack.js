import { finiteOr } from "../../../engine/math/number_normalization.js";
import { WalkieTalkieRack } from "./walkie_talkie_rack.js";

// TK-097: the "vinyl record" stage of the radio's effects chain. Wet path: a short DelayNode whose delay two sine
// oscillators sway (wow ~0.5 Hz, flutter ~6 Hz: the pitch wavers like an uneven turntable) -> high-pass (rumble filter)
// -> warm low shelf -> low-pass (old record's top end) -> soft saturation (the S-curve of WalkieTalkieRack with make-up
// gain) -> outputGain; plus the record's surface: crackle (short clicks, band-passed), pops (rare louder clicks), hiss
// and low rumble, looped 4 s buffers drawn from the radio's RNG. The dry path runs in parallel; enabled and mix ramp the
// dry/wet gains. update(settings) applies CONFIG.radio.effects.vinyl live; changed click densities rebuild only their
// buffer.
export class VinylRack {
  static BUFFER_SECONDS = 4;
  #rng;
  #context = null;
  #nodes = null;
  #sources = {};
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
    node.crackleTone.type = "bandpass";
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
    this.#param("baseDelayMs", node.delay.delayTime, Math.max(0, finiteOr(settings.baseDelayMs, 6)) / 1000);
    this.#param("wowHz", node.wowOsc.frequency, Math.max(0, finiteOr(settings.wowHz, 0.55)));
    this.#param("wowDepthMs", node.wowDepth.gain, Math.max(0, finiteOr(settings.wowDepthMs, 1.2)) / 1000);
    this.#param("flutterHz", node.flutterOsc.frequency, Math.max(0, finiteOr(settings.flutterHz, 6.5)));
    this.#param("flutterDepthMs", node.flutterDepth.gain, Math.max(0, finiteOr(settings.flutterDepthMs, 0.15)) / 1000);
    this.#param("highpassHz", node.highpass.frequency, finiteOr(settings.highpassHz, 35));
    this.#param("warmthHz", node.warmth.frequency, finiteOr(settings.warmthHz, 150));
    this.#param("warmthGainDb", node.warmth.gain, finiteOr(settings.warmthGainDb, 2.5));
    this.#param("lowpassHz", node.lowpass.frequency, finiteOr(settings.lowpassHz, 9000));
    const drive = Math.max(0, finiteOr(settings.drive, 3));
    if (this.#applied.drive !== drive) {
      node.shaper.curve = WalkieTalkieRack.curve(drive);
      node.shaper.oversample = "2x";
      this.#applied.drive = drive;
    }
    this.#param("makeup", node.makeup.gain,
      (1 / Math.max(1e-6, WalkieTalkieRack.peak(drive))) * Math.max(0, finiteOr(settings.outputGain, 1)));
    this.#param("crackleToneHz", node.crackleTone.frequency, finiteOr(settings.crackleToneHz, 2500));
    this.#param("crackleLevel", node.crackle.gain, Math.max(0, finiteOr(settings.crackleLevel, 0.12)));
    this.#param("popLevel", node.pops.gain, Math.max(0, finiteOr(settings.popLevel, 0.35)));
    this.#param("hissLevel", node.hiss.gain, Math.max(0, finiteOr(settings.hissLevel, 0.006)));
    this.#param("rumbleHz", node.rumbleTone.frequency, Math.max(1, finiteOr(settings.rumbleHz, 30)));
    this.#param("rumbleLevel", node.rumble.gain, Math.max(0, finiteOr(settings.rumbleLevel, 0.02)));
    const crackleRate = Math.max(0, finiteOr(settings.crackleRate, 6));
    if (this.#applied.crackleRate !== crackleRate) {
      this.#loop("crackle", this.#clickBuffer(crackleRate, 0.002), node.crackleTone);
      this.#applied.crackleRate = crackleRate;
    }
    const popRate = Math.max(0, finiteOr(settings.popRate, 0.25));
    if (this.#applied.popRate !== popRate) {
      this.#loop("pops", this.#clickBuffer(popRate, 0.006), node.pops);
      this.#applied.popRate = popRate;
    }
    const mix = settings.enabled === false ? 0 : Math.max(0, Math.min(1, finiteOr(settings.mix, 1)));
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

  dispose() {
    for (const source of Object.values(this.#sources)) {
      source.stop();
      source.disconnect?.();
    }
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
  #clickBuffer(ratePerSecond, decaySeconds) {
    const { buffer, length, rate } = this.#buffer();
    const data = buffer.getChannelData(0);
    const count = Math.round(ratePerSecond * VinylRack.BUFFER_SECONDS);
    const decay = Math.max(1, Math.floor(decaySeconds * rate));
    for (let click = 0; click < count; click += 1) {
      const start = Math.floor(this.#rng.next() * length);
      const amplitude = (0.3 + this.#rng.next() * 0.7) * (this.#rng.next() < 0.5 ? -1 : 1);
      for (let offset = 0; offset < decay * 4 && start + offset < length; offset += 1) {
        data[start + offset] += amplitude * Math.exp(-offset / decay) * (offset % 2 === 0 ? 1 : -0.6);
      }
    }
    return buffer;
  }
}
