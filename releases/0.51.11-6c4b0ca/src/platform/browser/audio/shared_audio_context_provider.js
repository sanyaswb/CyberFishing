// One AudioContext for the game's streamed sound (spec 142). It is created only by get(), which callers invoke inside a
// user gesture (the radio's power button): browsers keep a context made earlier suspended (autoplay policy).
export class SharedAudioContextProvider {
  #windowRef;
  #context = null;

  constructor({ windowRef }) {
    this.#windowRef = windowRef;
  }

  get() {
    if (!this.#context) {
      const AudioContextClass = this.#windowRef.AudioContext || this.#windowRef.webkitAudioContext;
      this.#context = AudioContextClass ? new AudioContextClass() : null;
    }
    if (this.#context?.state === "suspended") this.#context.resume?.().catch?.(() => {});
    return this.#context;
  }

  // The context if it already exists, without creating one.
  peek() {
    return this.#context;
  }

  dispose() {
    this.#context?.close?.().catch?.(() => {});
    this.#context = null;
  }
}
