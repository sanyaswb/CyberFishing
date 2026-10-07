"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");
const estraverse = require("estraverse");
const { immutableRecord } = require("../../architecture/guards/core/guard_models");

const { ModuleEvaluationEffectObserver } = require("../../architecture/guards/observation/module_evaluation_effect_observer");

class CumulativeSideEffectGate {
  constructor({ projectRoot, observer = new ModuleEvaluationEffectObserver() } = {}) {
    this.projectRoot = path.resolve(projectRoot);
    this.observer = observer;
  }

  verify({ graph, reviews = [] }) {
    const reviewByModule = new Map(reviews.map((review) => [review.module, review]));
    const observations = [];
    for (const record of graph.modules) {
      const source = fs.readFileSync(path.resolve(this.projectRoot, record.path), "utf8");
      const observation = this.observer.observe({ modulePath: record.path, source });
      const review = reviewByModule.get(record.path) || null;
      if (observation.classification !== "safe") {
        if (!review) {
          throw new Error(
            `Cumulative module evaluation requires review: ${record.path} ` +
              `(${observation.classification})`,
          );
        }
        if (
          review.decision !== "approved-compatible" ||
          review.evidenceFingerprint !== observation.evidenceFingerprint
        ) {
          throw new Error(`Cumulative module side-effect review is stale: ${record.path}`);
        }
      } else if (review) {
        throw new Error(`Cumulative module side-effect review is stale and unnecessary: ${record.path}`);
      }
      observations.push({ ...observation, reviewed: Boolean(review) });
      reviewByModule.delete(record.path);
    }
    if (reviewByModule.size > 0) {
      throw new Error(
        `Cumulative side-effect review targets modules outside the graph: ` +
          [...reviewByModule.keys()].sort().join(", "),
      );
    }
    return immutableRecord({ status: "verified", modules: observations });
  }
}

module.exports = { CumulativeSideEffectGate, ModuleEvaluationEffectObserver };
