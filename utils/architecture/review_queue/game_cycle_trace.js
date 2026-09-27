"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PROBE = path.join(__dirname, "game_cycle_trace_probe.js");
const GAME_CYCLE = "utils/game-cycle-check.js";

// Runs the game-cycle fight scenarios with the trace probe preloaded and returns, per traced class,
// the call count and deltaTime range of every public method and the SHA-256 of the ordered
// argument/result trace. The same scenarios after a migration must reproduce every trace exactly.
class StageThreeGameCycleTrace {
  constructor({ root }) {
    this.root = path.resolve(root);
  }

  run(classNames) {
    assert(Array.isArray(classNames) && classNames.length > 0, "trace classes are required");
    const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "cyber-game-cycle-trace-"));
    const output = path.join(directory, "trace.json");
    try {
      const result = spawnSync(process.execPath, ["--require", PROBE, GAME_CYCLE], {
        cwd: this.root,
        encoding: "utf8",
        env: { ...process.env, CYBER_GAME_CYCLE_TRACE_OUTPUT: output,
          CYBER_GAME_CYCLE_TRACE_CLASSES: JSON.stringify(classNames) },
        maxBuffer: 64 * 1024 * 1024,
      });
      assert.equal(result.status, 0, `game-cycle scenarios failed under the trace probe:\n${result.stderr}`);
      assert.match(result.stdout, /^game-cycle-check passed:/mu, "game-cycle scenarios did not pass");
      const traces = JSON.parse(fs.readFileSync(output, "utf8"));
      assert.deepEqual(Object.keys(traces).sort(), [...classNames].sort(), "game-cycle trace coverage differs");
      return traces;
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
}

module.exports = { StageThreeGameCycleTrace };
