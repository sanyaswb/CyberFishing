class FightHudFrameBuilder {
  #config;
  #canvasMetrics;

  constructor({ config, canvasMetrics }) {
    this.#config = config;
    this.#canvasMetrics = canvasMetrics;
  }

  buildInto({ target, tensionMeter, fishCondition, fightDebug, holdState }) {
    if (!tensionMeter || !fishCondition) return;
    target.visible = true;
    target.viewportWidth = this.#canvasMetrics.width;
    target.viewportHeight = this.#canvasMetrics.height;
    this.#buildFishCondition(target.fishCondition, fishCondition);
    this.#buildRodStroke(target.rodStroke, fightDebug);
    this.#buildRodControl(target.rodControl, fightDebug);
    this.#buildTension(
      target.tension,
      target.tackleStress,
      tensionMeter,
      fightDebug,
    );
    this.#buildHoldCharges(target.holdCharges, holdState);
  }

  #buildFishCondition(target, condition) {
    const maxStamina = Math.max(
      0.001,
      Number(condition.maxStamina ?? condition.maxPoints) || 0,
    );
    const maxEndurance = Math.max(
      0.001,
      Number(condition.maxEndurance ?? condition.maxPoints) || 0,
    );
    Object.assign(target, {
      visible: true,
      staminaRatio: RenderMath.clamp(
        condition.currentStamina / maxStamina,
      ),
      exhaustionRatio: RenderMath.clamp(
        condition.currentExhaustion / maxEndurance,
      ),
      staminaValue:
        `${Math.round(condition.currentStamina)}/${Math.round(maxStamina)}`,
      exhaustionValue:
        `${Math.round(condition.currentExhaustion)}/${Math.round(maxEndurance)}`,
      phase: condition.phase,
    });
  }

  #buildRodStroke(target, debug) {
    const unrecovered =
      Number(debug?.rodStrokeUnrecoveredMeters) || 0;
    const capacity = Number(debug?.rodStrokeCapacityMeters) || 0;
    Object.assign(target, {
      visible: true,
      ratio: RenderMath.clamp(debug?.rodStrokeRatio),
      value: `${unrecovered.toFixed(1)}м / ${capacity.toFixed(1)}м`,
    });
  }

  #buildRodControl(target, debug) {
    const ratio = RenderMath.clamp(
      debug?.rodControlDeliveredForceRatio,
    );
    const direction = Math.sign(
      Number(debug?.rodControlInputDirectionX) ||
        Number(debug?.rodControlDirectionX) ||
        0,
    );
    Object.assign(target, {
      visible: true,
      ratio,
      active: debug?.rodControlActive === true,
      value:
        `${direction < 0 ? "L" : direction > 0 ? "R" : "-"} ` +
        `${(ratio * 100).toFixed(0)}%`,
    });
  }

  #buildTension(target, stressTarget, tensionMeter, debug) {
    const tension = tensionMeter.getTension();
    const tensionKg = tensionMeter.getTensionKg?.();
    const maxLoadKg = tensionMeter.getEffectiveMaxTackleLoadKg?.();
    const precision = Number.isFinite(maxLoadKg) && maxLoadKg <= 3 ? 2 : 1;
    const value =
      Number.isFinite(tensionKg) && Number.isFinite(maxLoadKg)
        ? `${tensionKg.toFixed(precision)}/${maxLoadKg.toFixed(precision)}кг`
        : Number.isFinite(tensionKg)
          ? `${tensionKg.toFixed(precision)}кг`
          : `${Math.round(tension)}%`;
    const dragLimitKg = Number(debug?.dragLimitKg);
    Object.assign(target, {
      visible: true,
      ratio: RenderMath.clamp(tension / 100),
      pulse: tensionMeter.getPulseIntensity(this.#config.tension),
      value,
      dragMarkerVisible:
        debug?.dragSupported === true &&
        Number.isFinite(dragLimitKg) &&
        Number.isFinite(maxLoadKg) &&
        maxLoadKg > 0,
      dragMarkerRatio:
        Number.isFinite(maxLoadKg) && maxLoadKg > 0
          ? dragLimitKg / maxLoadKg
          : 0,
    });

    const stressRatio = RenderMath.clamp(
      tensionMeter.getStressRatio?.(),
    );
    const shouldShow =
      stressRatio > 0 ||
      tension >= (this.#config.tension?.breakThreshold || 100) - 0.1;
    if (!shouldShow) return;
    const reason =
      tensionMeter.getBreakTargetReason?.() ||
      tensionMeter.getBreakReason?.() ||
      "line";
    Object.assign(stressTarget, {
      visible: true,
      ratio: stressRatio,
      label:
        reason === "rod"
          ? "STRESS: ROD"
          : reason === "leader"
            ? "STRESS: LEADER"
            : "STRESS: LINE",
      value: `${Math.round(stressRatio * 100)}%`,
    });
  }

  #buildHoldCharges(target, holdState) {
    if (!holdState?.hasHold || holdState.max <= 0) return;
    const restoring = holdState.restoring || [];
    if (!target.restoreProgress) target.restoreProgress = [];
    const maxTime = Math.max(1, Number(holdState.restoreMaxTime) || 1);
    for (let index = 0; index < restoring.length; index += 1) {
      target.restoreProgress[index] = RenderMath.clamp(
        1 - restoring[index] / maxTime,
      );
    }
    Object.assign(target, {
      visible: true,
      max: holdState.max,
      current: holdState.current,
      active: holdState.isActive === true,
      restoringCount: restoring.length,
      viewportWidth: this.#canvasMetrics.width,
      viewportHeight: this.#canvasMetrics.height,
    });
  }
}
