class FightHudFrameBuilder {
  #config;
  #canvasMetrics;
  #fatigueCompleteVisibleMs = 0;
  #previousFatigueStateName = "idle";
  #previousFatigueBuildNowMs = null;

  constructor({ config, canvasMetrics }) {
    this.#config = config;
    this.#canvasMetrics = canvasMetrics;
  }

  buildInto({
    target,
    tensionMeter,
    fishCondition,
    fightDebug,
    holdState,
    nowMs = null,
  }) {
    if (!tensionMeter || !fishCondition) return;
    this.#assertTensionMeter(tensionMeter);
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
    this.#buildPlayerPressureFatigue(
      target.playerPressureFatigue,
      fightDebug,
      nowMs,
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
    target.visible = true;
    target.staminaRatio = RenderMath.clamp(
      condition.currentStamina / maxStamina,
    );
    target.exhaustionRatio = RenderMath.clamp(
      condition.currentExhaustion / maxEndurance,
    );
    target.staminaValue =
      `${Math.round(condition.currentStamina)}/${Math.round(maxStamina)}`;
    target.exhaustionValue =
      `${Math.round(condition.currentExhaustion)}/${Math.round(maxEndurance)}`;
    target.phase = condition.phase;
  }

  #buildRodStroke(target, debug) {
    const unrecovered =
      Number(debug?.rodStrokeUnrecoveredMeters) || 0;
    const capacity = Number(debug?.rodStrokeCapacityMeters) || 0;
    target.visible = true;
    target.ratio = RenderMath.clamp(debug?.rodStrokeRatio);
    target.value = `${unrecovered.toFixed(1)}m / ${capacity.toFixed(1)}m`;
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
    target.visible = true;
    target.ratio = ratio;
    target.active = debug?.rodControlActive === true;
    target.value =
      `${direction < 0 ? "L" : direction > 0 ? "R" : "-"} ` +
      `${(ratio * 100).toFixed(0)}%`;
  }

  #buildTension(target, stressTarget, tensionMeter, debug) {
    const tension = tensionMeter.getTension();
    const tensionKg = tensionMeter.getTensionKg();
    const maxLoadKg = tensionMeter.getEffectiveMaxTackleLoadKg();
    const precision = Number.isFinite(maxLoadKg) && maxLoadKg <= 3 ? 2 : 1;
    const value =
      Number.isFinite(tensionKg) && Number.isFinite(maxLoadKg)
        ? `${tensionKg.toFixed(precision)}/${maxLoadKg.toFixed(precision)}kg`
        : Number.isFinite(tensionKg)
          ? `${tensionKg.toFixed(precision)}kg`
          : `${Math.round(tension)}%`;
    const dragLimitKg = Number(debug?.dragLimitKg);
    target.visible = true;
    target.ratio = RenderMath.clamp(tension / 100);
    target.pulse = tensionMeter.getPulseIntensity(this.#config.tension);
    target.value = value;
    target.dragMarkerVisible =
      debug?.dragSupported === true &&
      Number.isFinite(dragLimitKg) &&
      Number.isFinite(maxLoadKg) &&
      maxLoadKg > 0;
    target.dragMarkerRatio =
      Number.isFinite(maxLoadKg) && maxLoadKg > 0
        ? dragLimitKg / maxLoadKg
        : 0;

    const stressRatio = RenderMath.clamp(tensionMeter.getStressRatio());
    const shouldShow =
      stressRatio > 0 ||
      tension >= (this.#config.tension?.breakThreshold || 100) - 0.1;
    if (!shouldShow) return;
    const reason =
      tensionMeter.getBreakTargetReason() ||
      tensionMeter.getBreakReason() ||
      "line";
    stressTarget.visible = true;
    stressTarget.ratio = stressRatio;
    stressTarget.label =
      reason === "rod"
        ? "STRESS: ROD"
        : reason === "leader"
          ? "STRESS: LEADER"
          : "STRESS: LINE";
    stressTarget.value = `${Math.round(stressRatio * 100)}%`;
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
    target.visible = true;
    target.max = holdState.max;
    target.current = holdState.current;
    target.active = holdState.isActive === true;
    target.restoringCount = restoring.length;
    target.viewportWidth = this.#canvasMetrics.width;
    target.viewportHeight = this.#canvasMetrics.height;
  }

  #buildPlayerPressureFatigue(target, debug, nowMs) {
    const config =
      this.#config.physics?.fight?.playerPressureFatigue?.visual ||
      this.#config.playerPressureFatigue?.visual ||
      {};
    const recoveryConfig =
      this.#config.physics?.fight?.playerPressureFatigue?.recovery ||
      this.#config.playerPressureFatigue?.recovery ||
      {};
    const enabled =
      debug?.playerPressureFatigueEnabled === true &&
      config.enabled === true;
    const frameDeltaMs = this.#resolveFrameDeltaMs(nowMs);
    const rawStateName = debug?.playerPressureFatigueState || "idle";
    const holdCompleteVisibleMs = Math.max(
      0,
      Number(recoveryConfig.holdCompleteVisibleMs) || 0,
    );
    if (
      enabled &&
      rawStateName === "idle" &&
      this.#previousFatigueStateName === "recovering"
    ) {
      this.#fatigueCompleteVisibleMs = holdCompleteVisibleMs;
    } else if (rawStateName !== "idle") {
      this.#fatigueCompleteVisibleMs = 0;
    }
    const completeVisible = this.#fatigueCompleteVisibleMs > 0;
    const stateName = completeVisible ? "recovered" : rawStateName;
    const idleVisible = config.idleVisible === true;
    const visible = enabled && (idleVisible || stateName !== "idle");
    target.visible = visible;
    target.viewportWidth = this.#canvasMetrics.width;
    target.viewportHeight = this.#canvasMetrics.height;
    target.config = config;
    target.state = {
      stateName,
      sourceMode:
        debug?.playerPressureFatigueSourceMode || "reel_hold_session",
      sourceActive: debug?.playerPressureFatigueSourceActive === true,
      efficiency: RenderMath.clamp(debug?.playerPressureFatigueEfficiency),
      fatigueProgress: RenderMath.clamp(
        debug?.playerPressureFatigueProgress,
      ),
      graceElapsedMs: Math.max(
        0,
        Number(debug?.playerPressureFatigueGraceElapsedMs) || 0,
      ),
      graceDurationMs: Math.max(
        0,
        Number(debug?.playerPressureFatigueGraceDurationMs) || 0,
      ),
      recoveryProgress: RenderMath.clamp(
        debug?.playerPressureFatigueRecoveryProgress,
      ),
    };
    this.#fatigueCompleteVisibleMs = Math.max(
      0,
      this.#fatigueCompleteVisibleMs - frameDeltaMs,
    );
    this.#previousFatigueStateName = rawStateName;
  }

  #resolveFrameDeltaMs(nowMs) {
    const now = Number(nowMs);
    if (!Number.isFinite(now)) return 0;
    const previous = this.#previousFatigueBuildNowMs;
    this.#previousFatigueBuildNowMs = now;
    if (!Number.isFinite(previous)) return 0;
    return Math.max(0, Math.min(250, now - previous));
  }

  #assertTensionMeter(tensionMeter) {
    const methods = [
      "getTension",
      "getTensionKg",
      "getEffectiveMaxTackleLoadKg",
      "getPulseIntensity",
      "getStressRatio",
      "getBreakTargetReason",
      "getBreakReason",
    ];
    for (let index = 0; index < methods.length; index += 1) {
      const method = methods[index];
      if (typeof tensionMeter[method] !== "function") {
        throw new TypeError(`FightHudFrameBuilder requires tensionMeter.${method}`);
      }
    }
  }
}
