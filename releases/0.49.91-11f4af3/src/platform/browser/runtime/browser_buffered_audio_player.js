export class BrowserBufferedAudioPlayer {
  #src;
  #context = null;
  #buffer = null;
  #loadPromise = null;
  #fallbackPool = null;
  #fallbackCursor = 0;

  constructor(src, fallbackPoolSize = 4) {
    this.#src = src;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (AudioContextClass) {
      this.#context = new AudioContextClass();
      this.#loadPromise = this.#load();
    } else {
      this.#fallbackPool = [];
      for (let i = 0; i < fallbackPoolSize; i++) {
        this.#fallbackPool.push(new Audio(src));
      }
    }
  }

  get src() {
    return this.#src;
  }

  async #load() {
    const response = await fetch(this.#src);
    const data = await response.arrayBuffer();
    this.#buffer = await this.#context.decodeAudioData(data);
    return this.#buffer;
  }

  warm() {
    return this.#loadPromise || Promise.resolve();
  }

  play(volume = 1) {
    if (this.#fallbackPool) {
      const sound = this.#fallbackPool[this.#fallbackCursor];
      this.#fallbackCursor =
        (this.#fallbackCursor + 1) % this.#fallbackPool.length;
      sound.pause();
      sound.currentTime = 0;
      sound.volume = volume;
      sound.play().catch(() => {});
      return;
    }

    if (!this.#buffer) {
      this.#loadPromise?.then(() => this.play(volume)).catch(() => {});
      return;
    }

    if (this.#context.state === "suspended") {
      this.#context.resume().catch(() => {});
    }

    const source = this.#context.createBufferSource();
    const gain = this.#context.createGain();
    gain.gain.value = volume;
    source.buffer = this.#buffer;
    source.connect(gain);
    gain.connect(this.#context.destination);
    source.start(0);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
  }

  dispose() {
    if (this.#fallbackPool) {
      for (let i = 0; i < this.#fallbackPool.length; i++) {
        const sound = this.#fallbackPool[i];
        sound.pause();
        sound.removeAttribute("src");
        sound.load();
      }
      this.#fallbackPool.length = 0;
    }

    if (this.#context && this.#context.state !== "closed") {
      this.#context.close().catch(() => {});
    }
  }
}
