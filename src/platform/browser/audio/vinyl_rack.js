import { finiteOr } from "../../../engine/math/number_normalization.js";
import { WalkieTalkieRack } from "./walkie_talkie_rack.js";

export const VINYL_SFX_FILES = Object.freeze({
  "vinyl-1": "assets/audio/radio/vinyl/vinyl-1.mp3",
  "vinyl-2": "assets/audio/radio/vinyl/vinyl-2.mp3",
  "vinyl-3": "assets/audio/radio/vinyl/vinyl-3.mp3",
  "vinyl-4": "assets/audio/radio/vinyl/vinyl-4.mp3",
  "vinyl-5": "assets/audio/radio/vinyl/vinyl-5.mp3",
  "vinyl-6": "assets/audio/radio/vinyl/vinyl-6.mp3",
});

function resolveFetch(ref) {
  if (ref) {
    if (typeof window !== "undefined" && ref === window.fetch) return window.fetch.bind(window);
    return ref;
  }
  if (typeof window !== "undefined" && typeof window.fetch === "function") {
    return window.fetch.bind(window);
  }
  if (typeof globalThis !== "undefined" && typeof globalThis.fetch === "function") {
    try {
      return globalThis.fetch.bind(globalThis);
    } catch {
      return globalThis.fetch;
    }
  }
  return null;
}

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
  #sfxGains = new Map();
  #sfxSources = new Map();
  #sfxBuffers = new Map();
  #active = true;

  // rng: the radio's own { next() } (never the gameplay RNG).
  constructor({ rng, fetchRef = null }) {
    this.#rng = rng;
    this.#fetchRef = resolveFetch(fetchRef);
  }

  setActive(active) {
    this.#active = active === true;
    const node = this.#nodes;
    if (!node) return;
    const now = Number(this.#context?.currentTime) || 0;
    if (!this.#active) {
      if (node.wet.gain.setTargetAtTime) node.wet.gain.setTargetAtTime(0, now, 0.02);
      else node.wet.gain.value = 0;
      if (node.dry.gain.setTargetAtTime) node.dry.gain.setTargetAtTime(0, now, 0.02);
      else node.dry.gain.value = 0;
    } else {
      const enabled = this.#applied.enabled !== false;
      const mix = !enabled ? 0 : Math.max(0, Math.min(1, finiteOr(this.#applied.mix, 1)));
      if (node.wet.gain.setTargetAtTime) node.wet.gain.setTargetAtTime(mix, now, 0.02);
      else node.wet.gain.value = mix;
      if (node.dry.gain.setTargetAtTime) node.dry.gain.setTargetAtTime(1 - mix, now, 0.02);
      else node.dry.gain.value = 1 - mix;
    }
  }

  static asymmetricCurve(drive, length = 44100) {
    const k = Math.max(1, Number(drive) || 1);
    const alpha = Math.min(0.45, (k - 1) * 0.06);
    const curve = new Float32Array(length);
    for (let index = 0; index < length; index += 1) {
      const x = (index * 2) / (length - 1) - 1;
      const shaped = x > 0 ? (x * (1 + alpha * 0.6)) : (x * (1 - alpha * 0.4) + alpha * x * x);
      curve[index] = Math.tanh(shaped * (1.2 + (k - 1) * 0.85));
    }
    return curve;
  }

  static peak(drive) {
    const k = Math.max(1, Number(drive) || 1);
    return Math.max(0.1, Math.tanh(1.2 + (k - 1) * 0.85));
  }

  static igdCurve(amount, length = 44100) {
    const a = Math.max(0, Number(amount) || 0);
    const curve = new Float32Array(length);
    for (let index = 0; index < length; index += 1) {
      const x = (index * 2) / (length - 1) - 1;
      curve[index] = Math.tanh(x * (1 + a * 2.2)) * 0.85;
    }
    return curve;
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
      delay: context.createDelay(0.1), wowOsc: context.createOscillator(), wowDepth: context.createGain(),
      flutterOsc: context.createOscillator(), flutterDepth: context.createGain(),
      highpass: context.createBiquadFilter(), warmth: context.createBiquadFilter(), lowpass: context.createBiquadFilter(),
      cartridgePeak: context.createBiquadFilter(),
      lofiResonance: context.createBiquadFilter(),
      shaper: context.createWaveShaper(), makeup: context.createGain(),
      igdFilter: context.createBiquadFilter(), igdShaper: context.createWaveShaper(), igdGain: context.createGain(),
      trackCueGate: context.createGain(),
      proceduralSurface: context.createGain(),
      sampledSurface: context.createGain(),
      crackleTone: context.createBiquadFilter(), crackle: context.createGain(), pops: context.createGain(),
      hissTone: context.createBiquadFilter(), hiss: context.createGain(),
      rumbleTone: context.createBiquadFilter(), rumble: context.createGain(),
    };
    node.highpass.type = "highpass";
    node.warmth.type = "lowshelf";
    node.lowpass.type = "lowpass";
    node.cartridgePeak.type = "peaking";
    node.cartridgePeak.frequency.value = 9200;
    node.cartridgePeak.Q.value = 2.0;
    node.cartridgePeak.gain.value = 2.5;

    node.lofiResonance.type = "peaking";
    node.lofiResonance.frequency.value = 850;
    node.lofiResonance.Q.value = 1.5;
    node.lofiResonance.gain.value = 0;

    node.igdFilter.type = "bandpass";
    node.igdFilter.frequency.value = 5500;
    node.igdFilter.Q.value = 1.2;
    node.igdGain.gain.value = 0;

    node.crackleTone.type = "bandpass";
    node.crackleTone.frequency.value = 4500;
    node.hissTone.type = "bandpass";
    node.hissTone.frequency.value = 3500;
    node.hissTone.Q.value = 0.7;
    node.rumbleTone.type = "bandpass";
    node.rumbleTone.frequency.value = 25;
    node.rumbleTone.Q.value = 1.5;

    node.wowOsc.type = "sine";
    node.flutterOsc.type = "sine";

    node.input.connect(node.dry);
    node.dry.connect(node.output);
    node.input.connect(node.delay);
    node.wowOsc.connect(node.wowDepth);
    node.wowDepth.connect(node.delay.delayTime);
    node.flutterOsc.connect(node.flutterDepth);
    node.flutterDepth.connect(node.delay.delayTime);

    // Audio path (Track 3: Program Material):
    // delay -> highpass -> warmth -> cartridgePeak -> lofiResonance -> lowpass -> shaper -> makeup -> trackCueGate -> wet
    node.delay.connect(node.highpass);
    node.highpass.connect(node.warmth);
    node.warmth.connect(node.cartridgePeak);
    node.cartridgePeak.connect(node.lofiResonance);
    node.lofiResonance.connect(node.lowpass);
    node.lowpass.connect(node.shaper);
    node.shaper.connect(node.makeup);
    node.makeup.connect(node.trackCueGate);

    // Inner Groove Distortion (IGD / Sibilance rasp branch)
    node.makeup.connect(node.igdFilter);
    node.igdFilter.connect(node.igdShaper);
    node.igdShaper.connect(node.igdGain);
    node.igdGain.connect(node.trackCueGate);

    node.trackCueGate.connect(node.wet);
    node.trackCueGate.gain.value = 1;

    // Procedural surface noise path (Track 1 & Track 2):
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
    this.#sfxGains.clear();
    this.#sfxSources.clear();
    this.#loop("hiss", this.#pinkNoiseBuffer(), node.hissTone);
    this.#loop("rumble", this.#rumbleBuffer(), node.rumbleTone);
    this.#loadSamples();
    return this;
  }

  update(settings = {}, rampSeconds = 0.03) {
    const node = this.#nodes;
    if (!node) return;

    // TK-134 (Spec 148): 3-Track Physical Vinyl Synthesizer:
    // Track 1 (Noise & Rumble): rumbleLevel (0..1), surfaceLevel (0..1)
    // Track 2 (Clicks, Pops & Crackle): crackleLevel (0..1), popLevel (0..1)
    // Track 3 (Program Material): tonalWarmth (0..10), saturation (0..10), innerGrooveDistortion (0..10), wowFlutter (0..10)
    const rumbleLevel = Math.max(0, finiteOr(settings.rumbleLevel, 0.0));
    const surfaceLevel = settings.surfaceLevel !== undefined
      ? Math.max(0, finiteOr(settings.surfaceLevel, 0.15))
      : (settings.noiseLevel !== undefined ? Math.max(0, finiteOr(settings.noiseLevel, 0.15)) : 0.15);

    const crackleLevel = Math.max(0, finiteOr(settings.crackleLevel, 0.12));
    const popLevel = Math.max(0, finiteOr(settings.popLevel, 0.35));

    let tonalWarmth = 5.0;
    if (settings.tonalWarmth !== undefined) {
      tonalWarmth = Math.max(0, Math.min(10, finiteOr(settings.tonalWarmth, 5.0)));
    } else if (settings.warmth !== undefined) {
      tonalWarmth = Math.max(0, Math.min(10, finiteOr(settings.warmth, 5.0)));
    } else if (settings.dryGramophone !== undefined) {
      tonalWarmth = Math.max(0, Math.min(10, finiteOr(settings.dryGramophone, 5.0)));
    }

    const saturation = settings.saturation !== undefined
      ? Math.max(0, Math.min(10, finiteOr(settings.saturation, 2.0)))
      : 2.0;

    const igd = Math.max(0, Math.min(10, finiteOr(settings.innerGrooveDistortion, 0.0)));

    let wowFlutter = 3.0;
    if (settings.wowFlutter !== undefined) {
      wowFlutter = Math.max(0, Math.min(10, finiteOr(settings.wowFlutter, 3.0)));
    } else if (settings.softVinyl !== undefined) {
      wowFlutter = Math.max(0, Math.min(10, finiteOr(settings.softVinyl, 3.0)));
    }

    const tw = tonalWarmth / 10;
    const wf = wowFlutter / 10;

    // Track 3: Wow & Flutter (0.55 Hz rotation 33⅓ + 6.5 Hz flutter)
    // Base delay 20 ms so delay time never clips to 0 when wow sways by up to 16 ms
    const baseDelayMs = settings.baseDelayMs !== undefined ? Math.max(0, finiteOr(settings.baseDelayMs, 20)) : 20;
    const wowHz = Math.max(0, finiteOr(settings.wowHz, 0.55));
    const flutterHz = Math.max(0, finiteOr(settings.flutterHz, 6.5));
    // At 10, wowDepthMs is 16 ms: produces ~90 cents (almost a full semitone) deep unmistakable vinyl warp sway!
    const wowDepthMs = settings.wowDepthMs !== undefined
      ? Math.max(0, finiteOr(settings.wowDepthMs, 1.2))
      : (0.2 + wf * 15.8);
    const flutterDepthMs = settings.flutterDepthMs !== undefined
      ? Math.max(0, finiteOr(settings.flutterDepthMs, 0.15))
      : (0.02 + wf * 0.6);

    this.#param("baseDelayMs", node.delay.delayTime, baseDelayMs / 1000);
    this.#param("wowHz", node.wowOsc.frequency, wowHz);
    this.#param("flutterHz", node.flutterOsc.frequency, flutterHz);
    this.#param("flutterDepthMs", node.flutterDepth.gain, flutterDepthMs / 1000);
    this.#param("wowDepthMs", node.wowDepth.gain, wowDepthMs / 1000);

    // Track 3: Frequency Profile (Tonal Warmth EQ)
    // - Lowpass: sweeps from 16,000 Hz down to 4,200 Hz (heavy warm vintage vinyl acoustic roll-off, instantly heard on phones!)
    // - Highpass: sweeps from 25 Hz up to 220 Hz (removes modern sub-bass, creates dry vintage gramophone low end)
    // - Warmth: lowshelf at 250 Hz boosts up to +8 dB for rich vocal body
    // - Cartridge peak: at 8.5 kHz boosts presence
    let highpassHz = settings.highpassHz !== undefined ? finiteOr(settings.highpassHz, 25) : Math.round(25 + tw * 195);
    let warmthHz = settings.warmthHz !== undefined ? finiteOr(settings.warmthHz, 250) : 250;
    let warmthGainDb = settings.warmthGainDb !== undefined ? finiteOr(settings.warmthGainDb, tw * 8.0) : (tw * 8.0);
    let lowpassHz = settings.lowpassHz !== undefined ? finiteOr(settings.lowpassHz, Math.round(16000 - tw * 11800)) : Math.round(16000 - tw * 11800);

    this.#param("highpassHz", node.highpass.frequency, highpassHz);
    this.#param("warmthHz", node.warmth.frequency, warmthHz);
    this.#param("warmthGainDb", node.warmth.gain, warmthGainDb);
    this.#param("cartridgePeakGain", node.cartridgePeak.gain, 1.0 + tw * 3.5);
    this.#param("lowpassHz", node.lowpass.frequency, lowpassHz);

    // Track 3: Asymmetric Soft-clipper with dominant 2nd harmonic
    // Multiplies drive into the waveshaper curve (up to 9.5x) so quiet broadcast streams actually enter saturation
    const drive = settings.drive !== undefined
      ? Math.max(0.1, finiteOr(settings.drive, 1.0))
      : (1.0 + saturation * 0.85);

    if (this.#applied.drive !== drive) {
      node.shaper.curve = VinylRack.asymmetricCurve(drive);
      node.shaper.oversample = "2x";
      this.#applied.drive = drive;
    }
    this.#param("makeup", node.makeup.gain,
      (1 / Math.max(1e-6, VinylRack.peak(drive))) * Math.max(0, finiteOr(settings.outputGain, 1)));

    // Track 3: Inner Groove Distortion (IGD / Sibilance rasp)
    const igdGainValue = (igd / 10) * 0.65;
    this.#param("igdGain", node.igdGain.gain, igdGainValue);
    if (this.#applied.igd !== igd) {
      node.igdShaper.curve = VinylRack.igdCurve(igd / 10);
      node.igdShaper.oversample = "2x";
      this.#applied.igd = igd;
    }

    // Track 1: Mechanical Noise & Rumble
    const rumbleHz = Math.max(10, finiteOr(settings.rumbleHz, 25));
    const rumbleGain = settings.rumbleLevel !== undefined
      ? finiteOr(settings.rumbleLevel, rumbleLevel * 0.18)
      : rumbleLevel * 0.18;
    this.#param("rumbleHz", node.rumbleTone.frequency, rumbleHz);
    this.#param("rumbleLevel", node.rumble.gain, rumbleGain);

    const surfaceGain = settings.hissLevel !== undefined
      ? finiteOr(settings.hissLevel, surfaceLevel * 0.14)
      : surfaceLevel * 0.14;
    this.#param("hissLevel", node.hiss.gain, surfaceGain);

    // Track 2: Clicks, Pops & Crackle
    const dynamicCrackleRate = Math.max(2, Math.round(2 + crackleLevel * crackleLevel * 38));
    const crackleRate = settings.crackleRate !== undefined
      ? Math.max(0, finiteOr(settings.crackleRate, dynamicCrackleRate))
      : dynamicCrackleRate;
    this.#param("crackleToneHz", node.crackleTone.frequency, finiteOr(settings.crackleToneHz, 4500));
    this.#param("crackleLevel", node.crackle.gain, crackleLevel * 2.2);
    if (this.#applied.crackleRate !== crackleRate) {
      this.#loop("crackle", this.#clickBuffer(crackleRate, 0.0012, false), node.crackleTone);
      this.#applied.crackleRate = crackleRate;
    }

    const dynamicPopRate = Number((0.08 + popLevel * popLevel * 2.8).toFixed(2));
    const popRate = settings.popRate !== undefined
      ? Math.max(0, finiteOr(settings.popRate, dynamicPopRate))
      : dynamicPopRate;
    this.#param("popLevel", node.pops.gain, popLevel * 1.8);
    if (this.#applied.popRate !== popRate) {
      this.#loop("pops", this.#clickBuffer(popRate, 0.005, true), node.pops);
      this.#applied.popRate = popRate;
    }

    // Procedural surface noise active
    this.#param("sampledGain", node.sampledSurface.gain, 0);
    this.#param("proceduralGain", node.proceduralSurface.gain, 1);

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

    // TK-132: SFX overlay tracks (vinyl-1 .. vinyl-6)
    const sfxSettings = settings.sfx || {};
    if (!this.#applied.sfx) this.#applied.sfx = {};
    for (const [id, filePath] of Object.entries(VINYL_SFX_FILES)) {
      const trackCfg = sfxSettings[id] || {};
      const isTrackEnabled = trackCfg.enabled === true;
      const targetGain = isTrackEnabled ? Math.max(0, Math.min(1, finiteOr(trackCfg.volume, 0.5))) : 0;

      let gainNode = this.#sfxGains.get(id);
      if (!gainNode && this.#context && node) {
        gainNode = this.#context.createGain();
        gainNode.gain.value = 0;
        gainNode.connect(node.wet);
        this.#sfxGains.set(id, gainNode);
      }
      if (gainNode) {
        gainNode.gain.value = targetGain;
      }

      if (isTrackEnabled && targetGain > 0) {
        if (this.#sfxBuffers.has(id)) {
          this.#startSfxSource(id, this.#sfxBuffers.get(id), gainNode);
        } else {
          this.#loadSfxBuffer(id, filePath).then((buf) => {
            if (buf && this.#nodes && this.#applied.sfx?.[id]?.enabled === true) {
              this.#startSfxSource(id, buf, this.#sfxGains.get(id));
            }
          });
        }
      } else {
        this.#stopSfxSource(id);
      }
      this.#applied.sfx[id] = { enabled: isTrackEnabled, volume: targetGain };
    }
  }

  // TK-126/128/129/133: Tonearm needle drop cueing with vinyl-6.mp3:
  // Plays authentic needle drop & lead-in groove (vinyl-6.mp3) once.
  // Music track is muted for the first 3.0s, then smoothly overlays in (3.0s..3.4s) while vinyl-6 sharply fades out (3.0s..3.25s).
  cueTonearm() {
    if (!this.#active || !this.#context || !this.#nodes) return;
    if (this.#applied.enabled === false || this.#applied.mix === 0) return;
    const buf = this.#sfxBuffers.get("vinyl-6");
    if (!buf) {
      this.#loadSfxBuffer("vinyl-6", VINYL_SFX_FILES["vinyl-6"]);
      return;
    }
    const now = Number(this.#context.currentTime) || 0;
    const gate = this.#nodes.trackCueGate;
    if (gate?.gain) {
      try {
        gate.gain.cancelScheduledValues?.(now);
        gate.gain.setValueAtTime?.(0, now);
        gate.gain.setValueAtTime?.(0, now + 3.0);
        gate.gain.linearRampToValueAtTime?.(1, now + 3.4);
      } catch {
        gate.gain.value = 1;
      }
    }

    for (const source of this.#cueSources) {
      try {
        source.stop?.();
        source.disconnect?.();
      } catch {}
    }
    this.#cueSources.clear();

    try {
      const source = this.#context.createBufferSource();
      const cueGain = this.#context.createGain();
      if (cueGain.gain?.setValueAtTime) {
        cueGain.gain.setValueAtTime(1, now);
        cueGain.gain.setValueAtTime(1, now + 3.0);
        cueGain.gain.linearRampToValueAtTime?.(0, now + 3.25);
      }
      source.buffer = buf;
      source.loop = false;
      source.connect(cueGain);
      cueGain.connect(this.#nodes.wet);
      source.start(now);
      try {
        source.stop?.(now + 3.3);
      } catch {}

      this.#cueSources.add(source);
      source.onended = () => {
        try {
          source.disconnect?.();
          cueGain.disconnect?.();
        } catch {}
        this.#cueSources.delete(source);
      };
    } catch {
      if (gate?.gain) gate.gain.value = 1;
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

    for (const source of this.#sfxSources.values()) {
      source.stop?.();
      source.disconnect?.();
    }
    this.#sfxSources.clear();

    for (const gain of this.#sfxGains.values()) {
      gain.disconnect?.();
    }
    this.#sfxGains.clear();

    this.#nodes?.wowOsc.stop();
    this.#nodes?.flutterOsc.stop();
    for (const node of Object.values(this.#nodes || {})) node.disconnect?.();
    this.#nodes = null;
    this.#sources = {};
    this.#context = null;
    this.#applied = {};
  }

  setSfxBuffer(id, buffer) {
    this.#sfxBuffers.set(id, buffer);
    const gainNode = this.#sfxGains.get(id);
    if (this.#applied.sfx?.[id]?.enabled && gainNode) {
      this.#startSfxSource(id, buffer, gainNode);
    }
  }

  #startSfxSource(id, buffer, destination) {
    if (!this.#context || !destination || !buffer) return;
    if (this.#context.state === "suspended") {
      this.#context.resume?.().catch?.(() => {});
    }
    if (this.#sfxSources.has(id)) return;
    try {
      const source = this.#context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(destination);
      source.start();
      this.#sfxSources.set(id, source);
    } catch {
      // AudioContext state or disposed
    }
  }

  #stopSfxSource(id) {
    const source = this.#sfxSources.get(id);
    if (!source) return;
    try {
      source.stop?.();
      source.disconnect?.();
    } catch {
      // already stopped/disconnected
    }
    this.#sfxSources.delete(id);
  }

  async #decodeAudio(arr) {
    if (!this.#context?.decodeAudioData) return null;
    return new Promise((resolve) => {
      try {
        const res = this.#context.decodeAudioData(
          arr,
          (buf) => resolve(buf),
          () => resolve(null)
        );
        if (res && typeof res.then === "function") {
          res.then(resolve).catch(() => resolve(null));
        }
      } catch {
        resolve(null);
      }
    });
  }

  async #loadSfxBuffer(id, filePath) {
    if (this.#sfxBuffers.has(id)) return this.#sfxBuffers.get(id);
    if (!this.#fetchRef || !this.#context?.decodeAudioData) return null;
    const buf = await this.#fetchAudio([filePath, `/${filePath}`, `./${filePath}`]);
    if (buf) this.#sfxBuffers.set(id, buf);
    return buf;
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
          const buf = await this.#decodeAudio(arr);
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
      // TK-133: Pre-load vinyl-6 for instantaneous authentic needle drop cueing on track switches
      await this.#loadSfxBuffer("vinyl-6", VINYL_SFX_FILES["vinyl-6"]);
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

  // Track 1: Paul Kellet's filtered pink/brown noise for surface friction (300 Hz - 8 kHz)
  #pinkNoiseBuffer() {
    const { buffer, length } = this.#buffer();
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i += 1) {
      const white = this.#rng.next() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  // Track 1: Low-frequency mechanical rumble (10-60 Hz with 11.2 Hz motor bearing resonance)
  #rumbleBuffer() {
    const { buffer, length, rate } = this.#buffer();
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = this.#rng.next() * 2 - 1;
      last = (last + 0.025 * white) / 1.025;
      const t = i / rate;
      const motorResonance = Math.sin(2 * Math.PI * 11.2 * t) * 0.12 * (0.8 + 0.4 * this.#rng.next());
      data[i] = last * 3.2 + motorResonance;
    }
    return buffer;
  }

  // Track 2: Clicks and Pops. For pops, adds ~16 kHz cantilever ringing.
  #clickBuffer(ratePerSecond, decaySeconds, isPop = false) {
    const { buffer, length, rate } = this.#buffer();
    const data = buffer.getChannelData(0);
    const count = Math.round(ratePerSecond * VinylRack.BUFFER_SECONDS);
    const decay = Math.max(1, Math.floor(decaySeconds * rate));
    const ringFreq = 16000;
    for (let click = 0; click < count; click += 1) {
      const start = Math.floor(this.#rng.next() * length);
      const amplitude = (0.35 + this.#rng.next() * 0.65) * (this.#rng.next() < 0.5 ? -1 : 1);
      for (let offset = 0; offset < decay * 4 && start + offset < length; offset += 1) {
        const env = Math.exp(-offset / decay);
        if (isPop) {
          const t = offset / rate;
          const ringing = Math.sin(2 * Math.PI * ringFreq * t) * 0.35;
          data[start + offset] += amplitude * env * (1 + ringing);
        } else {
          data[start + offset] += amplitude * env * (offset % 2 === 0 ? 1 : -0.6);
        }
      }
    }
    return buffer;
  }
}
