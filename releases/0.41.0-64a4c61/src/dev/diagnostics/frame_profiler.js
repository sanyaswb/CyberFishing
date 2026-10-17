// DEV frame timing (spec 101), the active implementation of the engine frame probe. It keeps the last 240 frames:
// the animation-frame interval (what the player feels), the main-thread work of the game loop (update + draw), each
// reported section (render passes, the Spine rod) and gauges (GL surface pixels). Long tasks of the whole page come
// from PerformanceObserver where the browser has it (Chromium). Intervals over a second (hidden tab) are not counted.
// GPU time is not observable from a page: a frame whose interval is far above its CPU work points at GPU, compositor
// or other page work, and that gap is reported as such.
const CAPACITY = 240;
const HIDDEN_GAP_MS = 1000;
const JANK_MS = 25;
const FREEZE_MS = 50;

export class FrameProfiler {
  #now;
  #intervals = new Float64Array(CAPACITY);
  #work = new Float64Array(CAPACITY);
  #sections = new Map();
  #gauges = new Map();
  #index = 0;
  #count = 0;
  #lastTimestamp = null;
  #frameStart = 0;
  #frameOpen = false;
  #longTasks = { count: 0, totalMs: 0, maxMs: 0 };
  #observer = null;

  constructor({ now = () => performance.now(), observeLongTasks = true } = {}) {
    this.#now = now;
    if (observeLongTasks && typeof PerformanceObserver === "function" &&
      PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
      this.#observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) this.recordLongTask(entry.duration);
      });
      this.#observer.observe({ type: "longtask", buffered: false });
    }
  }

  beginFrame(timestampMs) {
    const timestamp = Number(timestampMs);
    const interval = this.#lastTimestamp === null ? 0 : timestamp - this.#lastTimestamp;
    this.#lastTimestamp = timestamp;
    this.#intervals[this.#index] = interval > 0 && interval < HIDDEN_GAP_MS ? interval : 0;
    this.#frameStart = this.#now();
    this.#frameOpen = true;
  }

  begin(id) {
    this.#section(id).openedAt = this.#now();
  }

  end(id) {
    const section = this.#section(id);
    if (section.openedAt !== null) section.frameMs += this.#now() - section.openedAt;
    section.openedAt = null;
  }

  gauge(id, value) {
    this.#gauges.set(id, Number(value) || 0);
  }

  endFrame() {
    if (!this.#frameOpen) return;
    this.#frameOpen = false;
    this.#work[this.#index] = this.#now() - this.#frameStart;
    for (const section of this.#sections.values()) {
      section.samples[this.#index] = section.frameMs;
      section.frameMs = 0;
    }
    this.#index = (this.#index + 1) % CAPACITY;
    this.#count = Math.min(CAPACITY, this.#count + 1);
  }

  // Work outside the game loop that DEV itself adds (the overlay's HTML rebuild), measured as its own section.
  measure(id, callback) {
    this.begin(id);
    try {
      return callback();
    } finally {
      this.end(id);
    }
  }

  recordLongTask(durationMs) {
    const duration = Number(durationMs) || 0;
    this.#longTasks.count += 1;
    this.#longTasks.totalMs += duration;
    this.#longTasks.maxMs = Math.max(this.#longTasks.maxMs, duration);
  }

  // Statistics over the recorded frames; recent: the last frame intervals, oldest first, for the freeze bar.
  getSnapshot({ recentFrames = 120 } = {}) {
    const intervals = this.#ordered(this.#intervals).filter((value) => value > 0);
    const work = this.#ordered(this.#work);
    const intervalStats = FrameProfiler.#stats(intervals);
    const workStats = FrameProfiler.#stats(work);
    const sections = {};
    for (const [id, section] of this.#sections) sections[id] = FrameProfiler.#stats(this.#ordered(section.samples));
    return {
      frames: this.#count,
      fps: intervalStats.mean > 0 ? 1000 / intervalStats.mean : 0,
      interval: intervalStats,
      work: workStats,
      budgetShare: intervalStats.mean > 0 ? workStats.mean / intervalStats.mean : 0,
      unexplainedMs: Math.max(0, intervalStats.mean - workStats.mean),
      janks: intervals.filter((value) => value > JANK_MS && value <= FREEZE_MS).length,
      freezes: intervals.filter((value) => value > FREEZE_MS).length,
      sections,
      gauges: Object.fromEntries(this.#gauges),
      longTasks: { ...this.#longTasks, observed: this.#observer !== null },
      recent: intervals.slice(-recentFrames),
      thresholds: { jankMs: JANK_MS, freezeMs: FREEZE_MS },
    };
  }

  reset() {
    this.#intervals.fill(0);
    this.#work.fill(0);
    for (const section of this.#sections.values()) section.samples.fill(0);
    this.#index = 0;
    this.#count = 0;
    this.#lastTimestamp = null;
    this.#longTasks = { count: 0, totalMs: 0, maxMs: 0 };
  }

  dispose() {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  #section(id) {
    let section = this.#sections.get(id);
    if (!section) {
      section = { openedAt: null, frameMs: 0, samples: new Float64Array(CAPACITY) };
      this.#sections.set(id, section);
    }
    return section;
  }

  // The recorded part of a ring buffer, oldest first.
  #ordered(buffer) {
    if (this.#count < CAPACITY) return Array.from(buffer.subarray(0, this.#count));
    return [...buffer.subarray(this.#index), ...buffer.subarray(0, this.#index)];
  }

  static #stats(values) {
    if (values.length === 0) return { mean: 0, p50: 0, p95: 0, max: 0 };
    const sorted = [...values].sort((left, right) => left - right);
    const at = (share) => sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))];
    return { mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length, p50: at(0.5), p95: at(0.95),
      max: sorted[sorted.length - 1] };
  }
}
