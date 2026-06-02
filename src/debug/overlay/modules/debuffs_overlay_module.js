class DebuffsModule extends OverlayModule {
  constructor() {
    super("debuffsLive");
  }

  shouldRender(d) {
    return d.gameState === "playing";
  }

  render(d) {
    let html = this.formatHeader("☠️ АКТИВНІ ДЕБАФИ", "#ff00ff");

    // Секція рандомних дебафів
    const debuffName = d.activeDebuffName || "Немає";
    let debuffDesc = '<span style="color: #8a9bac;">фаза 2 ще ціла</span>';

    if (debuffName !== "Немає") {
      const sColor = this.getStateColor(d.fishState);
      debuffDesc = `<span style="color: ${sColor}; font-weight: bold;">[${d.fishState?.toUpperCase()}]</span> <span style="color: #ffaa00; font-size: 11px;">${debuffName}</span>`;
    }

    html += `<div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;"><span>Рандом:</span> <span>${debuffDesc}</span></div>`;

    // Секція Майстерності (Mastery)
    html += `<div style="margin-bottom: 2px;"><span>Майстерність:</span></div>`;

    const mRatio = CONFIG.stamina.mechanics.masteryTimeRatio || 0.5;
    const targetMs = (d.exhaustionDurationMs || 1000) * mRatio;
    const curTimer = d.masteryTimerMs || 0;
    const curMult = d.masteryCurrentMult || 1.0;

    let mHtml = "";
    if (curTimer === 0 && curMult === 1.0) {
      mHtml = `<span style="color: #8a9bac;">Тримайте по центру...</span>`;
    } else if (!d.isMasteryActive) {
      const pct = Math.min(100, (curTimer / targetMs) * 100);
      mHtml = `<div style="color: #00ccff; font-size: 11px; font-weight: bold;">[ФАЗА 1] Утримання: ${pct.toFixed(0)}%</div>`;
    } else {
      const pLost = ((1 - curMult) * 100).toFixed(1);
      mHtml = `<div style="color: #ff4444; font-size: 11px; font-weight: bold;">[ФАЗА 2] Здавлювання: ВПАЛА НА -${pLost}%</div>`;
    }

    html += `<div style="background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; border-left: 3px solid #ff00ff;">${mHtml}</div>`;
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }
}

window.DebuffsModule = DebuffsModule;
