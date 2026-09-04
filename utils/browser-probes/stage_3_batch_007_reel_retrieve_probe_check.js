"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..", "..");
const PROBE_PATH = path.join(
  ROOT,
  "src",
  "debug",
  "modules",
  "reel_hold_gate_live_probe.js",
);
const DEV_TOOLS_PATH = path.join(ROOT, "src", "debug", "dev_tools.js");

class BrowserEventTargetDouble {
  #listeners = new Map();

  addEventListener(type, listener) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, new Set());
    this.#listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.#listeners.get(type)?.delete(listener);
  }

  emit(type, event = {}) {
    for (const listener of this.#listeners.get(type) || []) {
      listener({ type, target: null, repeat: false, ...event });
    }
  }
}

class AnimationFrameHarness {
  #callbacks = [];
  #now = 0;
  #nextId = 1;

  get now() {
    return this.#now;
  }

  request(callback) {
    const id = this.#nextId;
    this.#nextId += 1;
    this.#callbacks.push({ id, callback });
    return id;
  }

  cancel(id) {
    this.#callbacks = this.#callbacks.filter((entry) => entry.id !== id);
  }

  flushOne() {
    const entry = this.#callbacks.shift();
    if (!entry) return false;
    this.#now += 16;
    entry.callback(this.#now);
    return true;
  }

  flushUntil(predicate, maxFrames = 20) {
    for (let frame = 0; frame < maxFrames && !predicate(); frame += 1) {
      assert.equal(this.flushOne(), true, "probe scheduled an animation frame");
    }
    assert.equal(predicate(), true, "probe completed inside the bounded frame window");
  }
}

class ReelRetrieveProbeContractCheck {
  async run() {
    await this.#acceptsFrameLocalRecovery();
    await this.#acceptsObservableStateRecovery();
    await this.#rejectsStrokeLineDesync();
    await this.#classifiesLegitimateGameplayBlocker();
    this.#verifiesDevToolsIntegrationBoundary();
  }

  async #acceptsFrameLocalRecovery() {
    const result = await this.#runScenario({ autoRecoveredMeters: 0.2 });
    assert.equal(result.verdict.status, "PASS");
    assert.equal(result.verdict.recoveryEvidence.frameRecovery, true);
  }

