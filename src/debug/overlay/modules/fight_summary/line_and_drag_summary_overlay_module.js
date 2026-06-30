class LineAndDragSummaryOverlayModule extends OverlayModule {
  #formatter;

  constructor(options = {}) {
    super("lineAndDragSummary", options);
    this.#formatter = new OverlayValueFormatter();
  }

  shouldRender(data) {
    return data.gameState === "playing";
  }

  render(data) {
    const f = this.#formatter;
    const line = data.lineDebug || {};
    const total = line.totalLineMeters ?? data.lineTotalMeters ?? data.lineTotalLengthMeters;
    const released = line.releasedLineMeters ?? data.lineReleasedMeters;
    const remaining = line.remainingLineMeters ?? data.lineRemainingMeters;
    const releasedFrame = line.lineReleasedThisFrameMeters ?? data.lineReleasedThisFrameMeters;
    const recoveredFrame = line.lineRecoveredThisFrameMeters ?? data.lineRecoveredThisFrameMeters;
    const fullyExtended = line.fullyExtended ?? data.isLineFullyExtended;
    const hardLimit = line.hardLineLimit ?? data.hardLineLimit;
    const dragRatio = this.#positive(data.dragRatio);
    const dragLimitKg = data.effectiveDragLimitKg ?? data.dragLimitKg;
    const dragOpen = data.shouldSlipDrag || line.dragCanPayout || data.dragOpen;
    const dragBlockedForceKg = data.dragBlockedForceKg;

    let html = this.formatHeader("LINE & DRAG", "#73c2fb");
    html += this.metricRow("Line", `${f.meters(released, 2)} / ${f.meters(total, 2)}`, {
      metricKey: "lineAndDrag.lineReleased",
      color: "#ffaa00",
    });
    html += this.metricRow("Remaining", f.meters(remaining, 2), {
      metricKey: "lineAndDrag.lineRemaining",
      color: this.#positive(remaining) > 0 ? "#00ff80" : "#ff8888",
    });
    html += this.metricRow("Fully extended", fullyExtended ? "YES" : "NO", {
      metricKey: "lineAndDrag.fullyExtended",
      color: fullyExtended ? "#ff8888" : "#00ff80",
    });
    html += this.metricRow("Hard limit", hardLimit ? "YES" : "NO", {
      metricKey: "lineAndDrag.hardLimit",
      color: hardLimit ? "#ff8888" : "#8a9bac",
    });
    html += this.metricRow("Drag", f.percent(dragRatio, 1), {
      metricKey: "lineAndDrag.dragSetting",
      color: "#73c2fb",
    });
    html += this.metricRow("Drag limit", f.kg(dragLimitKg, 3), {
      metricKey: "lineAndDrag.dragLimit",
      color: "#00ccff",
    });
    html += this.metricRow("Drag state", dragOpen ? "payout/slip" : "holding/blocked", {
      metricKey: "lineAndDrag.dragState",
      color: dragOpen ? "#ff8888" : "#00ff80",
    });
    html += this.metricRow("Blocked force", f.kg(dragBlockedForceKg, 3), {
      metricKey: "lineAndDrag.blockedForce",
      color: "#ffaa00",
    });
    html += this.metricRow("Released frame", f.meters(releasedFrame, 3), {
      metricKey: "lineAndDrag.releasedFrame",
      color: this.#positive(releasedFrame) > 0 ? "#ff8888" : "#8a9bac",
    });
    html += this.metricRow("Recovered frame", f.meters(recoveredFrame, 3), {
      metricKey: "lineAndDrag.recoveredFrame",
      color: this.#positive(recoveredFrame) > 0 ? "#00ff80" : "#8a9bac",
    });
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }

  #positive(value) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
  }
}

window.LineAndDragSummaryOverlayModule = LineAndDragSummaryOverlayModule;
