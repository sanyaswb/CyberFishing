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
    let html = this.formatHeader("STAMINA BALANCE", "#ffcc00");
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
      "Line angle",
      `${f.num(data.staminaLineAngleDeg, 1)}deg`,
      { color: "#73c2fb" },
    );
    html += this.metricRow(
      "Angle recovery ratio",
      f.percent(data.staminaAngleRecoveryRatio, 1),
      { color: "#73c2fb" },
    );
    html += this.metricRow(
      "Angle regen/sec",
      f.num(data.staminaAngleRegenPerSecond, 2),
      { color: "#00ff80" },
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
      "Allow regen while pulling",
      data.staminaAllowRegenWhilePulling ? "yes" : "no",
      { color: data.staminaAllowRegenWhilePulling ? "#00ff80" : "#ffaa00" },
    );
    html += this.metricRow(
      "Budget overflow warning",
      data.staminaBudgetOverflowWarning ? "yes" : "no",
      { color: data.staminaBudgetOverflowWarning ? "#ff4444" : "#8a9bac" },
    );
    return `${html}<div style="margin-bottom: 12px;"></div>`;
  }
}

window.StaminaBalanceOverlayModule = StaminaBalanceOverlayModule;
