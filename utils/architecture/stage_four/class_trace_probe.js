"use strict";

// Preloaded (`node --require`) into a scenario check by StageFourTierAEvidence, never by the game. After every
// vm.runInContext call it wraps each public prototype method and getter ("get name") of the traced classes found in
// that context (classic declaration, global, or cumulative-runtime export), counting calls, recording deltaTime ranges
// and fingerprinting each call's arguments and result in call order (wall-clock ISO timestamps masked). Traces of all
// contexts are merged per class and written as one JSON line to the file named by the environment when the process
// exits.
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");

const OUTPUT = process.env.CYBER_CLASS_TRACE_OUTPUT;
const CLASSES = JSON.parse(process.env.CYBER_CLASS_TRACE_CLASSES || "[]");

// Evaluated in the scenario's context as an expression; it never defines a global there.
const INSTALL = `((host) => {
  const encode = (value, seen = new Set(), depth = 0) => {
    if (value === null || value === undefined) return value === null ? null : { $undefined: true };
    if (typeof value === "number") return Number.isFinite(value) ? value : { $number: String(value) };
    // Wall-clock ISO timestamps (e.g. EquipmentLoadout.createdAt) differ per run; their presence is kept.
    if (typeof value === "string" && /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$/u.test(value)) return { $timestamp: true };
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
  const resolve = (name) => {
    try { if (typeof globalThis[name] === "function") return globalThis[name]; } catch {}
    try { const value = eval(name); if (typeof value === "function") return value; } catch {}
    return Object.values(globalThis.__CYBER_FISHING_COMPAT_RUNTIME__?.modules || {})
      .map(exports => exports[name]).find(value => typeof value === "function");
  };
  for (const name of host.pending()) {
    const Class = resolve(name);
    if (typeof Class !== "function" || host.wrapped.has(Class.prototype)) continue;
    host.wrapped.add(Class.prototype);
    const record = host.record(name);
    for (const method of Object.getOwnPropertyNames(Class.prototype)) {
      if (method === "constructor") continue;
      const descriptor = Object.getOwnPropertyDescriptor(Class.prototype, method);
      const accessor = typeof descriptor.get === "function";
      if (typeof descriptor.value !== "function" && !accessor) continue;
      const original = accessor ? descriptor.get : descriptor.value;
      const traced = accessor ? "get " + method : method;
      const stats = record.methods[traced] ||= { calls: 0, dtMin: null, dtMax: null };
      Object.defineProperty(Class.prototype, method, { ...descriptor, [accessor ? "get" : "value"]: function (...args) {
        const input = JSON.stringify(encode(args));
        let output;
        try {
          output = original.apply(this, args);
        } catch (error) {
          // A thrown error is part of the API: record it, then rethrow unchanged.
          stats.calls += 1;
          host.update(name, traced + "\\u0000" + input + "\\u0000" + JSON.stringify({ $throws: String(error?.message) }) + "\\n");
          throw error;
        }
        stats.calls += 1;
        for (const key of ["dtSec", "dtMs", "deltaTime", "dt"]) {
          const dt = args[0] && typeof args[0] === "object" ? args[0][key] : undefined;
          if (typeof dt === "number" && Number.isFinite(dt)) {
            const seconds = key === "dtMs" ? dt / 1000 : dt;
            stats.dtMin = stats.dtMin === null ? seconds : Math.min(stats.dtMin, seconds);
            stats.dtMax = stats.dtMax === null ? seconds : Math.max(stats.dtMax, seconds);
          }
        }
        host.update(name, traced + "\\u0000" + input + "\\u0000" + JSON.stringify(encode(output)) + "\\n");
        return output;
      } });
    }
  }
})`;

const records = new Map();
const wrapped = new WeakSet();
const host = {
  wrapped,
  record(name) {
    if (!records.has(name)) records.set(name, { methods: {}, digest: crypto.createHash("sha256") });
    return records.get(name);
  },
  update(name, line) { records.get(name).digest.update(line); },
  pending: () => CLASSES,
};
const installers = new WeakMap();
const originalRun = vm.runInContext;
let installing = false;
vm.runInContext = function traced(code, context, options) {
  const result = originalRun.call(this, code, context, options);
  if (!installing) {
    installing = true;
    try {
      if (!installers.has(context)) installers.set(context, originalRun.call(vm, INSTALL, context));
      installers.get(context)(host);
    } finally {
      installing = false;
    }
  }
  return result;
};

process.on("exit", () => {
  const traces = Object.fromEntries([...records].map(([name, record]) =>
    [name, { methods: record.methods, sha256: record.digest.digest("hex") }]));
  fs.writeFileSync(OUTPUT, `${JSON.stringify(traces)}\n`);
});
