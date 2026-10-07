"use strict";

const assert = require("node:assert/strict");
const { SourceRuntime } = require("./testing/core/source_runtime");

// Minimal browser doubles: event targets that count listeners, manual animation frames and a clock.
class FakeTarget {
  listeners = new Map();
  addEventListener(type, listener) { (this.listeners.get(type) || this.listeners.set(type, new Set()).get(type)).add(listener); }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatchEvent(event) { for (const listener of [...(this.listeners.get(event.type) || [])]) listener(event); return true; }
  count() { let total = 0; for (const set of this.listeners.values()) total += set.size; return total; }
}

function createHarness() {
  const document = new FakeTarget();
  const window = new FakeTarget();
  const frames = new Map();
  let nextFrame = 1;
  let now = 0;
  const logs = { info: [], warn: [], error: [] };
  const fakeConsole = { info: (...a) => logs.info.push(a), warn: (...a) => logs.warn.push(a), error: (...a) => logs.error.push(a), log() {} };
  Object.assign(window, {
    requestAnimationFrame: (callback) => { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame: (id) => frames.delete(id),
    performance: { now: () => now },
  });
  const runtime = new SourceRuntime({ globals: { document, window, console: fakeConsole,
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } } } });
  const { ReelRetrieveDiagnostic } = runtime.importModule("src/dev/modules/reel_retrieve_diagnostic.js");
  const debugModules = { reelHoldGate: false };
  const diagnostic = new ReelRetrieveDiagnostic({ debugModulesSource: () => debugModules, recoveryWindowMs: 100 });
  const states = [];
  document.addEventListener("reel-retrieve-diagnostic-state", (event) => states.push(event.detail));
  const command = (action) => document.dispatchEvent({ type: "reel-retrieve-diagnostic-command", detail: { action } });
  const live = (detail) => document.dispatchEvent({ type: "debug-live-update", detail });
  const key = (type) => window.dispatchEvent({ type, code: "Space", repeat: false, target: {} });
  const runFrames = (ms) => { now += ms; for (const [id, callback] of [...frames]) { frames.delete(id); callback(now); } };
  return { document, window, frames, logs, fakeConsole, debugModules, diagnostic, states, command, live, key, runFrames };
}

const fight = (released, stroke, recovered = 0) => ({ gameState: "waiting", hasReel: true, lineTotalMeters: 50,
  lineReleasedMeters: released, rodStrokeWonMeters: stroke, autoRecoveredMeters: recovered, holdRecoveredMeters: 0,
  autoRecoverBlockedReason: "none" });

function checkCompleteTrace() {
  const h = createHarness();
  const listenersAfterConstruction = h.document.count() + h.window.count();
  const originalWarn = h.fakeConsole.warn;
  h.key("keydown");
  assert.equal(h.frames.size, 0, "nothing is traced before the user arms the diagnostic");
  h.command("arm");
  assert.equal(h.states.at(-1).status, "armed");
  assert.equal(h.debugModules.reelHoldGate, true, "arming enables the reel hold console module for the run");
  assert.notEqual(h.fakeConsole.warn, originalWarn, "console warnings are counted while armed");
  h.live(fight(10, 1.5));
  h.key("keydown");
  h.runFrames(16);
  h.live(fight(8, 0.5, 2));
  h.key("keyup");
  assert.equal(h.states.at(-1).status, "observing-recovery");
  for (let i = 0; i < 10; i++) h.runFrames(16);
  const result = h.states.at(-1);
  assert.equal(result.status, "complete");
  assert.equal(result.verdict.status, "RECOVERY_CONFIRMED");
  assert.equal(result.verdict.scenario, "line recovery after releasing Space (reel)");
  assert.equal(h.frames.size, 0, "no animation frame remains after the trace completes");
  assert.equal(h.debugModules.reelHoldGate, false, "the console module is restored after the run");
  assert(h.logs.info.some((entry) => entry[0] === "REEL RETRIEVE DIAGNOSTIC"));
  h.diagnostic.dispose();
  assert.equal(h.document.count() + h.window.count(), listenersAfterConstruction - 4,
    "dispose removes the diagnostic's own document and window listeners");
}

function checkCancelAndDispose() {
  const h = createHarness();
  const originalWarn = h.fakeConsole.warn;
  h.command("arm");
  h.live(fight(10, 1.5));
  h.key("keydown");
  assert.equal(h.frames.size, 1, "a held Space samples once per frame");
  h.command("cancel");
  assert.equal(h.states.at(-1).status, "idle");
  assert.equal(h.frames.size, 0, "cancel releases the pending animation frame");
  assert.equal(h.fakeConsole.warn, originalWarn, "cancel restores console.warn");
  assert.equal(h.debugModules.reelHoldGate, false, "cancel restores the console module flag");

  h.command("arm");
  h.live(fight(10, 1.5));
  h.key("keydown");
  h.key("keyup");
  assert.equal(h.frames.size, 1);
  h.diagnostic.dispose();
  assert.equal(h.frames.size, 0, "dispose releases the recovery frame");
  assert.equal(h.fakeConsole.warn, originalWarn, "dispose restores console.warn");
  assert.equal(h.debugModules.reelHoldGate, false, "dispose restores the console module flag");
  const before = h.states.length;
  h.command("arm");
  h.key("keydown");
  assert.equal(h.states.length, before, "a disposed diagnostic ignores later commands and keys");
  assert.equal(h.frames.size, 0);
}

checkCompleteTrace();
checkCancelAndDispose();
console.log("Reel retrieve diagnostic passed: traces only after arm, completes with a scenario-scoped result, " +
  "and cancel/dispose release frames, listeners, console wrappers and the console module flag.");
