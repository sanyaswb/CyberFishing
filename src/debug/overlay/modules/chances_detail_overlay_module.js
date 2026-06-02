class ChancesDetailModule extends OverlayModule {
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
      typeof CONFIG !== "undefined" ? CONFIG.debug?.godMode : null;
    if (godMode?.enabled) {
      const biteMode = godMode.biteSequenceMode || "default";
      if (godMode.fixedBiteChanceEnabled) {
        const fixedPercent = Math.max(
          0,
          Math.min(100, Number(godMode.fixedBiteChancePercent) || 0),
        );
        html += `<div style="margin-bottom:6px; color:#00ff80; font-size:11px;">GOD Bite Chance: ${fixedPercent.toFixed(0)}% · Mode: ${biteMode}</div>`;
      } else if (biteMode !== "default") {
        html += `<div style="margin-bottom:6px; color:#00ff80; font-size:11px;">GOD Bite Mode: ${biteMode}</div>`;
      }
    }
    d.liveChances.forEach((fish) => {
      const b = fish.breakdown || {};
      const chumColor = parseFloat(b.chum) > 1.0 ? "#00ff80" : "#ddd";

      html += `<div style="margin-bottom: 8px; background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; border-left: 3px solid #b066ff;">`;
      html += `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #fff; font-weight: bold;">${fish.name}</span>
                <span style="color: #00ff80; font-weight: bold;">${fish.chance}</span>
              </div>`;

      html += `<div style="color: #8a9bac; font-size: 11px; line-height: 1.4; display: grid; grid-template-columns: 1fr 1fr;">
                <span>База: <span style="color:#ddd">${b.base}</span></span>
                <span>Наживка: <span style="color:#ddd">x${b.bait}</span></span>
                <span>Час: <span style="color:#ddd">x${b.time}</span></span>
                <span>День: <span style="color:#ddd">x${b.day}</span></span>
                <span>Глибина: <span style="color:#ddd">x${b.depth}</span></span>
                <span>Погода: <span style="color:#ddd">x${b.weather}</span></span>
                <span>Зона: <span style="color:#ddd">x${b.zone}</span></span>
                <span>Прикормка: <span style="color:${chumColor}; font-weight: bold;">x${b.chum || "1.00"}</span></span>
                <span>Спам: <span style="color:${b.spam < 1 ? "#ff4444" : "#ddd"}">x${b.spam}</span></span>
                <span style="grid-column: span 2;">Лежачий поплавок: <span style="color:${b.overDepth < 1 ? "#ff4444" : "#ddd"}">x${b.overDepth}</span></span>
              </div></div>`;
    });
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }
}

window.ChancesDetailModule = ChancesDetailModule;
