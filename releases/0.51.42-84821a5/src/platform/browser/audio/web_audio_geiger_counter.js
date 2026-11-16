// Spec 179 stage D, TK-339: the Geiger counter's clicks through WebAudio, beside the radiation's hiss on the scene.
// - Its own AudioContext, made on the player's first gesture (pointer, key or touch): browsers keep a context made
//   earlier suspended (autoplay policy), and the game must not depend on the radio having been switched on.
// - One click sound generated in code (no file): a few milliseconds of noise with a fast decay and a short ring at
//   toneHz — remade only when toneHz or clickMs change.
// - tick() plans the clicks (GeigerClickPlanner) from where the last plan ended up to LOOKAHEAD_SEC ahead of the audio
//   clock and schedules them there, so a late or throttled timer neither bunches nor drops clicks; while the page is
//   hidden nothing is planned. Each click is a buffer source into one master gain (volume); a slight random rate and
//   level keep the clicks from sounding identical.
const LOOKAHEAD_SEC = 0.2;
const LEAD_SEC = 0.02;
const GESTURES = Object.freeze(["pointerdown", "keydown", "touchstart"]);

const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export class WebAudioGeigerCounter {
  #windowRef;
  #planner;
  #getSettings;
  #getRadiation;
  #random;
  #context = null;
  #master = null;
  #click = null;
  #clickKey = "";
  #scheduledUntil = 0;
  #hidden = false;
  #unlock = () => this.#open();

  // windowRef: AudioContext and the gesture events; planner: GeigerClickPlanner; getSettings: () => CONFIG.ui.audio.geiger;
  // getRadiation: () => the location's radiation 0…1; random: () => 0…1 (the clicks' noise and variety).
  constructor({ windowRef, planner, getSettings, getRadiation, random = Math.random }) {
    if (typeof planner?.plan !== "function") throw new TypeError("WebAudioGeigerCounter requires planner");
    if (typeof getSettings !== "function" || typeof getRadiation !== "function") {
      throw new TypeError("WebAudioGeigerCounter requires getSettings and getRadiation");
    }
    this.#windowRef = windowRef;
    this.#planner = planner;
    this.#getSettings = getSettings;
    this.#getRadiation = getRadiation;
    this.#random = random;
    for (const type of GESTURES) windowRef.addEventListener(type, this.#unlock, { capture: true, passive: true });
  }

  // The page hidden: silence (and no backlog of clicks when it comes back).
  setPageHidden(hidden) {
    this.#hidden = hidden === true;
  }

  // Called a few times a second (MonotonicIntervalTicker).
  tick() {
    const context = this.#context;
    if (!context || context.state !== "running") return;
    const settings = this.#getSettings();
    const now = context.currentTime;
    const start = Math.max(this.#scheduledUntil, now + LEAD_SEC);
    const end = now + LOOKAHEAD_SEC;
    if (this.#hidden || settings?.enabled !== true) {
      this.#planner.plan(0, 0, settings);
      this.#scheduledUntil = end;
      return;
    }
    if (end <= start) return;
    this.#master.gain.value = Math.max(0, Math.min(1, number(settings.volume, 0.4)));
    const count = this.#planner.plan(end - start, this.#getRadiation(), settings);
    const click = this.#clickBuffer(settings);
    const times = this.#planner.times;
    for (let index = 0; index < count; index += 1) this.#play(click, start + times[index]);
    this.#scheduledUntil = end;
  }

  dispose() {
    for (const type of GESTURES) this.#windowRef.removeEventListener(type, this.#unlock, { capture: true });
    this.#context?.close?.().catch?.(() => {});
    this.#context = null;
  }

  #open() {
    if (!this.#context) {
      const AudioContextClass = this.#windowRef.AudioContext || this.#windowRef.webkitAudioContext;
      if (!AudioContextClass) return;
      this.#context = new AudioContextClass();
      this.#master = this.#context.createGain();
      this.#master.gain.value = 0;
      this.#master.connect(this.#context.destination);
    }
    // resume() settles later (asynchronously); the gesture listeners go once the context really runs.
    const stopListening = () => {
      if (this.#context?.state !== "running") return;
      for (const type of GESTURES) this.#windowRef.removeEventListener(type, this.#unlock, { capture: true });
    };
    if (this.#context.state === "suspended") this.#context.resume?.().then?.(stopListening, () => {});
    else stopListening();
  }

  #play(buffer, at) {
    const source = this.#context.createBufferSource();
    const gain = this.#context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = 0.9 + this.#random() * 0.2;
    gain.gain.value = 0.7 + this.#random() * 0.3;
    source.connect(gain);
    gain.connect(this.#master);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
    source.start(at);
  }

  // A click: noise × a fast decay, plus a short ring at toneHz (the counter's speaker), clickMs long.
  #clickBuffer(settings) {
    const toneHz = Math.max(200, number(settings.toneHz, 3500));
    const clickMs = Math.max(1, number(settings.clickMs, 4));
    const key = `${toneHz}:${clickMs}`;
    if (this.#click && this.#clickKey === key) return this.#click;
    const rate = this.#context.sampleRate || 44100;
    const length = Math.max(8, Math.round((rate * clickMs) / 1000));
    const buffer = this.#context.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    const decay = length / 5;
    for (let index = 0; index < length; index += 1) {
      const envelope = Math.exp(-index / decay);
      const noise = this.#random() * 2 - 1;
      const ring = Math.sin((2 * Math.PI * toneHz * index) / rate);
      data[index] = envelope * (0.65 * noise + 0.35 * ring);
    }
    this.#click = buffer;
    this.#clickKey = key;
    return buffer;
  }
}
