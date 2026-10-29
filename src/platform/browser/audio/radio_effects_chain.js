import { RetroRack } from "./retro_rack.js";
import { VinylRack } from "./vinyl_rack.js";
import { WalkieTalkieRack } from "./walkie_talkie_rack.js";
import { RadioRack } from "./radio_rack.js";

const RADIO_SWITCH_FILE = "assets/audio/radio/next_track-radio.mp3";

function resolveFetch(ref) {
  if (typeof ref === "function") return ref;
  if (typeof window !== "undefined" && typeof window.fetch === "function") {
    return window.fetch.bind(window);
  }
  if (typeof fetch === "function") return fetch;
  return null;
}

// TK-097, TK-124, TK-137, TK-138: the radio's sound effects between the stream player's input and output:
// input -> retro -> vinyl -> walkie-talkie -> radio -> streamCueGate -> output.
// Each stage passes the sound dry while it is disabled, so any combination can be on.
// update() applies CONFIG.radio.effects live (the player calls it about once a second);
// the player never decides the sound, only the configuration does.
export class RadioEffectsChain {
  #config;
  #retro;
  #vinyl;
  #walkieTalkie;
  #radio;
  #attached = false;
  #context = null;
  #output = null;
  #streamCueGate = null;
  #fetchRef;
  #radioSwitchBuffer = null;
  #radioCueSources = new Set();

  // config: () => CONFIG.radio.effects; rng: the radio's own { next() }.
  constructor({ config, rng, fetchRef = null }) {
    this.#config = config;
    this.#fetchRef = resolveFetch(fetchRef);
    this.#retro = new RetroRack();
    this.#vinyl = new VinylRack({ rng, fetchRef });
    this.#walkieTalkie = new WalkieTalkieRack();
    this.#radio = new RadioRack({ rng });
  }

  attach(context, input, output) {
    this.#context = context;
    this.#output = output;
    this.#streamCueGate = context.createGain();
    this.#streamCueGate.gain.value = 1;

    this.#retro.build(context);
    this.#vinyl.build(context);
    this.#walkieTalkie.build(context);
    this.#radio.build(context);
    input.connect(this.#retro.input);
    this.#retro.output.connect(this.#vinyl.input);
    this.#vinyl.output.connect(this.#walkieTalkie.input);
    this.#walkieTalkie.output.connect(this.#radio.input);
    this.#radio.output.connect(this.#streamCueGate);
    this.#streamCueGate.connect(output);
    this.#attached = true;
    this.update();
    this.#loadRadioSwitchBuffer();
  }

  update() {
    if (!this.#attached) return;
    const cfg = this.#config() || {};
    this.#retro.update(cfg.retro || {}, cfg.rampSeconds);
    this.#vinyl.update(cfg.vinyl || {}, cfg.rampSeconds);
    this.#walkieTalkie.update(cfg.walkieTalkie || {}, cfg.rampSeconds);
    this.#radio.update(cfg.radio || {}, cfg.rampSeconds);
  }

  setActive(active) {
    this.#vinyl?.setActive?.(active);
    this.#radio?.setActive?.(active);
  }

  // TK-137: Dispatches to vinyl-6 tonearm cue if vinyl is enabled, or next_track-radio if vinyl is disabled
  cueTrackSwitch() {
    const cfg = this.#config() || {};
    const vinylEnabled = cfg.vinyl?.enabled !== false && (cfg.vinyl?.mix === undefined || cfg.vinyl?.mix > 0);
    if (vinylEnabled) {
      this.cueVinyl();
    } else {
      this.cueRadioSwitch();
    }
  }

  cueVinyl() {
    this.#vinyl.cueTonearm();
  }

  cueVinylOff(onEnded) {
    return this.#vinyl?.cueTonearmOff?.(onEnded) || false;
  }

  setRadioSwitchBuffer(buf) {
    this.#radioSwitchBuffer = buf;
  }

  // TK-137: Plays next_track-radio.mp3 on radio frequency switch with 2.8s stream ducking
  cueRadioSwitch() {
    if (!this.#context || !this.#streamCueGate || !this.#output) return;
    const buf = this.#radioSwitchBuffer;
    if (!buf) {
      this.#loadRadioSwitchBuffer().then((loaded) => {
        if (loaded && this.#attached) this.cueRadioSwitch();
      });
      return;
    }
    const now = Number(this.#context.currentTime) || 0;
    const gate = this.#streamCueGate;
    if (gate?.gain) {
      try {
        gate.gain.cancelScheduledValues?.(now);
        gate.gain.setValueAtTime?.(0, now);
        gate.gain.setValueAtTime?.(0, now + 2.8);
        gate.gain.linearRampToValueAtTime?.(1, now + 3.2);
      } catch {
        gate.gain.value = 1;
      }
    }

    for (const source of this.#radioCueSources) {
      try {
        source.stop?.();
        source.disconnect?.();
      } catch {}
    }
    this.#radioCueSources.clear();

    try {
      const source = this.#context.createBufferSource();
      const cueGain = this.#context.createGain();
      if (cueGain.gain?.setValueAtTime) {
        cueGain.gain.setValueAtTime(1, now);
        cueGain.gain.setValueAtTime(1, now + 2.9);
        cueGain.gain.linearRampToValueAtTime?.(0, now + 3.25);
      }
      source.buffer = buf;
      source.loop = false;
      source.connect(cueGain);
      cueGain.connect(this.#output);
      source.start(now);
      try {
        source.stop?.(now + 3.3);
      } catch {}

      this.#radioCueSources.add(source);
      source.onended = () => {
        try {
          source.disconnect?.();
          cueGain.disconnect?.();
        } catch {}
        this.#radioCueSources.delete(source);
      };
    } catch {
      if (gate?.gain) gate.gain.value = 1;
    }
  }

  async #loadRadioSwitchBuffer() {
    if (this.#radioSwitchBuffer) return this.#radioSwitchBuffer;
    if (!this.#fetchRef || !this.#context?.decodeAudioData) return null;
    const paths = [RADIO_SWITCH_FILE, `/${RADIO_SWITCH_FILE}`, `./${RADIO_SWITCH_FILE}`];
    for (const p of paths) {
      try {
        const res = await this.#fetchRef(p);
        if (res?.ok && this.#context) {
          const arr = await res.arrayBuffer();
          const buf = await this.#decodeAudio(arr);
          if (buf) {
            this.#radioSwitchBuffer = buf;
            return buf;
          }
        }
      } catch {}
    }
    return null;
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

  dispose() {
    for (const source of this.#radioCueSources) {
      try {
        source.stop?.();
        source.disconnect?.();
      } catch {}
    }
    this.#radioCueSources.clear();
    this.#streamCueGate?.disconnect?.();
    this.#streamCueGate = null;
    this.#context = null;
    this.#output = null;
    this.#retro.dispose();
    this.#vinyl.dispose();
    this.#walkieTalkie.dispose();
    this.#radio.dispose();
    this.#attached = false;
  }
}
