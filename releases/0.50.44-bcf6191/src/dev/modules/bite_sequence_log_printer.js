import { formatBiteResult } from "../formatting/bite_log_labels.js";
import { DebugFormatters } from "../formatting/debug_formatters.js";

export class BiteSequenceLogPrinter {
  #debugModulesSource;

  constructor({ debugModulesSource } = {}) {
    this.#debugModulesSource = debugModulesSource;
  }

  print(detail = {}) {
    if (!this.#debugModulesSource().biteTicks) return;

    if (detail.event === "START") {
      this.#printStart(detail);
      return;
    }

    this.#printRoll(detail);
  }

  #printStart(detail) {
    const seq = detail.sequence || {};
    console.groupCollapsed(
      "%c[BITE:BITING] start sequence",
      "color: #ffcc00; font-weight: bold;",
    );
    console.table({
      Mode: detail.mode || "BITING",
      Event: "START",
      "Pulling during bite": detail.isPulling === true,
      "Active lure": detail.isSpinningLure === true,
      "Guaranteed chance": seq.chanceGuaranteedPercent || "n/a",
      "Normal chance": seq.chanceNormalPercent || "n/a",
      "Max sequences config": Array.isArray(seq.maxSequences)
        ? `${seq.maxSequences[0]}..${seq.maxSequences[1]}`
        : seq.maxSequences,
      "Generated sequences": seq.targetSequenceCount ?? "n/a",
      "Guaranteed iters": Array.isArray(seq.guaranteedIters)
        ? `${seq.guaranteedIters[0]}..${seq.guaranteedIters[1]}`
        : seq.guaranteedIters,
      "Normal iters": Array.isArray(seq.normalIters)
        ? `${seq.normalIters[0]}..${seq.normalIters[1]}`
        : seq.normalIters,
      "Fallback between iterations": Array.isArray(seq.intervalMs)
        ? `${DebugFormatters.ms(seq.intervalMs[0])}..${DebugFormatters.ms(seq.intervalMs[1])}`
        : DebugFormatters.ms(seq.intervalMs),
      "Fallback between sequences": Array.isArray(seq.sequenceIntervalMs)
        ? `${DebugFormatters.ms(seq.sequenceIntervalMs[0])}..${DebugFormatters.ms(seq.sequenceIntervalMs[1])}`
        : DebugFormatters.ms(seq.sequenceIntervalMs),
    });
    console.groupEnd();
  }

  #printRoll(detail) {
    console.groupCollapsed(
      `%c[BITE:BITING] sequence ${detail.sequenceIndex}/${detail.sequenceCount} -> ${detail.selectedType}`,
      "color: #ffcc00; font-weight: bold;",
    );
    console.table({
      Mode: detail.mode || "BITING",
      Event: detail.event || "SEQUENCE_ROLL",
      "Actual guaranteed chance": detail.chanceGuaranteedPercent,
      "Actual normal chance": detail.chanceNormalPercent,
      Roll: detail.rollPercent,
      "Selected type": detail.selectedType,
      "Generated iterations": detail.generatedIterations,
      "Fallback between sequences": detail.sequenceIntervalMs
        ? DebugFormatters.ms(detail.sequenceIntervalMs)
        : "not started",
    });

    if (Array.isArray(detail.iterations) && detail.iterations.length > 0) {
      console.table(
        detail.iterations.map((iter) => ({
          Iteration: iter.index,
          Result: formatBiteResult(iter.result),
          "Animation steps": iter.stepCount,
          Fallback: DebugFormatters.ms(iter.fallbackMs),
        })),
      );
    }
    console.groupEnd();
  }
}
