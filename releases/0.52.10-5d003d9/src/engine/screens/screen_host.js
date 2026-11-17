// One active screen above the base screen (spec 084). Opening suspends the base and creates the screen through its
// lazy factory; closing disposes it and resumes the base. A factory result that arrives after close/dispose is
// disposed at once; a failed factory resumes the base and rethrows. Screens are { dispose() }.
export class ScreenHost {
  #factories;
  #base;
  #activeId = null;
  #screen = null;
  #generation = 0;
  #disposed = false;

  constructor({ factories, base }) {
    this.#factories = new Map(Object.entries(factories));
    this.#base = base;
  }

  get activeId() { return this.#activeId; }

  async open(id, options = {}) {
    const factory = this.#factories.get(id);
    if (!factory) throw new Error(`ScreenHost: unknown screen "${id}"`);
    if (this.#disposed || this.#activeId === id) return;
    // Switching screens keeps the base suspended.
    const baseRunning = this.#activeId === null;
    if (!baseRunning) this.#closeActive(false);
    const generation = ++this.#generation;
    this.#activeId = id;
    if (baseRunning) this.#base.suspend();
    let screen;
    try {
      screen = await factory({ ...options, close: () => { if (this.#generation === generation) this.close(); } });
    } catch (error) {
      if (this.#generation === generation) { this.#activeId = null; this.#base.resume(); }
      throw error;
    }
    if (this.#generation !== generation) { screen?.dispose(); return; }
    this.#screen = screen;
  }

  close() {
    if (this.#activeId === null) return;
    this.#closeActive(!this.#disposed);
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#activeId !== null) this.#closeActive(false);
  }

  #closeActive(resumeBase) {
    this.#generation += 1;
    const screen = this.#screen;
    this.#screen = null;
    this.#activeId = null;
    screen?.dispose();
    if (resumeBase) this.#base.resume();
  }
}
