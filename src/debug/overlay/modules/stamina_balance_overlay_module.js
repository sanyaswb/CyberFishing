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
    const phase = data.staminaPhase || data.fishConditionPhase || "stamina";
    let html = this.formatHeader("STAMINA BALANCE", "#ffcc00");
    html += this.metricRow("Phase", phase, {
      color: phase === "exhaustion" ? "#ff8888" : "#ffcc00",
    });

    if (phase === "exhaustion") {
      return this.#renderEndurancePhase({ html, data, f });
    }

    return this.#renderStaminaPhase({ html, data, f });
  }

  #renderStaminaPhase({ html, data, f }) {
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
      `${f.percent(data.enduranceMovementDebuffProgress, 1)} / power ${f.percent(data.enduranceMovementDebuffPower, 1)}`,
      { color: "#ffb86c" },
    );
    html += this.metricRow(
      "Radial range",
      `${f.num(data.enduranceBaseRadialMin, 2)}..${f.num(data.enduranceBaseRadialMax, 2)} -> ${f.num(data.enduranceEffectiveRadialMin, 2)}..${f.num(data.enduranceEffectiveRadialMax, 2)}`,
      { color: "#73c2fb" },
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
      "Current exhaustion",
      f.num(data.currentExhaustion, 2),
      { color: "#ff8888" },
    );
    html += this.metricRow(
      "Max endurance",
      f.num(data.fishConditionMaxEndurance, 2),
      { color: "#8a9bac" },
    );
    return `${html}<div style="margin-bottom: 12px;"></div>`;
  }
}

window.StaminaBalanceOverlayModule = StaminaBalanceOverlayModule;
