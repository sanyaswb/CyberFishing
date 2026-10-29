// Spec 142 stage 4, TK-125: the radio's hiss and crackle on the player's output (after the rack, under the volume and the
// ducking). A looped 2 s white-noise buffer feeds a hiss gain and a crackle gain; crackles are short bursts scheduled
// on the crackle gain for the next second (AudioParam events, no per-frame work). Random numbers come from the
// injected radio RNG, never the gameplay RNG.
// TK-125: discharge crackles sharply duck the stream gate node without smoothness, and dropout bursts match track loudness.
export class RadioNoiseSource {
  #audioContexts;
  #getOutput;
  #getGate;
  #rng;
  #source = null;
  #hiss = null;
  #crackle = null;

  // audioContexts: SharedAudioContextProvider; getOutput: () => the player's output node;
  // getGate: () => the player's stream gate node (for sharp track ducking on crackles); rng: { next() }.
  constructor({ audioContexts, getOutput, getGate = null, rng }) {
    this.#audioContexts = audioContexts;
    this.#getOutput = getOutput;
    this.#getGate = typeof getGate === "function" ? getGate : null;
    this.#rng = rng;
  }

  // level: the hiss gain; cracklesPerSecond: bursts in the next `seconds`.
  update(level, cracklesPerSecond, seconds = 1) {
    if (!this.#ensure()) return;
    const context = this.#audioContexts.peek();
    const now = Number(context.currentTime) || 0;
    this.#hiss.gain.setTargetAtTime(Math.max(0, Number(level) || 0), now, 0.1);
    const count = Math.floor(Math.max(0, Number(cracklesPerSecond) || 0) * seconds + this.#rng.next());
    if (count <= 0) return;

    const intervals = [];
    for (let index = 0; index < count; index += 1) {
      const at = now + this.#rng.next() * seconds;
      const dur = 0.012 + this.#rng.next() * 0.028;
      const crackleGain = 0.10 + this.#rng.next() * 0.12;
      intervals.push({ at, end: at + dur, crackleGain });
    }
    intervals.sort((a, b) => a.at - b.at);

    for (const item of intervals) {
      this.#crackle.gain.setValueAtTime?.(item.crackleGain, item.at);
      this.#crackle.gain.setValueAtTime?.(0, item.end);
    }

    // TK-125: discharge crackles sharply duck the track without smoothness
    const gateParam = this.#getGate?.()?.gain;
    if (gateParam?.setValueAtTime) {
      const merged = [];
      for (const item of intervals) {
        const prev = merged[merged.length - 1];
        if (prev && item.at <= prev.end) {
          prev.end = Math.max(prev.end, item.end);
        } else {
          merged.push({ at: item.at, end: item.end });
        }
      }
      for (const { at, end } of merged) {
        gateParam.setValueAtTime(0, at);
        gateParam.setValueAtTime(1, end);
      }
    }
  }

  // TK-124..125: a dropout / glitch: a burst of radio hiss and micro-glitches matching the track loudness.
  burst(seconds, hissLevel = 0.08) {
    if (!this.#ensure()) return;
    const now = Number(this.#audioContexts.peek().currentTime) || 0;
    const duration = Math.max(0.05, Number(seconds) || 0);
    const targetHiss = Math.max(0.01, Math.min(0.2, Number(hissLevel) || 0.08));
    this.#hiss.gain.setValueAtTime?.(targetHiss, now);
    this.#hiss.gain.setValueAtTime?.(0, now + duration);
    this.#crackle.gain.setValueAtTime?.(0.12, now);
    const glitchCount = Math.floor(duration * 6) + 1;
    for (let index = 0; index < glitchCount; index += 1) {
      const at = now + (index / glitchCount) * duration;
      this.#crackle.gain.setValueAtTime?.(0.10 + this.#rng.next() * 0.06, at);
      this.#crackle.gain.setValueAtTime?.(0.02, at + 0.015 + this.#rng.next() * 0.02);
    }
    this.#crackle.gain.setValueAtTime?.(0, now + duration);
  }

  stop() {
    this.#source?.stop?.();
    this.#source?.disconnect?.();
    this.#hiss?.disconnect?.();
    this.#crackle?.disconnect?.();
    this.#source = null;
    this.#hiss = null;
    this.#crackle = null;
    const gateParam = this.#getGate?.()?.gain;
    if (gateParam) {
      const now = Number(this.#audioContexts.peek()?.currentTime) || 0;
      gateParam.cancelScheduledValues?.(now);
      gateParam.value = 1;
    }
  }

  dispose() {
    this.stop();
  }

  #ensure() {
    if (this.#source) return true;
    const context = this.#audioContexts.peek();
    const output = this.#getOutput();
    if (!context || !output) return false;
    const length = Math.max(1, Math.floor((Number(context.sampleRate) || 44100) * 2));
    const buffer = context.createBuffer(1, length, Number(context.sampleRate) || 44100);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = this.#rng.next() * 2 - 1;
    this.#source = context.createBufferSource();
    this.#source.buffer = buffer;
    this.#source.loop = true;
    this.#hiss = context.createGain();
    this.#hiss.gain.value = 0;
    this.#crackle = context.createGain();
    this.#crackle.gain.value = 0;
    this.#source.connect(this.#hiss);
    this.#source.connect(this.#crackle);
    this.#hiss.connect(output);
    this.#crackle.connect(output);
    this.#source.start?.();
    return true;
  }
}
