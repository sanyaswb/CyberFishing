import { finiteOr } from "../../../engine/math/number_normalization.js";
import { WalkieTalkieRack } from "./walkie_talkie_rack.js";

// TK-097, TK-128 (Spec 147): the "vinyl record" stage of the radio's effects chain.
// Dual Engine Architecture:
// - Mode 0 (Sampled / Автентичний): uses genuine sampled recordings of vinyl surface noise and tonearm needle drop;
// - Mode 1 (Procedural Lo-Fi Vintage / Сухий старий програвач): pure Web Audio synthesis modeling a dry, narrow-bandwidth,
//   warm, low-quality vintage record player (steep low-pass cutoff at ~3800 Hz, boxy acoustic resonance at ~850 Hz,
//   warm low-mid boost at ~220 Hz, subtle compression/saturation, wow/flutter, and dry procedural crackle & pops).
// cueTonearm(): plays authentic needle drop touchdown & lead-in groove squeak (mode 0) or procedural dry cue (mode 1).
export class VinylRack {
  static BUFFER_SECONDS = 4;
  #rng;
  #fetchRef;
  #context = null;
  #nodes = null;
  #sources = {};
  #cueSources = new Set();
  #applied = {};
  #sampledSurfaceBuffer = null;
  #sampledNeedleDropBuffer = null;
  #sampledSurfaceSource = null;

  // rng: the radio's own { next() } (never the gameplay RNG).
  constructor({ rng, fetchRef = (typeof fetch !== "undefined" ? fetch : null) }) {
    this.#rng = rng;
    this.#fetchRef = fetchRef;
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
      lofiResonance: context.createBiquadFilter(),
      shaper: context.createWaveShaper(), makeup: context.createGain(),
      proceduralSurface: context.createGain(),
      sampledSurface: context.createGain(),
      crackleTone: context.createBiquadFilter(), crackle: context.createGain(), pops: context.createGain(),
      hissTone: context.createBiquadFilter(), hiss: context.createGain(),
      rumbleTone: context.createBiquadFilter(), rumble: context.createGain(),
    };
    node.highpass.type = "highpass";
    node.warmth.type = "lowshelf";
    node.lowpass.type = "lowpass";
    node.lofiResonance.type = "peaking";
    node.lofiResonance.frequency.value = 850;
    node.lofiResonance.Q.value = 1.5;
    node.lofiResonance.gain.value = 0;
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

    // Audio path: delay -> highpass -> warmth -> lofiResonance -> lowpass -> shaper -> makeup -> wet
    node.delay.connect(node.highpass);
    node.highpass.connect(node.warmth);
    node.warmth.connect(node.lofiResonance);
    node.lofiResonance.connect(node.lowpass);
    node.lowpass.connect(node.shaper);
    node.shaper.connect(node.makeup);
    node.makeup.connect(node.wet);

    // Procedural surface noise path
    node.crackleTone.connect(node.crackle);
    node.crackle.connect(node.proceduralSurface);
    node.pops.connect(node.proceduralSurface);
    node.hissTone.connect(node.hiss);
    node.hiss.connect(node.proceduralSurface);
    node.rumbleTone.connect(node.rumble);
    node.rumble.connect(node.proceduralSurface);
    node.proceduralSurface.connect(node.wet);

