class EchoModule extends OverlayModule {
  constructor() {
    super("echo");
  }

  shouldRender(d) {
    return ["scouting", "waiting", "biting"].includes(d.gameState);
  }

  render(d) {
    let html = this.formatHeader("📡 ЕХОЛОТ", "#00ff80");
    const stateText = d.isBoatSonar ? "СКАНУВАННЯ (КОРАБЛИК)" : d.gameState;

    html += `<div style="margin-bottom: 4px;">Стан: <span style="color: #00ccff; text-transform: uppercase;">${stateText}</span></div>`;

    if (d.gameState !== "scouting" || d.isBoatSonar) {
      html += `<div style="margin-bottom: 4px;">`;
      if (d.isBoatSonar) {
        html += `Дно під корабликом: <span style="color: #ffaa00;">${d.bottomDepth ? d.bottomDepth.toFixed(2) : 0} м</span>`;
      } else {
        html += `Гачок: <span style="color: #ffaa00;">${d.hookDepth ? d.hookDepth.toFixed(2) : 0} м</span> / 
        Дно: <span style="color: #ffaa00;">${d.bottomDepth ? d.bottomDepth.toFixed(2) : 0} м</span> / 
        Ліска: <span style="color: #00ccff;">${d.lineLength ? d.lineLength.toFixed(2) : 0} м</span>`;
      }
      html += `</div>`;

      const baitsText = Array.isArray(d.baits)
        ? d.baits.join(", ")
        : d.bait || "---";
      html += `<div style="margin-bottom: 4px;">Наживка: <span style="color: #b066ff;">${baitsText}</span></div>`;

      html += `<div style="margin-bottom: 8px;">Фаза: <span style="color: #ffff00;">${d.phase || "---"}</span></div>`;

      let weather = d.isRaining
        ? "🌧️ Дощ "
        : d.isFoggy
          ? "🌫️ Туман"
          : "☀️ Ясно";
      html += `<div style="margin-bottom: 8px;">Погода: <span style="color: #00ccff;">${weather}</span></div>`;

      if (d.liveChances?.length > 0) {
        html += `<div style="color: #8a9bac; font-size: 12px; margin-bottom: 4px;">Шанси кльову:</div>`;
        d.liveChances.forEach((f) => {
          html += `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>${f.name}</span><span style="color: #00ff80; font-weight: bold;">${f.chance}</span>
          </div>`;
        });
      }
    } else {
      html += `<div style="color: #8a9bac; margin-bottom: 4px;">Закиньте вудку для аналізу...</div>`;
    }
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }
}

window.EchoModule = EchoModule;
