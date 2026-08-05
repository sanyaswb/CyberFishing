class BiteTicksDebugModule extends ConsoleTableDebugModule {
  constructor() {
    super({ key: "biteTicks", title: "Bite Tick Logger" });
  }

  render() {
    const config = typeof CONFIG !== "undefined" ? CONFIG : {};
    const tickRate = config.spawns?.tickRateMs ?? "n/a";
    const cooldown =
      config.fightPhysicsConfig?.getLureRetrieveConfig?.()
        ?.guaranteedBiteCooldownMs || [];
    const godMode = config.debug?.godMode || {};

    console.table({
      "Logger status": "enabled",
      "Waiting tick rate": `${tickRate} ms`,
      "Guaranteed cooldown min":
        cooldown[0] != null ? DebugFormatters.ms(cooldown[0]) : "n/a",
      "Guaranteed cooldown max":
        cooldown[1] != null ? DebugFormatters.ms(cooldown[1]) : "n/a",
      "GOD fixed chance": godMode.fixedBiteChanceEnabled
        ? `${godMode.fixedBiteChancePercent}%`
        : "off",
      "GOD anomaly chance": godMode.forceAnomalyChance ? "100%" : "default",
      "GOD bite sequence mode": godMode.biteSequenceMode || "default",
      "Event source": "BiteSystem + WaterEntity.startBite/_rollBiteSequence",
    });
  }
}

class BiteTickLogPrinter {
  #debugModulesSource;

  constructor({ debugModulesSource = () => window.DEBUG_MODULES || {} } = {}) {
    this.#debugModulesSource = debugModulesSource;
  }

  print(detail = {}) {
    if (!this.#debugModulesSource().biteTicks) return;

    const tick = detail.tickIndex ?? "?";
    const result = detail.result || "n/a";
    const cooldown = detail.cooldown || {};
    const title =
      cooldown.active && result === "COOLDOWN"
        ? `[BITE:WAITING] #${tick} cooldown active - next checks paused`
        : `[BITE:WAITING] #${tick} ${result}`;

    console.groupCollapsed(
      `%c${title}`,
      "color: #00d1ff; font-weight: bold;",
    );
    console.table({
      Mode: detail.mode || "WAITING",
      Tick: tick,
      "Tick rate": DebugFormatters.ms(detail.tickRateMs),
      "Checked fish": detail.checkedFishCount ?? 0,
      Result: result,
      "Bite candidates": detail.bitesCount ?? 0,
      "Selected fish": detail.selectedFish
        ? `${detail.selectedFish.name || detail.selectedFish.id} (${detail.selectedFish.chancePercent})`
        : "none",
      "GOD fixed chance": detail.godMode?.fixedBiteChanceEnabled
        ? `${detail.godMode.fixedBiteChancePercent}%`
        : "off",
      "GOD anomaly chance": detail.godMode?.forceAnomalyChance
        ? "100%"
        : "default",
      "GOD sequence mode": detail.godMode?.biteSequenceMode || "default",
    });

    if (Array.isArray(detail.fishRolls) && detail.fishRolls.length > 0) {
      console.table(
        detail.fishRolls.map((fish, index) => ({
          "#": index + 1,
          Fish: fish.name || fish.id,
          Chance: fish.chancePercent,
          Roll: fish.rollPercent,
          Result: fish.skipped ? "skip: chance 0%" : fish.result,
        })),
      );
    }

    if (cooldown.active) {
      console.table({
        "Cooldown active": true,
        Reason: cooldown.reason || "n/a",
        "Started at": cooldown.startedMs
          ? DebugFormatters.ms(cooldown.startedMs)
          : "n/a",
        "Before remaining": cooldown.beforeMs
          ? DebugFormatters.ms(cooldown.beforeMs)
          : "n/a",
        "After remaining": cooldown.afterMs
          ? DebugFormatters.ms(cooldown.afterMs)
          : "n/a",
      });
    } else {
      console.info("Cooldown after bite: not started.");
    }

    console.groupEnd();
  }
}

class BiteSequenceLogPrinter {
  #debugModulesSource;

  constructor({ debugModulesSource = () => window.DEBUG_MODULES || {} } = {}) {
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
          Result: iter.result,
          "Animation steps": iter.stepCount,
          Fallback: DebugFormatters.ms(iter.fallbackMs),
        })),
      );
    }
    console.groupEnd();
  }
}

window.BiteTicksDebugModule = BiteTicksDebugModule;
window.BiteTickLogPrinter = BiteTickLogPrinter;
window.BiteSequenceLogPrinter = BiteSequenceLogPrinter;