    // Sampled surface noise path
    node.sampledSurface.connect(node.wet);

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
    this.#loadSamples();
    return this;
  }

  update(settings = {}, rampSeconds = 0.03) {
    const node = this.#nodes;
    if (!node) return;

    // TK-128: Mode 0 = Sampled authentic vinyl, Mode 1 = Procedural lo-fi vintage turntable
    const mode = Number(settings.mode) === 1 ? 1 : 0;
    const modeChanged = this.#applied.mode !== mode;
    this.#applied.mode = mode;

    const baseDelayMs = Math.max(0, finiteOr(settings.baseDelayMs, 6));
    const wowHz = Math.max(0, finiteOr(settings.wowHz, 0.55));
    const flutterHz = Math.max(0, finiteOr(settings.flutterHz, 6.5));
    const flutterDepthMs = Math.max(0, finiteOr(settings.flutterDepthMs, 0.15));

    this.#param("baseDelayMs", node.delay.delayTime, baseDelayMs / 1000);
    this.#param("wowHz", node.wowOsc.frequency, wowHz);
    this.#param("flutterHz", node.flutterOsc.frequency, flutterHz);
    this.#param("flutterDepthMs", node.flutterDepth.gain, flutterDepthMs / 1000);

    let highpassHz = finiteOr(settings.highpassHz, 35);
    let warmthHz = finiteOr(settings.warmthHz, 150);
    let warmthGainDb = finiteOr(settings.warmthGainDb, 2.5);
    let lowpassHz = finiteOr(settings.lowpassHz, 9000);
    let drive = Math.max(0, finiteOr(settings.drive, 3));
    let wowDepthMs = Math.max(0, finiteOr(settings.wowDepthMs, 1.2));
    let lofiResonanceDb = 0;

    if (mode === 1) {
      // Procedural lo-fi vintage turntable: dry, band-limited without crisp details, warm boxy tone
      highpassHz = Math.max(80, highpassHz);
      warmthHz = 220;
      warmthGainDb = Math.max(4.0, warmthGainDb + 2.0);
      lofiResonanceDb = 3.5; // boxy/horn resonance
      lowpassHz = Math.min(4200, lowpassHz); // steep roll-off above 4 kHz
      drive = Math.max(4.0, drive + 1.5); // vintage lo-fi saturation
      wowDepthMs = Math.max(1.8, wowDepthMs); // mechanical pitch flutter
    }

    this.#param("wowDepthMs", node.wowDepth.gain, wowDepthMs / 1000);
    this.#param("highpassHz", node.highpass.frequency, highpassHz);
    this.#param("warmthHz", node.warmth.frequency, warmthHz);
    this.#param("warmthGainDb", node.warmth.gain, warmthGainDb);
    this.#param("lofiResonanceGain", node.lofiResonance.gain, lofiResonanceDb);
    this.#param("lowpassHz", node.lowpass.frequency, lowpassHz);

    if (this.#applied.drive !== drive) {
      node.shaper.curve = WalkieTalkieRack.curve(drive);
      node.shaper.oversample = "2x";
      this.#applied.drive = drive;
    }
    this.#param("makeup", node.makeup.gain,
      (1 / Math.max(1e-6, WalkieTalkieRack.peak(drive))) * Math.max(0, finiteOr(settings.outputGain, 1)));

    // Surface sound routing and levels
    const crackleLevel = Math.max(0, finiteOr(settings.crackleLevel, 0.12));
    const popLevel = Math.max(0, finiteOr(settings.popLevel, 0.35));
    const hissLevel = Math.max(0, finiteOr(settings.hissLevel, 0.006));
    const rumbleLevel = Math.max(0, finiteOr(settings.rumbleLevel, 0.02));

    this.#param("crackleToneHz", node.crackleTone.frequency, finiteOr(settings.crackleToneHz, 2500));
    this.#param("crackleLevel", node.crackle.gain, crackleLevel);
    this.#param("popLevel", node.pops.gain, popLevel);
    this.#param("hissLevel", node.hiss.gain, hissLevel);
    this.#param("rumbleHz", node.rumbleTone.frequency, Math.max(1, finiteOr(settings.rumbleHz, 30)));
    this.#param("rumbleLevel", node.rumble.gain, rumbleLevel);

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

    // Toggle surface routing between Sampled (mode 0) and Procedural (mode 1)
    if (mode === 0) {
      this.#param("sampledGain", node.sampledSurface.gain, crackleLevel * 2.2);
      this.#param("proceduralGain", node.proceduralSurface.gain, 0);
      if (this.#sampledSurfaceBuffer && !this.#sampledSurfaceSource) {
        this.#startSampledSurface();
      }
    } else {
      this.#param("sampledGain", node.sampledSurface.gain, 0);
      this.#param("proceduralGain", node.proceduralSurface.gain, 1);
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

  // TK-126/128: Tonearm needle drop cueing
  cueTonearm() {
    if (!this.#context || !this.#nodes) return;
    if (this.#applied.enabled === false || this.#applied.mix === 0) return;
    const now = Number(this.#context.currentTime) || 0;

    // Mode 0: play genuine recorded tonearm touchdown & groove squeak if loaded
    if (this.#applied.mode === 0 && this.#sampledNeedleDropBuffer) {
      try {
        const source = this.#context.createBufferSource();
        this.#cueSources.add(source);
        source.buffer = this.#sampledNeedleDropBuffer;
        source.connect(this.#nodes.wet);
        // Play touchdown segment from 0.8s
        source.start(now, 0.8, 3.2);
        source.onended = () => {
          source.disconnect?.();
          this.#cueSources.delete(source);
        };
        return;
      } catch {
        // Fall back to procedural cue if playback fails
      }
    }

    // Mode 1 (or fallback): procedural landing thump, lead-in squeak and crackle flurry
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
    this.#sampledSurfaceSource?.stop?.();
    this.#sampledSurfaceSource?.disconnect?.();
    this.#sampledSurfaceSource = null;

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

  #startSampledSurface() {
    if (!this.#sampledSurfaceBuffer || !this.#context || !this.#nodes) return;
    if (this.#sampledSurfaceSource) return;
    try {
      const source = this.#context.createBufferSource();
      source.buffer = this.#sampledSurfaceBuffer;
      source.loop = true;
      source.connect(this.#nodes.sampledSurface);
      source.start();
      this.#sampledSurfaceSource = source;
    } catch {
      // AudioContext not running yet
    }
  }

  async #fetchAudio(paths) {
    for (const p of paths) {
      try {
        const res = await this.#fetchRef(p);
        if (res?.ok && this.#context) {
          const arr = await res.arrayBuffer();
          const buf = await this.#context.decodeAudioData(arr);
          if (buf) return buf;
        }
      } catch {
        // Try next path candidate
      }
    }
    return null;
  }

  async #loadSamples() {
    if (!this.#fetchRef || !this.#context?.decodeAudioData) return;
    try {
      const [surfaceBuf, dropBuf] = await Promise.all([
        this.#fetchAudio(["assets/audio/radio/vinyl/vinyl_surface.mp3", "SFX/vinyl-3.mp3", "SFX/vinyl-5.mp3"]),
        this.#fetchAudio(["assets/audio/radio/vinyl/vinyl_needle_drop.mp3", "SFX/vinyl-6.mp3", "SFX/vinyl-4.mp3"]),
      ]);
      if (surfaceBuf && this.#context) {
        this.#sampledSurfaceBuffer = surfaceBuf;
        if (this.#applied.mode !== 1 && this.#nodes && !this.#sampledSurfaceSource) {
          this.#startSampledSurface();
        }
      }
      if (dropBuf && this.#context) {
        this.#sampledNeedleDropBuffer = dropBuf;
      }
    } catch {
      // In tests or non-browser environments, safely ignore
    }
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
