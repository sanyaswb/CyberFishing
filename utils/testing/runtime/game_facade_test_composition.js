"use strict";
const assert = require("node:assert/strict");
const { SourceRuntime } = require("../core/source_runtime");

async function checkGameFacadeComposition() {
  const runtime = new SourceRuntime();
  runtime.load("src/bootstrap/production/game.js", { expose: ["Game"] });
  const Game = runtime.context.Game, calls = [];
  let resolveBuild, outcome = false;
  const app = {
    start(...args) { assert.equal(this, app); assert.equal(args.length, 0); calls.push("start"); return outcome; },
    stop(...args) { assert.equal(this, app); assert.equal(args.length, 0); calls.push("stop"); return "ignored"; },
    dispose(...args) { assert.equal(this, app); assert.equal(args.length, 0); calls.push("dispose"); return "ignored"; },
  };
  const root = { build(canvasId) { assert.equal(this, root); assert.equal(canvasId, "original-canvas"); calls.push("build"); return new Promise(resolve => { resolveBuild = resolve; }); } };
  const game = new Game("original-canvas", root), ready = game.ready;
  assert.equal(game.ready, ready, "one authoritative readiness promise");
  assert.equal(game.stop(), undefined); assert.equal(game.dispose(), undefined);
  const started = game.start();
  assert.deepEqual(calls, ["build"], "early stop/dispose stay no-ops and start awaits the original build");
  resolveBuild(app);
  assert.equal(await started, false); assert.equal(await ready, app); assert.equal(game.ready, ready);
  assert.equal(game.stop(), undefined); assert.equal(game.dispose(), undefined);
  outcome = true; assert.equal(await game.start(), true);
  assert.deepEqual(calls, ["build", "start", "stop", "dispose", "start"]);
  const synchronous = new Game("sync", { build(id) { assert.equal(id, "sync"); return app; } });
  assert.equal(await synchronous.ready, app); assert.equal(await synchronous.start(), true);
  const error = new Error("original build rejection");
  const failed = new Game("failed", { build() { return Promise.reject(error); } });
  await assert.rejects(failed.ready, actual => actual === error);
  await assert.rejects(failed.start(), actual => actual === error);
  assert.equal(failed.stop(), undefined); assert.equal(failed.dispose(), undefined);
  const synchronousError = new Error("original synchronous build error");
  assert.throws(() => new Game("throw", { build() { throw synchronousError; } }), actual => actual === synchronousError);
}

module.exports = { checkGameFacadeComposition };
