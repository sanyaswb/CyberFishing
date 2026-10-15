import { OverlayModule } from "../overlay_module.js";

export class ChancesDetailOverlayModule extends OverlayModule {
  constructor(options = {}) {
    super("chancesDetail", options);
  }

  shouldRender(d) {
    return (
      (d.gameState === "scouting" ||
        d.gameState === "waiting" ||
        d.gameState === "biting") &&
      d.liveChances?.length > 0
    );
  }

  render(d) {
    let html = this.formatHeader("🧮 РОЗРАХУНОК ШАНСІВ", "#b066ff");
    const godMode =
      typeof this.configSource() !== "undefined" ? this.configSource().debug?.godMode : null;
    if (godMode?.enabled) {
      const biteMode = godMode.biteSequenceMode || "default";
      if (godMode.forceAnomalyChance) {
        html += '<div class="debug-overlay__text debug-overlay__text--god-warning debug-overlay__notice">GOD Anomaly Chance: 100%</div>';
      }
      if (godMode.fixedBiteChanceEnabled) {
        const fixedPercent = Math.max(
          0,
          Math.min(100, Number(godMode.fixedBiteChancePercent) || 0),
        );
        html += `<div class="debug-overlay__text debug-overlay__text--success debug-overlay__notice">GOD Bite Chance: ${fixedPercent.toFixed(0)}% · Mode: ${biteMode}</div>`;
      } else if (biteMode !== "default") {
        html += `<div class="debug-overlay__text debug-overlay__text--success debug-overlay__notice">GOD Bite Mode: ${biteMode}</div>`;
      }
    }
    d.liveChances.forEach((fish) => {
      const b = fish.breakdown || {};
      const chumColor = parseFloat(b.chum) > 1.0 ? "#00ff80" : "#ddd";

      html += `<div class="debug-overlay__chance-card">`;
      html += `<div class="debug-overlay__pair">
                <span class="debug-overlay__text debug-overlay__text--bright debug-overlay__text--emphasis">${fish.name}</span>
                <span class="debug-overlay__text debug-overlay__text--success debug-overlay__text--emphasis">${fish.chance}</span>
              </div>`;

      html += `<div class="debug-overlay__text debug-overlay__text--muted debug-overlay__breakdown">
                <span>База: <span class="debug-overlay__text debug-overlay__text--detail">${b.base}</span></span>
                <span>Наживка: <span class="debug-overlay__text debug-overlay__text--detail">x${b.bait}</span></span>
                <span>Час: <span class="debug-overlay__text debug-overlay__text--detail">x${b.time}</span></span>
                <span>День: <span class="debug-overlay__text debug-overlay__text--detail">x${b.day}</span></span>
                <span>Глибина: <span class="debug-overlay__text debug-overlay__text--detail">x${b.depth}</span></span>
                <span>Погода: <span class="debug-overlay__text debug-overlay__text--detail">x${b.weather}</span></span>
                <span>Зона: <span class="debug-overlay__text debug-overlay__text--detail">x${b.zone}</span></span>
                <span>Прикормка: <span class="debug-overlay__text debug-overlay__text--custom debug-overlay__text--emphasis" style="--debug-overlay-color:${chumColor};">x${b.chum || "1.00"}</span></span>
                <span>Спам: <span class="debug-overlay__text debug-overlay__text--custom" style="--debug-overlay-color:${b.spam < 1 ? "#ff4444" : "#ddd"};">x${b.spam}</span></span>
                <span class="debug-overlay__wide">Лежачий поплавок: <span class="debug-overlay__text debug-overlay__text--custom" style="--debug-overlay-color:${b.overDepth < 1 ? "#ff4444" : "#ddd"};">x${b.overDepth}</span></span>
              </div></div>`;
    });
    return html + `<div class="debug-overlay__spacer"></div>`;
  }
}