  async #acceptsObservableStateRecovery() {
    const result = await this.#runScenario({
      lineReleasedMeters: 9.7,
      rodStrokeWonMeters: 0.9,
    });
    assert.equal(result.verdict.status, "PASS");
    assert.equal(
      result.verdict.recoveryEvidence.lineReleasedMetersReduced,
      true,
    );
    assert.equal(
      result.verdict.recoveryEvidence.rodStrokeWonMetersReduced,
      true,
    );
  }

  async #rejectsStrokeLineDesync() {
    const result = await this.#runScenario({
      autoRecoveredMeters: 0.2,
      autoRecoverBlockedReason: "stroke_line_desync",
    });
    assert.equal(result.verdict.status, "NOT_PASS");
    assert.equal(result.verdict.blockerClassification, "hydration-desync");
  }

  async #classifiesLegitimateGameplayBlocker() {
    const result = await this.#runScenario({
      autoRecoverBlockedReason: "raw_load_above_drag_limit",
    });
    assert.equal(result.verdict.status, "NOT_PASS");
    assert.equal(
      result.verdict.blockerClassification,
      "gameplay-gate-review",
    );
  }

  async #runScenario(afterOverrides) {
    let snapshot = this.#debugSnapshot();
    const windowEvents = new BrowserEventTargetDouble();
    const documentEvents = new BrowserEventTargetDouble();
    const frames = new AnimationFrameHarness();
    const consoleDouble = {
      error() {},
      warn() {},
      info() {},
      table() {},
      groupCollapsed() {},
      groupEnd() {},
    };
    const windowDouble = {
      DEBUG_MODULES: {},
      console: consoleDouble,
      performance: { now: () => frames.now },
      requestAnimationFrame: (callback) => frames.request(callback),
      cancelAnimationFrame: (id) => frames.cancel(id),
      addEventListener: (...args) => windowEvents.addEventListener(...args),
      removeEventListener: (...args) =>
        windowEvents.removeEventListener(...args),
    };
    const documentDouble = {
      addEventListener: (...args) => documentEvents.addEventListener(...args),
      removeEventListener: (...args) =>
        documentEvents.removeEventListener(...args),
      dispatchEvent: (event) => {
        documentEvents.emit(event.type, event);
        return true;
      },
    };
    class CustomEventDouble {
      constructor(type, { detail = null } = {}) {
        this.type = type;
        this.detail = detail;
      }
    }
    const context = vm.createContext({
      console: consoleDouble,
      CustomEvent: CustomEventDouble,
      document: documentDouble,
      window: windowDouble,
    });
    vm.runInContext(fs.readFileSync(PROBE_PATH, "utf8"), context, {
      filename: PROBE_PATH,
    });

    windowDouble.CYBER_FISHING_REEL_HOLD_GATE_LIVE_PROBE.dispose();
    const Probe = windowDouble.ReelHoldGateLiveProbe;
    const probe = new Probe({ recoveryWindowMs: 16 });
    const states = [];
    const unsubscribe = probe.subscribeAcceptance((state) => states.push(state));

    await probe.armAcceptance();
    assert.equal(probe.getAcceptanceState().status, "armed");
    documentEvents.emit("debug-live-update", { detail: snapshot });
    windowEvents.emit("keydown", { code: "Space" });
    assert.equal(probe.getAcceptanceState().status, "capturing-before");

    snapshot = this.#debugSnapshot(afterOverrides);
    documentEvents.emit("debug-live-update", { detail: snapshot });
    windowEvents.emit("keyup", { code: "Space" });
    assert.equal(probe.getAcceptanceState().status, "observing-recovery");
    frames.flushUntil(() => probe.getAcceptanceState().status === "complete");

    const result = probe.getAcceptanceState();
    assert.equal(result.before.hasReel, true);
    assert.equal(result.before.lineTotalMeters, 10);
    assert.equal(result.before.lineReleasedMeters, 10);
    assert.equal(result.before.rodStrokeWonMeters, 1.2);
    assert.equal(result.verdict.consoleClean, true);
    assert.deepEqual(
      states.map((state) => state.status),
      ["idle", "arming", "armed", "capturing-before", "observing-recovery", "complete"],
    );

    unsubscribe();
    probe.dispose();
    return result;
  }

  #debugSnapshot(overrides = {}) {
    return {
      hasReel: true,
      lineTotalMeters: 10,
      lineReleasedMeters: 10,
      rodStrokeWonMeters: 1.2,
      lineDebug: {
        autoRecoveredMeters: 0,
        holdRecoveredMeters: 0,
        autoRecoverBlockedReason: "none",
      },
      ...overrides,
    };
  }

  #verifiesDevToolsIntegrationBoundary() {
    const source = fs.readFileSync(DEV_TOOLS_PATH, "utf8");
    assert.match(source, /STAGE 3\.7\.8 REEL \/ RETRIEVE GATE/);
    assert.match(source, /Arm A\/B probe/);
    assert.match(source, /Copy A\/B result/);
    assert.doesNotMatch(source, /createElement\(["']script["']\)/);
    assert.doesNotMatch(source, /stage_3_batch_007_reel_retrieve_probe\.js/);
    assert.doesNotMatch(
      source,
      /CYBER_FISHING_REEL_HOLD_GATE_LIVE_PROBE/,
    );
  }
}

new ReelRetrieveProbeContractCheck()
  .run()
  .then(() => {
    console.log(
      "Stage 3.7.8 DevTools reel/retrieve probe contract passed.",
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
