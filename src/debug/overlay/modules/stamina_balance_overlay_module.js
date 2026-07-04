class StaminaBalanceOverlayModule extends OverlayModule {
  #formatter = new OverlayValueFormatter();

  constructor(options = {}) {
    super("staminaBalance", options);
  }

  shouldRender(data) {
    return data.gameState === "playing";
  }

  render(data) {
    const f = this.#formatter;
    const conditionPhase = this.#normalizePhase(data.fishConditionPhase);
    const framePhase = this.#normalizePhase(data.framePhase || data.staminaPhase);
    const phase = conditionPhase || framePhase || "stamina";
    let html = this.formatHeader("STAMINA BALANCE", "#ffcc00");
    html += this.metricRow("Condition phase", phase, {
      color: phase === "exhaustion" ? "#ff8888" : "#ffcc00",
    });
    html += this.metricRow("Frame phase", framePhase || "stamina", {
      color: framePhase === "exhaustion" ? "#ff8888" : "#8a9bac",
    });
    html += this.#renderSimplifiedSummary({ data, f });

    if (phase === "exhaustion") {
      return this.#renderEndurancePhase({ html, data, f });
    }

    return this.#renderStaminaPhase({ html, data, f });
  }

  #normalizePhase(value) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "exhaustion" || text === "stamina") return text;
    return null;
  }

  #renderSimplifiedSummary({ data, f }) {
    if (data.staminaModelMode !== "simplified") {
      return this.metricRow("Model", data.staminaModelMode || "legacy", {
        color: "#8a9bac",
      });
    }
    let html = "";
    html += this.metricRow("Model", "simplified", {
      color: "#00ff80",
    });
    html += this.metricRow(
      "Mode / reason",
      `${data.staminaMode || "idle"} / ${data.staminaTransitionReason || "none"}`,
      {
        color: data.staminaMode === "drain"
          ? "#ff8888"
          : data.staminaMode === "regen"
            ? "#00ff80"
            : "#8a9bac",
      },
    );
    html += this.metricRow(
      "Stamina pressure",
      `${f.kg(data.playerStaminaPressureKg, 3)} vs ${f.kg(data.fishStaminaResistanceKg, 3)}`,
      { color: "#ffaa00" },
    );
    html += this.metricRow(
      "Advantage / drain mult",
      `${f.percent(data.playerAdvantageRatio, 1)} / x${f.num(data.staminaDrainMultiplier, 2)}`,
      { color: f.stressColor(data.playerAdvantageRatio) },
    );
    html += this.metricRow(
      "Lateral edge",
      f.percent(data.lateralEdgeRatio, 1),
      { color: "#73c2fb" },
    );
    html += this.metricRow(
      "Hold / control mult",
      `x${f.num(data.holdStaminaDrainMultiplier, 2)} / x${f.num(data.controlStaminaDrainMultiplier, 2)}`,
      { color: "#c792ea" },
    );
    html += this.metricRow(
      "Control dir",
      `${data.controlDirectionState || "unknown"} x${f.num(data.controlCenteringFactor, 2)}`,
      {
        color: data.controlDirectionState === "centering"
          ? "#00ff80"
          : data.controlDirectionState === "wrong"
            ? "#ff8888"
            : "#8a9bac",
      },
    );
    html += this.metricRow(
      "Raw input",
      data.rawStaminaInputActive ? "active" : "inactive",
      { color: data.rawStaminaInputActive ? "#00ff80" : "#8a9bac" },
    );
    html += this.metricRow(
      "No input",
      `${f.seconds(data.staminaNoInputElapsedMs)} / ${f.seconds(data.staminaNoInputTimeoutMs)}`,
      {
        color: data.staminaNoInputRecoveryReady
          ? "#00ff80"
          : "#8a9bac",
      },
    );
    html += this.metricRow(
      "Recovery trigger",
      data.staminaRecoveryTrigger || "none",
      {
        color: data.staminaRecoveryTrigger === "no_input_timeout"
          ? "#00ff80"
          : data.staminaRecoveryTrigger === "fatigue_full" ||
              data.staminaRecoveryTrigger === "control_exhausted"
            ? "#ffaa00"
            : "#8a9bac",
      },
    );
    html += this.metricRow(
      "Regen multipliers",
      `angle x${f.num(data.staminaAngleRegenMultiplier, 2)} / fatigue x${f.num(data.fatigueRegenMultiplier, 2)}`,
      { color: "#00ff80" },
    );
    html += this.metricRow(
      "Exhaustion recovery",
      data.staminaRecoveryFromExhaustionActive ? "active" : "locked",
      {
        color: data.staminaRecoveryFromExhaustionActive
          ? "#00ff80"
          : "#8a9bac",
      },
    );
    return html;
  }

  #renderStaminaPhase({ html, data, f }) {
    if (data.staminaModelMode === "simplified") {
      return this.#renderSimplifiedStaminaPhase({ html, data, f });
    }
    html += this.metricRow(
      "Applied rodHold",
      f.kg(data.staminaAppliedRodHoldKg, 3),
      { color: "#00ff80" },
    );
    html += this.metricRow(
      "Applied control",
      f.kg(data.staminaAppliedControlKg, 3),
      { color: "#00d4ff" },
    );
    html += this.metricRow(
      "Used player pressure",
      f.kg(data.staminaUsedPlayerPressureKg, 3),
      { color: "#ffaa00" },
    );
    html += this.metricRow(
      "Active drain ratio",
      f.percent(data.staminaActiveDrainRatio, 1),
      { color: f.stressColor(data.staminaActiveDrainRatio) },
    );
    html += this.metricRow(
      "Active drain/sec",
      f.num(data.staminaActiveDrainPerSecond, 2),
      { color: "#ff8888" },
    );
    html += this.metricRow(
      "Passive regen/sec",
      f.num(data.staminaPassiveRegenPerSecond, 2),
      { color: "#00ff80" },
    );
    html += this.metricRow(
      "Line angle",
      `${f.num(data.staminaLineAngleDeg, 1)}deg`,
      { color: "#73c2fb" },
    );
    html += this.metricRow(
      "Angle regen multiplier",
      `x${f.num(data.staminaAngleRegenMultiplier, 2)}`,
      { color: "#73c2fb" },
    );
    html += this.metricRow(
      "Regen delay active",
      data.staminaRegenDelayActive ? "yes" : "no",
      { color: data.staminaRegenDelayActive ? "#ffaa00" : "#8a9bac" },
    );
    html += this.metricRow(
      "Net stamina/sec",
      f.num(data.staminaNetPerSecond, 2),
      { color: Number(data.staminaNetPerSecond) >= 0 ? "#00ff80" : "#ff8888" },
    );
    html += this.metricRow(
      "Weakest tackle limit",
      `${f.kg(data.staminaWeakestTackleLimitKg, 3)} (${data.staminaWeakestTackleLimitComponent || "none"})`,
      { color: "#ffaa00" },
    );
    html += this.metricRow(
      "Lateral stamina weight",
      f.num(data.staminaLateralWeight, 2),
      { color: "#8a9bac" },
    );
    html += this.metricRow(
      "Current stamina",
      f.num(data.currentStamina, 2),
      { color: "#ffcc00" },
    );
    html += this.metricRow(
      "Max stamina",
      f.num(data.fishConditionMaxStamina, 2),
      { color: "#8a9bac" },
    );
    html += this.metricRow(
      "Budget overflow warning",
      data.staminaBudgetOverflowWarning ? "yes" : "no",
      { color: data.staminaBudgetOverflowWarning ? "#ff4444" : "#8a9bac" },
    );
    return `${html}<div style="margin-bottom: 12px;"></div>`;
  }

  #renderSimplifiedStaminaPhase({ html, data, f }) {
    html += this.metricRow(
      "Rod / reel / control pressure",
      `${f.kg(data.rodHoldStaminaPressureKg, 3)} / ${f.kg(data.reelHoldStaminaPressureKg, 3)} / ${f.kg(data.controlStaminaPressureKg, 3)}`,
      { color: "#00ff80" },
    );
    html += this.metricRow(
      "Drain/sec",
      f.num(data.staminaActiveDrainPerSecond, 2),
      { color: data.staminaMode === "drain" ? "#ff8888" : "#8a9bac" },
    );
    html += this.metricRow(
      "Regen/sec",
      f.num(data.staminaRegenPerSecond, 2),
      { color: data.staminaMode === "regen" ? "#00ff80" : "#8a9bac" },
    );
    html += this.metricRow(
      "Current stamina",
      `${f.num(data.currentStamina, 2)} / ${f.num(data.fishConditionMaxStamina, 2)}`,
      { color: "#ffcc00" },
    );
    html += this.metricRow(
      "Frame stamina",
      `${f.num(data.staminaBefore, 2)} -> ${f.num(data.staminaAfter, 2)}`,
      { color: "#73c2fb" },
    );
    return `${html}<div style="margin-bottom: 12px;"></div>`;
  }

  #renderEndurancePhase({ html, data, f }) {
    html += this.metricRow(
      "Active endurance/sec",
      f.num(data.enduranceActiveDrainPerSecond, 2),
      { color: "#ff8888" },
    );
    html += this.metricRow(
      "Passive endurance/sec",
      f.num(data.endurancePassiveDrainPerSecond, 2),
      { color: "#ffb86c" },
    );
    html += this.metricRow(
      "Total endurance/sec",
      f.num(data.enduranceTotalDrainPerSecond, 2),
      { color: "#ff6666" },
    );
    html += this.metricRow(
      "Fish radial effort",
      f.kg(data.staminaFishRadialEffortKg, 3),
      { color: "#ff8888" },
    );
    html += this.metricRow(
      "Drag blocked",
      f.kg(data.staminaDragBlockedKg, 3),
      { color: "#ffaa00" },
    );
    html += this.metricRow(
      "Resistance ratio",
      f.percent(data.enduranceResistanceRatio, 1),
      { color: "#ffaa00" },
    );
    html += this.metricRow(
      "Line taut ratio",
      f.percent(data.enduranceLineTautRatio, 1),
      { color: data.staminaLineTaut ? "#00ff80" : "#8a9bac" },
    );
    html += this.metricRow(
      "Fish behavior",
      `${data.enduranceBehaviorName || "unknown"} x${f.num(data.enduranceBehaviorMultiplier, 2)}`,
      { color: "#c792ea" },
    );
    html += this.metricRow(
      "Movement debuff",
      data.enduranceMovementDebuffEnabled
        ? data.enduranceMovementDebuffActive
          ? "active"
          : "ready"
        : "disabled",
      {
        color: data.enduranceMovementDebuffActive
          ? "#ffb86c"
          : "#8a9bac",
      },
    );
    html += this.metricRow(
      "Movement progress",
      `${f.percent(data.enduranceMovementDebuffProgress, 1)} / power ${f.percent(data.enduranceMovementDebuffPower, 1)} (frame)`,
      { color: "#ffb86c" },
    );
    html += this.metricRow(
      "Target exhausted radial",
      `${f.num(data.enduranceTargetRadialMin, 2)}..${f.num(data.enduranceTargetRadialMax, 2)}`,
      { color: "#8a9bac" },
    );
    html += this.metricRow(
      "Selected behavior range",
      `${f.num(data.enduranceBaseRadialMin, 2)}..${f.num(data.enduranceBaseRadialMax, 2)} -> ${f.num(data.enduranceEffectiveRadialMin, 2)}..${f.num(data.enduranceEffectiveRadialMax, 2)}`,
      { color: "#73c2fb" },
    );
    html += this.metricRow(
      "Last sampled movement",
      `${data.enduranceLastSelectedBehavior || "unknown"} / radial ${f.num(data.enduranceLastSampledRadialIntent, 3)}`,
      { color: "#c792ea" },
    );
    html += this.metricRow(
      "Dash/swim weights",
      `x${f.num(data.enduranceDashWeightMultiplier, 2)} / x${f.num(data.enduranceSwimWeightMultiplier, 2)}`,
      { color: "#ff8888" },
    );
    html += this.metricRow(
      "Idle/rest weights",
      `x${f.num(data.enduranceIdleWeightMultiplier, 2)} / x${f.num(data.enduranceRestWeightMultiplier, 2)}`,
      { color: "#00ff80" },
    );
    html += this.metricRow(
      "Frame exhaustion",
      `${f.num(data.frameCurrentExhaustion, 2)}/${f.num(data.frameMaxEndurance, 2)} (${f.percent(data.frameEnduranceProgress, 1)})`,
      { color: "#ffb86c" },
    );
    html += this.metricRow(
      "Live exhaustion",
      `${f.num(data.currentExhaustion, 2)}/${f.num(data.fishConditionMaxEndurance, 2)}`,
      { color: "#ff8888" },
    );
    return `${html}<div style="margin-bottom: 12px;"></div>`;
  }
}

window.StaminaBalanceOverlayModule = StaminaBalanceOverlayModule;
