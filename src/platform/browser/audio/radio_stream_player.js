// Spec 142: plays one live stream. First through Web Audio (crossOrigin "anonymous", MediaElementAudioSourceNode ->
// effects input -> output gain), so volume, ducking and the walkie-talkie rack apply. A stream without CORS headers
// fails to load that way, and an element once connected to Web Audio can never go back to the native output, so the
// fallback is a NEW element without crossOrigin on the native output ("no effect"). Each attempt has startTimeoutMs.
// States reported to onState: "loading", "playing" { effects }, "failed".
export class RadioStreamPlayer {
  #documentRef;
  #audioContexts;
  #scheduler;
  #config;
  #onState;
  #output = null;
  #input = null;
  #gate = null;
  #stream = null;
  #streamMuted = false;
  #catchUpTimer = null;
  #element = null;
  #sourceNode = null;
  #timer = null;
  #url = null;
  #attempt = null;
  #volume = 1;
  #gainScale = 1;
  #listeners = [];
  #effects;
  #effectsGate = null;
  #active = false;

  // effects: an optional chain { attach(context, input, output), update(), dispose() } between input and output.
  constructor({ documentRef, audioContexts, scheduler, config, onState, effects = null }) {
    this.#documentRef = documentRef;
    this.#audioContexts = audioContexts;
    this.#scheduler = scheduler;
    this.#config = config;
    this.#onState = typeof onState === "function" ? onState : () => {};
    this.#effects = effects;
  }

