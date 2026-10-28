// Spec 142 stage 4: the radio's hiss and crackle on the player's output (after the rack, under the volume and the
// ducking). A looped 2 s white-noise buffer feeds a hiss gain and a crackle gain; crackles are short bursts scheduled
// on the crackle gain for the next second (AudioParam events, no per-frame work). Random numbers come from the
// injected radio RNG, never the gameplay RNG.
export class RadioNoiseSource {
  #audioContexts;
  #getOutput;
  #rng;
  #source = null;
  #hiss = null;
  #crackle = null;

  // audioContexts: SharedAudioContextProvider; getOutput: () => the player's output node; rng: { next() }.
  constructor({ audioContexts, getOutput, rng }) {
    this.#audioContexts = audioContexts;
    this.#getOutput = getOutput;
    this.#rng = rng;
  }

  // level: the hiss gain; cracklesPerSecond: bursts in the next `seconds`.
  update(level, cracklesPerSecond, seconds = 1) {
    if (!this.#ensure()) return;
    const context = this.#audioContexts.peek();
    const now = Number(context.currentTime) || 0;
    this.#hiss.gain.setTargetAtTime(Math.max(0, Number(level) || 0), now, 0.1);
    const count = Math.floor(Math.max(0, Number(cracklesPerSecond) || 0) * seconds + this.#rng.next());
    for (let index = 0; index < count; index += 1) {
      const at = now + this.#rng.next() * seconds;
      this.#crackle.gain.setValueAtTime(0.2 + this.#rng.next() * 0.5, at);
      this.#crackle.gain.setValueAtTime(0, at + 0.01 + this.#rng.next() * 0.04);
    }
  }

  // A dropout / glitch: a burst of prominent radio hiss and crackles for its length.
  burst(seconds, hissLevel = 0.3) {
    if (!this.#ensure()) return;
    const now = Number(this.#audioContexts.peek().currentTime) || 0;
    const duration = Math.max(0.05, Number(seconds) || 0);
    const targetHiss = Math.max(0.1, Number(hissLevel) || 0.3);
    this.#hiss.gain.setValueAtTime(targetHiss, now);
    this.#hiss.gain.setValueAtTime(0, now + duration);
    this.#crackle.gain.setValueAtTime(0.4, now);
    const glitchCount = Math.floor(duration * 6) + 1;
    for (let index = 0; index < glitchCount; index += 1) {
      const at = now + (index / glitchCount) * duration;
      this.#crackle.gain.setValueAtTime(0.3 + this.#rng.next() * 0.4, at);
      this.#crackle.gain.setValueAtTime(0.05, at + 0.02 + this.#rng.next() * 0.03);
    }
    this.#crackle.gain.setValueAtTime(0, now + duration);
  }

  stop() {
    this.#source?.stop?.();
    this.#source?.disconnect?.();
    this.#hiss?.disconnect?.();
    this.#crackle?.disconnect?.();
    this.#source = null;
    this.#hiss = null;
    this.#crackle = null;
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
