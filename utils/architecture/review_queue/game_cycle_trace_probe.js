"use strict";

// Preloaded into `node utils/game-cycle-check.js` by StageThreeGameCycleTrace (never by the game).
// Before the game-cycle scenario script runs, it wraps every public prototype method of the traced
// classes in that vm context, counting calls and fingerprinting each call's arguments and result
// in call order. The trace is written as one JSON line to the file named by the environment.
const fs = require("node:fs");
const vm = require("node:vm");

const OUTPUT = process.env.CYBER_GAME_CYCLE_TRACE_OUTPUT;
const CLASSES = JSON.parse(process.env.CYBER_GAME_CYCLE_TRACE_CLASSES || "[]");
const SCENARIO = "utils/game-cycle-check.js#scenario";

const INSTRUMENT = `(() => {
  const crypto = __traceHost.crypto;
  const encode = (value, seen = new Set(), depth = 0) => {
    if (value === null || value === undefined) return value === null ? null : { $undefined: true };
    if (typeof value === "number") return Number.isFinite(value) ? value : { $number: String(value) };
    if (typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "function") return { $function: value.name || "anonymous" };
    if (typeof value !== "object") return { $type: typeof value };
    if (seen.has(value)) return { $cycle: true };
    if (depth > 6) return { $depth: value.constructor?.name || "Object" };
    seen.add(value);
    let result;
    if (Array.isArray(value)) result = value.map(item => encode(item, seen, depth + 1));
    else {
      result = {};
      const name = value.constructor?.name;
      if (name && name !== "Object") result.$class = name;
      if (Object.isFrozen(value)) result.$frozen = true;
      for (const key of Object.keys(value).sort()) result[key] = encode(value[key], seen, depth + 1);
    }
    seen.delete(value);
    return result;
  };
  const traces = {};
  for (const name of __traceHost.classes) {
    const Class = globalThis[name] || (() => { try { return eval(name); } catch { return undefined; } })();
    if (typeof Class !== "function") throw new Error("trace class is not loaded: " + name);
    const record = { methods: {}, digest: crypto.createHash("sha256") };
    traces[name] = record;
    for (const method of Object.getOwnPropertyNames(Class.prototype)) {
      if (method === "constructor") continue;
      const descriptor = Object.getOwnPropertyDescriptor(Class.prototype, method);
      if (typeof descriptor.value !== "function") continue;
      const original = descriptor.value;
      const stats = { calls: 0, dtMin: null, dtMax: null };
      record.methods[method] = stats;
      Object.defineProperty(Class.prototype, method, { ...descriptor, value: function (...args) {
        const input = JSON.stringify(encode(args));
        const output = original.apply(this, args);
        stats.calls += 1;
        for (const key of ["dtSec", "dtMs", "deltaTime", "dt"]) {
          const dt = args[0] && typeof args[0] === "object" ? args[0][key] : undefined;
          if (typeof dt === "number" && Number.isFinite(dt)) {
            const seconds = key === "dtMs" ? dt / 1000 : dt;
            stats.dtMin = stats.dtMin === null ? seconds : Math.min(stats.dtMin, seconds);
            stats.dtMax = stats.dtMax === null ? seconds : Math.max(stats.dtMax, seconds);
          }
        }
        record.digest.update(method + "\\u0000" + input + "\\u0000" + JSON.stringify(encode(output)) + "\\n");
        return output;
      } });
    }
  }
  __traceHost.finish = () => Object.fromEntries(Object.entries(traces).map(([name, record]) =>
    [name, { methods: record.methods, sha256: record.digest.digest("hex") }]));
})();`;

const originalRun = vm.runInContext;
vm.runInContext = function traced(code, context, options) {
  const filename = typeof options === "string" ? options : options?.filename;
  if (filename !== SCENARIO) return originalRun.call(this, code, context, options);
  const host = { crypto: require("node:crypto"), classes: CLASSES, finish: null };
  context.__traceHost = host;
  originalRun.call(this, INSTRUMENT, context, { filename: "game-cycle-trace#instrument" });
  const result = originalRun.call(this, code, context, options);
  fs.writeFileSync(OUTPUT, `${JSON.stringify(host.finish())}\n`);
  delete context.__traceHost;
  return result;
};
