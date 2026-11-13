// Spec 173 F1 (TK-275): switching zone editing on takes the page fullscreen; switching it off leaves fullscreen only
// when the editor entered it (a fullscreen the player chose with ⛶ stays). Called from the editor's switch handlers,
// inside the click that changed them, so the browser grants the request.
export class ZoneEditorFullscreen {
  #fullscreen;
  #onError;
  #entered = false;

  // fullscreen: BrowserFullscreen-like { supported, active, request(), exit() }; onError(error): a refused request.
  constructor({ fullscreen, onError = null }) {
    if (typeof fullscreen?.request !== "function" || typeof fullscreen?.exit !== "function") {
      throw new TypeError("ZoneEditorFullscreen requires fullscreen");
    }
    this.#fullscreen = fullscreen;
    this.#onError = onError;
  }

  // Whether the editor holds the fullscreen it entered.
  get entered() {
    return this.#entered;
  }

  enter() {
    const fullscreen = this.#fullscreen;
    if (!fullscreen.supported || fullscreen.active) return;
    this.#entered = true;
    fullscreen.request().catch((error) => {
      this.#entered = false;
      this.#onError?.(error);
    });
  }

  leave() {
    if (!this.#entered) return;
    this.#entered = false;
    if (this.#fullscreen.active) this.#fullscreen.exit().catch((error) => this.#onError?.(error));
  }
}
