class FightSummaryOverlayModule extends OverlayModule {
  #formatter;

  constructor(options = {}) {
    super("fightSummary", options);
    this.#formatter = new OverlayValueFormatter();
  }

  shouldRender(data) {
    return data.gameState === "playing";
  }

  render(data) {
    const f = this.#formatter;
    const fishOppositionKg = this.#positive(data.fishOppositionKg);
    const playerPressureKg = this.#resolvePlayerPressureKg(data);
    const totalTensionKg = this.#positive(data.totalTensionKg ?? data.calculatedTensionKg);
    const weakestLimitKg = this.#resolveWeakestLimitKg(data);
    const tensionRatio = weakestLimitKg > 0 ? totalTensionKg / weakestLimitKg : 0;
    const netForceKg = this.#finite(data.netForceKg, playerPressureKg - fishOppositionKg);
    const breakRisk = this.#resolveBreakRisk({ tensionRatio, data });

    let html = this.formatHeader("FIGHT SUMMARY", "#00ff80");
    html += this.metricRow("Fish opposition", f.kg(fishOppositionKg, 3), {
      metricKey: "fightSummary.fishOpposition",
      color: "#ff8888",
    });
    html += this.metricRow("Player pressure", f.kg(playerPressureKg, 3), {
      metricKey: "fightSummary.playerPressure",
      color: "#00ff80",
    });
    html += this.metricRow("Total tension", f.kg(totalTensionKg, 3), {
      metricKey: "fightSummary.totalTension",
      color: f.stressColor(tensionRatio),
    });
    html += this.metricRow("Weakest limit", f.kg(weakestLimitKg, 3), {
      metricKey: "fightSummary.weakestLimit",
      color: "#73c2fb",
    });
    html += this.metricRow("Tension", f.percent(tensionRatio, 1), {
      metricKey: "fightSummary.tensionRatio",
      color: f.stressColor(tensionRatio),
    });
    html += this.metricRow("Winner", f.winner(netForceKg), {
      metricKey: "fightSummary.winner",
      color: f.netForceColor(netForceKg),
    });
    html += this.metricRow("Net force", f.kg(netForceKg, 3), {
      metricKey: "fightSummary.netForce",
      color: f.netForceColor(netForceKg),
    });
    html += this.metricRow("Break risk", breakRisk.label, {
      metricKey: "fightSummary.breakRisk",
      color: breakRisk.color,
    });
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }

  #resolvePlayerPressureKg(data) {
    const explicit = this.#positive(data.playerPressureKg);
    if (explicit > 0) return explicit;
    return (
      this.#positive(data.playerHoldTensionKg) +
      this.#positive(data.rodControlPlayerTensionKg)
    );
  }

  #resolveWeakestLimitKg(data) {
    return this.#positive(
      data.weakestTackleLimitKg ??
        data.mainTackleLimitKg ??
        data.equipmentLimitKg ??
        Math.min(
          ...[
            data.rodLimitKg,
            data.lineLimitKg,
            data.hookLimitKg,
            data.reelLimitKg,
          ]
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value > 0),
        ),
    );
  }

  #resolveBreakRisk({ tensionRatio, data }) {
    if (data.guaranteedFailure || tensionRatio >= 1) {
      return { label: "critical", color: "#ff4444" };
    }
    const failureChance = Number(data.failureChance);
    if (Number.isFinite(failureChance) && failureChance > 0) {
      return {
        label: `${(failureChance * 100).toFixed(1)}% roll`,
        color: failureChance >= 0.5 ? "#ff4444" : "#ffaa00",
      };
    }
    if (tensionRatio >= 0.9) return { label: "danger", color: "#ff4444" };
    if (tensionRatio >= 0.7) return { label: "warning", color: "#ffaa00" };
    return { label: "safe", color: "#00ff80" };
  }

  #positive(value) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
  }

  #finite(value, fallback = 0) {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : fallback;
  }
}

window.FightSummaryOverlayModule = FightSummaryOverlayModule;
