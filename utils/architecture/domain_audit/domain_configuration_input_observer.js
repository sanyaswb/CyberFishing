"use strict";

const { immutableRecord } = require("../guards/core/guard_models");

class DomainConfigurationInputObserver {
  observe({ entry, moduleByPath }) {
    const inputs = new Map();
    const forbiddenDirectReads = new Set();
    for (const dependency of entry.analysis.dependencies.confirmed) {
      const target = moduleByPath.get(dependency.target);
      if (!target || !["game-config", "game-config-raw"].includes(
        target.architecture.targetBoundary,
      )) continue;
      const delivery = ["esm", "verified"].includes(
        entry.architecture.migrationStatus,
      ) ? "direct-import" : "global-read";
      inputs.set(`${dependency.target}\u0000${delivery}`, {
        source: dependency.target,
        delivery,
      });
      forbiddenDirectReads.add(`${dependency.target}:${dependency.symbol}`);
    }
    return immutableRecord({
      status: "verified",
      facts: {
        inputs: [...inputs.entries()]
          .sort(([left], [right]) => this.#compareText(left, right))
          .map(([, input]) => input),
        forbiddenDirectReads: [...forbiddenDirectReads].sort(this.#compareText),
        evidence: [{
          sourcePath: entry.currentPath,
          observation: "Configuration inputs and delivery mechanisms were derived from confirmed dependency provenance without parameter-name inference.",
        }],
        issues: [],
      },
    });
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { DomainConfigurationInputObserver };
