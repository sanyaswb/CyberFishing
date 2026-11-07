// DEV step-by-step loading (spec 167, TK-251): holds GameAssetPreloadFacade before each step of the plan until the owner
// releases it in DevTools. The first frame's steps (auto) are released at once, so the game starts and draws its first
// frame; then every step waits for "Далі", a jump to a layer, "the whole layer" or "everything". Steps are only ever
// released forward: a restart (reloading the page) begins again. A full file that a view asks for (request(): the DOM
// pictures show their low copy, then ask for the full file) waits until the first step that loads it in full is released
// (TK-251.1, whenReleased); files no step loads and the loads outside the plan are not held. Production composes no gate.
const PASS_LABELS = Object.freeze({ load: "", low: "low-копії · ", full: "повні файли · " });

// A step's name for DevTools and the overlay: layer, pass, priority and groups.
const stepLabel = (step) => step.pass === "upgrade" ? `${step.layerLabel} · повні файли замість low-копій`
  : `${step.layerLabel} · ${PASS_LABELS[step.pass]}пріоритет ${step.priority}: ${step.groupLabels.join(", ")}`;

export class AssetLoadGate {
  #steps;
  #indexById;
  #released = 0;
  #waiters = new Map();
  #releaseWaiters = [];
  #times = new Map();
  #listeners = new Set();
  #now;
  // TK-251.2: the steps of the last release ("Далі", a layer, everything) and when it happened; the first frame's steps
  // count from the page start (0), so the overlay shows everything up to the first frame as that step.
  #current = { fromIndex: 0, toIndex: 0, sinceMs: 0 };

  // steps: AssetLoadStepPlan.steps; now(): milliseconds (performance.now).
  constructor({ steps, now }) {
    if (!Array.isArray(steps)) throw new TypeError("AssetLoadGate requires steps");
    if (typeof now !== "function") throw new TypeError("AssetLoadGate requires now");
    this.#steps = steps;
    this.#now = now;
    this.#indexById = new Map(steps.map((step, index) => [step.id, index]));
    for (const step of steps) this.#times.set(step.id, { releasedMs: null, requestedMs: null, doneMs: null });
    const auto = steps.findIndex((step) => !step.auto);
    this.#releaseTo(auto < 0 ? steps.length : auto);
    this.#current = { ...this.#current, sinceMs: 0 };
  }

  // The facade asks before a step; settles once the step is released. A step the plan does not know is never held.
  allow(stepId) {
    const index = this.#indexById.get(stepId);
    if (index === undefined) return Promise.resolve();
    this.#times.get(stepId).requestedMs = this.#now();
    this.#notify();
    if (index < this.#released) return Promise.resolve();
    return new Promise((resolve) => { this.#waiters.set(stepId, resolve); });
  }

  // Settles once the earliest of these steps is released (a full file a view asked for, TK-251.1); steps the plan does not
  // know do not hold, and with none known nothing waits. Unlike allow() it marks no step as asked for.
  whenReleased(stepIds) {
    const indexes = stepIds.map((stepId) => this.#indexById.get(stepId)).filter((index) => index !== undefined);
    if (indexes.length === 0) return Promise.resolve();
    const index = Math.min(...indexes);
    if (index < this.#released) return Promise.resolve();
    return new Promise((resolve) => { this.#releaseWaiters.push({ index, resolve }); });
  }

  // The facade reports that a step's loads have settled.
  done(stepId) {
    const times = this.#times.get(stepId);
    if (!times) return;
    times.doneMs = this.#now();
    this.#notify();
  }

  next() {
    this.#releaseTo(this.#released + 1);
  }

  // Everything before the layer's first step loads; its first step is the next one.
  jumpToLayer(layerId) {
    const first = this.#steps.findIndex((step) => step.layerId === layerId);
    if (first >= 0) this.#releaseTo(first);
  }

  // The rest of the layer the next step belongs to.
  releaseLayer() {
    const layerId = this.#steps[this.#released]?.layerId;
    if (!layerId) return;
    let end = this.#released;
    while (end < this.#steps.length && this.#steps[end].layerId === layerId) end += 1;
    this.#releaseTo(end);
  }

  releaseAll() {
    this.#releaseTo(this.#steps.length);
  }

  // listener(): called on every change (a release, a step asked for or settled); returns the unsubscribe function.
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  // Every step with its state: waiting (not released), released (the facade has not reached it yet), loading, done;
  // ms: from the later of release and request to done.
  getSnapshot() {
    const steps = this.#steps.map((step, index) => {
      const { releasedMs, requestedMs, doneMs } = this.#times.get(step.id);
      const state = index >= this.#released ? "waiting" : doneMs !== null ? "done" : requestedMs !== null ? "loading" : "released";
      const startMs = Math.max(releasedMs ?? 0, requestedMs ?? 0);
      return { ...step, label: stepLabel(step), state, ms: doneMs !== null ? Math.max(0, doneMs - startMs) : null };
    });
    // current: the last release's steps [fromIndex, toIndex) and its time (performance.now(), the resource timing clock).
    return { steps, nextIndex: this.#released, total: this.#steps.length, current: { ...this.#current } };
  }

  #releaseTo(count) {
    const end = Math.min(count, this.#steps.length);
    if (end <= this.#released) return;
    const nowMs = this.#now();
    this.#current = { fromIndex: this.#released, toIndex: end, sinceMs: nowMs };
    for (let index = this.#released; index < end; index += 1) {
      const id = this.#steps[index].id;
      this.#times.get(id).releasedMs = nowMs;
      this.#waiters.get(id)?.();
      this.#waiters.delete(id);
    }
    this.#released = end;
    const ready = this.#releaseWaiters.filter((waiter) => waiter.index < end);
    this.#releaseWaiters = this.#releaseWaiters.filter((waiter) => waiter.index >= end);
    for (const waiter of ready) waiter.resolve();
    this.#notify();
  }

  #notify() {
    for (const listener of this.#listeners) listener();
  }
}
