const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const checks = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}

const errors = [];
const performanceSource = {
  memory: {
    usedJSHeapSize: 10 * 1024 * 1024,
    jsHeapSizeLimit: 1024 * 1024 * 1024,
  },
};
let domNodes = 100;
let managedListeners = 10;
const timer = {
  nextId: 1,
  callbacks: new Map(),
  setInterval(callback) {
    const id = this.nextId++;
    this.callbacks.set(id, callback);
    return id;
  },
  clearInterval(id) {
    this.callbacks.delete(id);
  },
};
const documentTarget = {
  getElementsByTagName: () => ({ length: domNodes }),
};

const context = vm.createContext({
  console: {
    log: console.log,
    warn: console.warn,
    error: (...args) => errors.push(args),
  },
  Date,
  Object,
  Number,
  Math,
  globalThis: timer,
});
vm.runInContext(
  fs.readFileSync(
    path.join(ROOT, "src/debug/services/memory_leak_watchdog.js"),
    "utf8",
  ),
  context,
  { filename: "src/debug/services/memory_leak_watchdog.js" },
);

context.performanceSource = performanceSource;
context.documentTarget = documentTarget;
context.timer = timer;
context.metricsProvider = () => ({
  managedListeners,
  activeGameLoops: 1,
  duplicateLoopStarts: 0,
});

vm.runInContext(`
watchdog = new MemoryLeakWatchdog({
  performanceSource,
  documentTarget,
  eventTarget: null,
  timer,
  consoleTarget: console,
  metricsProvider,
  maxSamples: 6,
  minTrendSamples: 6,
  thresholds: {
    heapGrowthBytes: 5 * 1024 * 1024,
    domNodeGrowth: 20,
    listenerGrowth: 5,
  },
});
`, context);

for (let i = 0; i < 6; i++) {
  performanceSource.memory.usedJSHeapSize += 2 * 1024 * 1024;
  domNodes += 5;
  managedListeners += 2;
  vm.runInContext("watchdog.sample()", context);
}

const report = vm.runInContext("watchdog.getReport()", context);
assert(report.sampleCount === 6, "watchdog keeps bounded sample history");
assert(
  report.issues.some((issue) => issue.code === "heap_growth"),
  "watchdog detects persistent heap growth",
);
assert(
  report.issues.some((issue) => issue.code === "dom_node_growth"),
  "watchdog detects persistent DOM growth",
);
assert(
  report.issues.some((issue) => issue.code === "listener_growth"),
  "watchdog detects persistent managed-listener growth",
);
assert(errors.length === 3, "watchdog reports each growth issue once");

vm.runInContext("watchdog.start()", context);
assert(timer.callbacks.size === 1, "watchdog starts one sampling interval");
vm.runInContext("watchdog.start()", context);
assert(timer.callbacks.size === 1, "watchdog refuses duplicate intervals");
vm.runInContext("watchdog.dispose()", context);
assert(timer.callbacks.size === 0, "watchdog clears its interval on dispose");

let nextRafId = 1;
const cancelled = [];
const loopErrors = [];
const loopContext = vm.createContext({
  console: {
    error: (...args) => loopErrors.push(args),
  },
  Object,
  Error,
  requestAnimationFrame: () => nextRafId++,
  cancelAnimationFrame: (id) => cancelled.push(id),
});
vm.runInContext(
  fs.readFileSync(
    path.join(ROOT, "src/app/core/game_loop.js"),
    "utf8",
  ),
  loopContext,
  { filename: "src/app/core/game_loop.js" },
);
vm.runInContext(`
clock = { reset() {}, tick() { return 16; } };
loopA = new GameLoop(clock, () => {}, () => {});
loopB = new GameLoop(clock, () => {}, () => {});
firstStarted = loopA.start();
secondStarted = loopB.start();
diagnosticsAfterDuplicate = GameLoop.getDiagnostics();
loopA.stop();
secondStartedAfterStop = loopB.start();
loopB.stop();
`, loopContext);

assert(loopContext.firstStarted === true, "first game loop starts");
assert(loopContext.secondStarted === false, "second active game loop is blocked");
assert(
  loopContext.diagnosticsAfterDuplicate.duplicateStartAttempts === 1,
  "duplicate game-loop attempt is recorded",
);
assert(
  loopContext.secondStartedAfterStop === true,
  "new game loop starts after previous loop stops",
);
assert(loopErrors.length === 1, "duplicate game loop emits one error");
assert(cancelled.length === 2, "stopped game loops cancel their animation frames");

console.log("memory-leak-watchdog-check passed:");
for (const message of checks) console.log("- " + message);
