const PRIORITIES = Object.freeze({ blocking: 0, interactive: 1, upgrade: 2, prefetch: 3 });
const SPECULATIVE_RANK = PRIORITIES.upgrade;

// Load dispatch under fixed caps (spec 083, rules in spec 047 "Priority and Dispatch"). One job per resource key is
// shared by every consumer interest; a more urgent interest promotes a queued job without duplicating it; releasing
// the last interest cancels a queued job and marks a running one (its slot stays busy until the load settles).
// Results resolve, never reject: { status: "ready" | "failed" | "cancelled", payload, error, attempts }.
export class AssetLoadQueue {
  #networkSlots;
  #speculativeSlots;
  #maxAttempts;
  #retryDelayMs;
  #scheduler;
  #jobs = new Map();
  #queued = [];
  #active = 0;
  #activeSpeculative = 0;
  #sequence = 0;
  #speculativeAllowed = true;
  #disposed = false;

  constructor({ scheduler, networkSlots = 4, speculativeSlots = 1, maxAttempts = 2, retryDelayMs = 500 }) {
    if (typeof scheduler?.setTimeout !== "function" || typeof scheduler.clearTimeout !== "function")
      throw new TypeError("AssetLoadQueue requires a scheduler");
    this.#scheduler = scheduler;
    this.#networkSlots = Math.max(1, Math.floor(networkSlots));
    this.#speculativeSlots = Math.max(0, Math.min(this.#networkSlots, Math.floor(speculativeSlots)));
    this.#maxAttempts = Math.max(1, Math.floor(maxAttempts));
    this.#retryDelayMs = Math.max(0, retryDelayMs);
  }

  static get priorities() { return PRIORITIES; }

  // load(token) performs one attempt; token.cancelled turns true when no consumer wants the result any more.
  request({ key, priority, load }) {
    const rank = PRIORITIES[priority];
    if (rank === undefined) throw new Error(`AssetLoadQueue: unknown priority "${priority}"`);
    if (this.#disposed) return this.#settledInterest({ status: "cancelled", payload: null, error: null, attempts: 0 });
    let job = this.#jobs.get(key);
    if (!job) {
      job = { key, load, rank, sequence: this.#sequence++, state: "queued", interests: new Set(), token: { cancelled: false },
        attempts: 0, speculative: false, retryTimer: null };
      this.#jobs.set(key, job);
      this.#queued.push(job);
    } else if (job.token.cancelled) {
      // Only a running job outlives its last interest; a new consumer takes it over instead of a second load.
      job.token.cancelled = false;
    }
    let resolve;
    const interest = { rank, result: new Promise((done) => { resolve = done; }), settle: null };
    interest.settle = (outcome) => { interest.settle = null; resolve(outcome); };
    job.interests.add(interest);
    job.rank = Math.min(job.rank, rank);
    this.#drain();
    return {
      result: interest.result,
      release: () => this.#release(job, interest),
      promote: (next) => this.#promote(job, interest, next),
    };
  }

  // Hidden tab, offline, save-data or Low mode stop new upgrade/prefetch dispatch; running jobs finish.
  setSpeculativeAllowed(allowed) {
    this.#speculativeAllowed = allowed === true;
    this.#drain();
  }

  getSnapshot() {
    const queuedByPriority = { blocking: 0, interactive: 0, upgrade: 0, prefetch: 0 };
    const names = Object.keys(PRIORITIES);
    for (const job of this.#queued) queuedByPriority[names[job.rank]] += 1;
    return { active: this.#active, activeSpeculative: this.#activeSpeculative, queued: this.#queued.length,
      waitingRetry: [...this.#jobs.values()].filter((job) => job.state === "retry").length, queuedByPriority };
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const job of [...this.#jobs.values()]) {
      job.token.cancelled = true;
      if (job.retryTimer !== null) this.#scheduler.clearTimeout(job.retryTimer);
      this.#finish(job, { status: "cancelled", payload: null, error: null, attempts: job.attempts });
    }
    this.#queued.length = 0;
  }

  #release(job, interest) {
    if (!job.interests.delete(interest)) return;
    interest.settle?.({ status: "cancelled", payload: null, error: null, attempts: job.attempts });
    if (job.interests.size > 0) {
      job.rank = Math.min(...[...job.interests].map((entry) => entry.rank));
      return;
    }
    job.token.cancelled = true;
    if (job.state === "queued") this.#queued.splice(this.#queued.indexOf(job), 1);
    if (job.retryTimer !== null) this.#scheduler.clearTimeout(job.retryTimer);
    // A running attempt keeps its slot until it settles; queued and waiting jobs leave now.
    if (job.state !== "active") this.#jobs.delete(job.key);
  }

  #promote(job, interest, priority) {
    const rank = PRIORITIES[priority];
    if (rank === undefined || !job.interests.has(interest) || rank >= interest.rank) return;
    interest.rank = rank;
    job.rank = Math.min(job.rank, rank);
    this.#drain();
  }

  #drain() {
    while (!this.#disposed && this.#active < this.#networkSlots) {
      const job = this.#next();
      if (!job) return;
      this.#queued.splice(this.#queued.indexOf(job), 1);
      this.#start(job);
    }
  }

  // Most urgent first, FIFO within a priority; speculative jobs only within their own cap and while allowed.
  #next() {
    const speculativeOpen = this.#speculativeAllowed && this.#activeSpeculative < this.#speculativeSlots;
    let best = null;
    for (const job of this.#queued) {
      if (job.rank >= SPECULATIVE_RANK && !speculativeOpen) continue;
      if (!best || job.rank < best.rank || (job.rank === best.rank && job.sequence < best.sequence)) best = job;
    }
    return best;
  }

  #start(job) {
    job.state = "active";
    job.attempts += 1;
    job.speculative = job.rank >= SPECULATIVE_RANK;
    this.#active += 1;
    if (job.speculative) this.#activeSpeculative += 1;
    let attempt;
    try { attempt = Promise.resolve(job.load(job.token)); } catch (error) { attempt = Promise.reject(error); }
    attempt.then(
      (payload) => this.#complete(job, { status: "ready", payload, error: null, attempts: job.attempts }),
      (error) => this.#complete(job, null, error));
  }

  #complete(job, outcome, error = null) {
    this.#active -= 1;
    if (job.speculative) this.#activeSpeculative -= 1;
    if (this.#disposed) return;
    if (job.token.cancelled) {
      this.#jobs.delete(job.key);
    } else if (outcome) {
      this.#finish(job, outcome);
    } else if (job.attempts < this.#maxAttempts) {
      job.state = "retry";
      job.retryTimer = this.#scheduler.setTimeout(() => {
        job.retryTimer = null;
        job.state = "queued";
        this.#queued.push(job);
        this.#drain();
      }, this.#retryDelayMs);
    } else {
      this.#finish(job, { status: "failed", payload: null, error, attempts: job.attempts });
    }
    this.#drain();
  }

  #finish(job, outcome) {
    job.state = "settled";
    this.#jobs.delete(job.key);
    for (const interest of job.interests) interest.settle?.(outcome);
    job.interests.clear();
  }

  #settledInterest(outcome) {
    return { result: Promise.resolve(outcome), release() {}, promote() {} };
  }
}
