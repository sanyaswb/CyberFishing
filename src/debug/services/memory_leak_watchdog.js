/**
 * Samples runtime resource metrics and reports persistent growth patterns.
 *
 * This is a diagnostic guard, not a replacement for Chrome heap snapshots.
 * History is bounded so the watchdog cannot become a leak itself.
 */
class MemoryLeakWatchdog {
  #performanceSource;
  #documentTarget;
  #eventTarget;
  #timer;
  #console;
  #metricsProvider;
  #onCritical;
  #intervalMs;
  #maxSamples;
  #minTrendSamples;
  #thresholds;
  #samples = [];
  #intervalId = null;
  #reportedSignatures = new Set();

  constructor({
    performanceSource =
      typeof performance !== "undefined" ? performance : null,
    documentTarget =
      typeof document !== "undefined" ? document : null,
    eventTarget =
      typeof window !== "undefined" ? window : null,
    timer =
      typeof window !== "undefined" ? window : globalThis,
    consoleTarget = console,
    metricsProvider = null,
    onCritical = null,
    intervalMs = 5000,
    maxSamples = 12,
    minTrendSamples = 6,
    thresholds = {},
  } = {}) {
    this.#performanceSource = performanceSource;
    this.#documentTarget = documentTarget;
    this.#eventTarget = eventTarget;
    this.#timer = timer;
    this.#console = consoleTarget;
    this.#metricsProvider = metricsProvider;
    this.#onCritical = onCritical;
    this.#intervalMs = Math.max(1000, Number(intervalMs) || 5000);
    this.#maxSamples = Math.max(6, Math.floor(Number(maxSamples) || 12));
    this.#minTrendSamples = Math.max(
      4,
      Math.min(
        this.#maxSamples,
        Math.floor(Number(minTrendSamples) || 6),
      ),
    );
    this.#thresholds = Object.freeze({
      heapGrowthBytes: Math.max(
        1024 * 1024,
        Number(thresholds.heapGrowthBytes) || 16 * 1024 * 1024,
      ),
      domNodeGrowth: Math.max(
        5,
        Number(thresholds.domNodeGrowth) || 50,
      ),
      listenerGrowth: Math.max(
        2,
        Number(thresholds.listenerGrowth) || 10,
      ),
    });
  }

  start() {
    if (this.#intervalId !== null) return false;
    this.sample();
    this.#intervalId = this.#timer.setInterval(
      () => this.sample(),
      this.#intervalMs,
    );
    return true;
  }

  stop() {
    if (this.#intervalId === null) return false;
    this.#timer.clearInterval(this.#intervalId);
    this.#intervalId = null;
    return true;
  }

  dispose() {
    this.stop();
    this.#samples.length = 0;
    this.#reportedSignatures.clear();
  }

  sample() {
    const provided =
      typeof this.#metricsProvider === "function"
        ? this.#metricsProvider() || {}
        : {};
    const memory = this.#performanceSource?.memory;
    const sample = Object.freeze({
      timestampMs: Date.now(),
      heapBytes: this.#finiteOrNull(memory?.usedJSHeapSize),
      heapLimitBytes: this.#finiteOrNull(memory?.jsHeapSizeLimit),
      domNodes: this.#countDomNodes(),
      managedListeners: this.#nonNegativeOrNull(
        provided.managedListeners,
      ),
      activeGameLoops: this.#nonNegativeOrNull(
        provided.activeGameLoops,
      ),
      duplicateLoopStarts: this.#nonNegativeOrNull(
        provided.duplicateLoopStarts,
      ),
    });

    this.#samples.push(sample);
    if (this.#samples.length > this.#maxSamples) {
      this.#samples.splice(0, this.#samples.length - this.#maxSamples);
    }

    const issues = this.#detectIssues();
    for (const issue of issues) this.#reportIssue(issue);
    return Object.freeze({ sample, issues: Object.freeze(issues) });
  }

  getReport() {
    const latest = this.#samples[this.#samples.length - 1] || null;
    return Object.freeze({
      running: this.#intervalId !== null,
      latest,
      sampleCount: this.#samples.length,
      maxSamples: this.#maxSamples,
      issues: Object.freeze(this.#detectIssues()),
    });
  }

  #detectIssues() {
    const issues = [];
    const latest = this.#samples[this.#samples.length - 1];
    if (!latest) return issues;

    if (Number(latest.activeGameLoops) > 1) {
      issues.push(this.#issue(
        "duplicate_game_loop",
        "critical",
        `Detected ${latest.activeGameLoops} active game loops.`,
      ));
    }

    if (Number(latest.duplicateLoopStarts) > 0) {
      issues.push(this.#issue(
        "duplicate_game_loop_start",
        "critical",
        `Blocked ${latest.duplicateLoopStarts} duplicate game-loop start attempt(s).`,
      ));
    }

    if (
      this.#hasPersistentGrowth(
        "heapBytes",
        this.#thresholds.heapGrowthBytes,
      )
    ) {
      issues.push(this.#issue(
        "heap_growth",
        "warning",
        "JS heap shows persistent growth across the bounded sample window.",
      ));
    }

    if (
      this.#hasPersistentGrowth(
        "domNodes",
        this.#thresholds.domNodeGrowth,
      )
    ) {
      issues.push(this.#issue(
        "dom_node_growth",
        "warning",
        "DOM node count shows persistent growth.",
      ));
    }

    if (
      this.#hasPersistentGrowth(
        "managedListeners",
        this.#thresholds.listenerGrowth,
      )
    ) {
      issues.push(this.#issue(
        "listener_growth",
        "warning",
        "Managed event-listener count shows persistent growth.",
      ));
    }

    return issues;
  }

  #hasPersistentGrowth(key, minimumGrowth) {
    if (this.#samples.length < this.#minTrendSamples) return false;
    const recent = this.#samples.slice(-this.#minTrendSamples);
    const values = recent.map((entry) => Number(entry[key]));
    if (values.some((value) => !Number.isFinite(value))) return false;

    const totalGrowth = values[values.length - 1] - values[0];
    if (totalGrowth < minimumGrowth) return false;

    let nonDecreasingSteps = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] >= values[i - 1]) nonDecreasingSteps += 1;
    }
    return nonDecreasingSteps >= values.length - 2;
  }

  #issue(code, severity, message) {
    return Object.freeze({ code, severity, message });
  }

  #reportIssue(issue) {
    const signature = issue.code;
    if (this.#reportedSignatures.has(signature)) return;
    this.#reportedSignatures.add(signature);

    const report = this.getReport();
    const error = new Error(
      `[MemoryLeakWatchdog] ${issue.message}`,
    );
    this.#console?.error?.(error, report);

    if (issue.severity === "critical") {
      this.#onCritical?.(issue, report);
    }

    if (
      this.#eventTarget?.dispatchEvent &&
      typeof CustomEvent !== "undefined"
    ) {
      this.#eventTarget.dispatchEvent(
        new CustomEvent("cyber-fishing-memory-warning", {
          detail: { issue, report },
        }),
      );
    }
  }

  #countDomNodes() {
    const root = this.#documentTarget;
    if (!root?.getElementsByTagName) return null;
    return root.getElementsByTagName("*").length;
  }

  #finiteOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  #nonNegativeOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : null;
  }
}

if (typeof window !== "undefined") {
  window.MemoryLeakWatchdog = MemoryLeakWatchdog;
}
