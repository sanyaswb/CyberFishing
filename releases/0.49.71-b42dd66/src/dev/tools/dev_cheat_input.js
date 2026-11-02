// DEV keyboard transport only; command definitions and matching belong to the server.
export class DevCheatInput {
  #target; #scheduler; #fetch; #createAbort; #open;
  #buffer = ''; #timer = null; #requestTimer = null; #controller = null; #generation = 0; #disposed = false;
  #key = event => {
    if (event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey ||
      event.target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) { this.#reset(); return; }
    if (!/^[a-z]$/i.test(event.key)) { this.#reset(); return; }
    this.#cancel(); this.#generation++;
    this.#buffer = (this.#buffer + event.key.toLowerCase()).slice(-32);
    const generation = this.#generation;
    this.#timer = this.#scheduler.setTimeout(() => { this.#timer = null; void this.#check(generation); }, 250);
  };
  #blur = () => this.#reset();

  constructor({ target, scheduler, fetchCommand, createAbortController, open }) {
    this.#target = target; this.#scheduler = scheduler; this.#fetch = fetchCommand; this.#createAbort = createAbortController; this.#open = open;
    target.addEventListener('keydown', this.#key); target.addEventListener('blur', this.#blur);
  }

  async #check(generation) {
    const controller = this.#createAbort(); this.#controller = controller;
    this.#requestTimer = this.#scheduler.setTimeout(() => this.#reset(), 3000);
    try {
      const response = await this.#fetch('/__dev/command', { method: 'POST', credentials: 'omit',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate: this.#buffer }), signal: controller.signal });
      const data = response.ok ? await response.json() : null;
      if (!this.#disposed && generation === this.#generation && data?.action === 'openDevTools') { this.#reset(); this.#open(); }
    } catch { /* Static hosts and offline/aborted requests never unlock a local fallback. */ }
    finally {
      if (this.#controller === controller) {
        this.#scheduler.clearTimeout(this.#requestTimer); this.#requestTimer = null; this.#controller = null;
        // Keep the bounded candidate briefly for slow typing, then discard it.
        this.#timer = this.#scheduler.setTimeout(() => this.#reset(), 3000);
      }
    }
  }

  #cancel() {
    this.#scheduler.clearTimeout(this.#timer); this.#timer = null;
    this.#scheduler.clearTimeout(this.#requestTimer); this.#requestTimer = null;
    this.#controller?.abort(); this.#controller = null;
  }
  #reset() { this.#cancel(); this.#buffer = ''; this.#generation++; }
  dispose() {
    this.#disposed = true; this.#reset();
    this.#target.removeEventListener('keydown', this.#key); this.#target.removeEventListener('blur', this.#blur);
  }
}