  // Re-reads the effects' configuration (DevTools edits apply live; only streams played through Web Audio have them).
  refreshEffects(powered = null) {
    this.#ensureGraph();
    if (powered !== null) {
      this.#active = powered === true && (this.#attempt !== null || Boolean(this.#element));
      this.#effects?.setActive?.(this.#active);
      if (this.#effectsGate) this.#effectsGate.gain.value = this.#active ? 1 : 0;
    }
    this.#effects?.update();
  }

  // The node streams feed (effects racks connect between it and the output); built on first use.
  get input() {
    this.#ensureGraph();
    return this.#input;
  }

  // The volume node everything the radio plays ends in (the stream and the noise, stage 4), or null before a context.
  get output() {
    this.#ensureGraph();
    return this.#output;
  }

  // TK-125: the gate node between effects and stream; discharge crackles duck it to 0 sharply without smoothness.
  get streamGate() {
    this.#ensureGraph();
    return this.#gate;
  }

  // A dropout (stage 4): silences the station alone; the noise on the output stays.
  setStreamMuted(muted) {
    this.#streamMuted = muted === true;
    if (this.#stream) this.#stream.gain.value = this.#streamMuted ? 0 : 1;
    if (this.#element && this.#attempt === "native") this.#element.muted = this.#streamMuted;
  }

  #clearCatchUpTimer() {
    if (this.#catchUpTimer) {
      this.#scheduler.clearTimeout(this.#catchUpTimer);
      this.#catchUpTimer = null;
    }
  }

  // TK-124: complete interruption of the station during dropouts with optional catch-up playback
  setStreamInterrupted(interrupted, { catchUp = false, catchUpRate = 1.4, catchUpSeconds = 3 } = {}) {
    if (interrupted) {
      this.setStreamMuted(true);
      if (this.#element && !this.#element.paused) {
        this.#element.pause?.();
      }
    } else {
      this.setStreamMuted(false);
      if (this.#element) {
        this.#element.play?.().catch?.(() => {});
        this.#clearCatchUpTimer();
        if (catchUp) {
          const rate = Math.max(1.1, Math.min(2.0, Number(catchUpRate) || 1.4));
          this.#element.playbackRate = rate;
          const durationMs = Math.max(500, Math.round((Number(catchUpSeconds) || 3) * 1000));
          this.#catchUpTimer = this.#scheduler.setTimeout(() => {
            if (this.#element) this.#element.playbackRate = 1.0;
            this.#catchUpTimer = null;
          }, durationMs);
        } else {
          this.#element.playbackRate = 1.0;
        }
      }
    }
  }

  play(url) {
    this.stop();
    this.#url = String(url || "");
    if (!this.#url) return;
    this.#active = true;
    this.cueVinyl();
    this.#start(this.#audioContexts.get() ? "effects" : "native");
  }

  // TK-126/128: triggers tonearm needle drop sound effect if vinyl is active
  cueVinyl() {
    this.#effects?.cueVinyl?.();
  }

  stop() {
    this.#clearTimer();
    this.#clearCatchUpTimer();
    if (this.#element) this.#element.playbackRate = 1.0;
    this.#releaseElement();
    this.#url = null;
    this.#attempt = null;
    this.#active = false;
    this.#effects?.setActive?.(false);
    if (this.#effectsGate) this.#effectsGate.gain.value = 0;
  }

  setVolume(volume) {
    this.#volume = Math.max(0, Math.min(1, Number(volume) || 0));
    this.#applyVolume();
  }

  // A multiplier on the volume (the weak signal's sag, ducking), 0..1, eased over CONFIG.radio.ducking.rampSeconds so a
  // duck never clicks; the native fallback element takes it at once.
  setGainScale(scale) {
    const value = Math.max(0, Math.min(1, Number(scale) || 0));
    if (value === this.#gainScale) return;
    this.#gainScale = value;
    this.#applyVolume(true);
  }

  dispose() {
    this.stop();
    this.#effects?.dispose();
    this.#effectsGate?.disconnect?.();
    this.#gate?.disconnect?.();
    this.#stream?.disconnect?.();
    this.#output?.disconnect?.();
    this.#input?.disconnect?.();
    this.#effectsGate = null;
    this.#gate = null;
    this.#stream = null;
    this.#output = null;
    this.#input = null;
  }

  #start(mode) {
    this.#attempt = mode;
    const element = this.#documentRef.createElement("audio");
    element.preload = "none";
    if (mode === "effects") element.crossOrigin = "anonymous";
    this.#element = element;
    this.#listen(element, "playing", () => {
      if (this.#element !== element) return;
      this.#clearTimer();
      this.#onState("playing", { effects: mode === "effects" });
    });
    this.#listen(element, "error", () => this.#fail(element));
    this.#listen(element, "ended", () => {
      if (this.#element !== element) return;
      this.#clearTimer();
      this.#onState("ended", { effects: mode === "effects" });
    });
    if (mode === "effects") {
      this.#ensureGraph();
      this.#active = true;
      if (this.#effectsGate) this.#effectsGate.gain.value = 1;
      this.#effects?.setActive?.(true);
      this.#sourceNode = this.#audioContexts.get().createMediaElementSource(element);
      this.#sourceNode.connect(this.#input);
    }
    this.#applyVolume();
    if (mode === "native") element.muted = this.#streamMuted;
    element.src = this.#url;
    this.#onState("loading", { effects: mode === "effects" });
    const timeout = Math.max(1, Number(this.#config()?.startTimeoutMs) || 5000);
    this.#timer = this.#scheduler.setTimeout(() => this.#fail(element), timeout);
    const started = element.play?.();
    started?.catch?.(() => this.#fail(element));
  }

  #fail(element) {
    if (this.#element !== element) return;
    this.#clearTimer();
    const retryNative = this.#attempt === "effects";
    this.#releaseElement();
    if (retryNative && this.#url) this.#start("native");
    else this.#onState("failed", {});
  }

  #ensureGraph() {
    if (this.#output) return;
    const context = this.#audioContexts.get();
    if (!context) return;
    this.#output = context.createGain();
    this.#input = context.createGain();
    this.#gate = context.createGain();
    this.#gate.gain.value = 1;
    this.#effectsGate = context.createGain();
    this.#effectsGate.gain.value = this.#active ? 1 : 0;
    // input -> [rack] -> effectsGate (radio off mute) -> gate (sharp crackle ducking) -> stream (dropouts) -> output (volume, ducking) -> destination
    this.#stream = context.createGain();
    this.#stream.gain.value = this.#streamMuted ? 0 : 1;
    if (this.#effects) {
      this.#effects.attach(context, this.#input, this.#effectsGate);
      this.#effects.setActive?.(this.#active);
    } else {
      this.#input.connect(this.#effectsGate);
    }
    this.#effectsGate.connect(this.#gate);
    this.#gate.connect(this.#stream);
    this.#stream.connect(this.#output);
    this.#output.connect(context.destination);
    this.#applyVolume();
  }

  #applyVolume(eased = false) {
    const value = this.#volume * this.#gainScale;
    const context = this.#audioContexts.peek();
    const ramp = Math.max(0.001, Number(this.#config()?.ducking?.rampSeconds) || 0.15);
    if (this.#output && eased && context) {
      this.#output.gain.setTargetAtTime(value, Number(context.currentTime) || 0, ramp);
    } else if (this.#output) this.#output.gain.value = value;
    if (this.#element && this.#attempt === "native") this.#element.volume = value;
  }

  #listen(element, type, handler) {
    element.addEventListener(type, handler);
    this.#listeners.push([element, type, handler]);
  }

  #releaseElement() {
    for (const [element, type, handler] of this.#listeners) element.removeEventListener(type, handler);
    this.#listeners = [];
    if (this.#sourceNode) {
      this.#sourceNode.disconnect?.();
      this.#sourceNode = null;
    }
    if (this.#element) {
      this.#element.pause?.();
      this.#element.removeAttribute?.("src");
      this.#element.load?.();
      this.#element = null;
    }
  }

  #clearTimer() {
    if (this.#timer !== null) this.#scheduler.clearTimeout(this.#timer);
    this.#timer = null;
  }
}
