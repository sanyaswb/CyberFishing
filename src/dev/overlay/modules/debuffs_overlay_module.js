import { formatDebuffName } from "../../formatting/debuff_name_formatter.js";
import { OverlayModule } from "../overlay_module.js";

export class DebuffsOverlayModule extends OverlayModule {
  constructor(options = {}) {
    super("debuffsLive", options);
  }

  shouldRender(d) {
    return d.gameState === "playing";
  }

  render(d) {
    let html = this.formatHeader("☠️ АКТИВНІ ДЕБАФИ", "#ff00ff");

    // Секція рандомних дебафів
    const debuffName = formatDebuffName(d.debuffState);
    let debuffDesc = '<span class="debug-overlay__text debug-overlay__text--muted">фаза 2 ще ціла</span>';

    if (debuffName !== "Немає") {
      const sColor = this.getStateColor(d.fishState);
      debuffDesc = `<span class="debug-overlay__text debug-overlay__text--custom debug-overlay__text--emphasis" style="--debug-overlay-color:${sColor};">[${d.fishState?.toUpperCase()}]</span> <span class="debug-overlay__text debug-overlay__text--warning debug-overlay__text--small">${debuffName}</span>`;
    }

    html += `<div class="debug-overlay__pair debug-overlay__pair--centered"><span>Рандом:</span> <span>${debuffDesc}</span></div>`;

    // Секція Майстерності (Mastery)
    html += `<div class="debug-overlay__line debug-overlay__line--tight"><span>Майстерність:</span></div>`;

    const mRatio = this.configSource().stamina.mechanics.masteryTimeRatio || 0.5;
    const targetMs = (d.exhaustionDurationMs || 1000) * mRatio;
    const curTimer = d.masteryTimerMs || 0;
    const curMult = d.masteryCurrentMult || 1.0;

    let mHtml = "";
    if (curTimer === 0 && curMult === 1.0) {
      mHtml = `<span class="debug-overlay__text debug-overlay__text--muted">Тримайте по центру...</span>`;
    } else if (!d.isMasteryActive) {
      const pct = Math.min(100, (curTimer / targetMs) * 100);
      mHtml = `<div class="debug-overlay__text debug-overlay__text--accent debug-overlay__text--small debug-overlay__text--emphasis">[ФАЗА 1] Утримання: ${pct.toFixed(0)}%</div>`;
    } else {
      const pLost = ((1 - curMult) * 100).toFixed(1);
      mHtml = `<div class="debug-overlay__text debug-overlay__text--danger debug-overlay__text--small debug-overlay__text--emphasis">[ФАЗА 2] Здавлювання: ВПАЛА НА -${pLost}%</div>`;
    }

    html += `<div class="debug-overlay__debuff-card">${mHtml}</div>`;
    return html + `<div class="debug-overlay__spacer"></div>`;
  }
}
