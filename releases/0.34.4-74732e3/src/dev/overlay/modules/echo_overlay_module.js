import { OverlayModule } from "../overlay_module.js";

export class EchoOverlayModule extends OverlayModule {
  constructor(options = {}) {
    super("echo", options);
  }

  shouldRender(d = {}) {
    return d.isBoatSonar || ["waiting", "biting"].includes(d.gameState);
  }

  render(d) {
    if (!this.shouldRender(d)) return "";

    let html = this.formatHeader("📡 ЕХОЛОТ", "#00ff80");
    const stateText = d.isBoatSonar ? "СКАНУВАННЯ (КОРАБЛИК)" : d.gameState;

    html += `<div class="debug-overlay__line">Стан: <span class="debug-overlay__text debug-overlay__text--accent debug-overlay__text--uppercase">${stateText}</span></div>`;

    if (d.gameState !== "scouting" || d.isBoatSonar) {
      html += `<div class="debug-overlay__line">`;
      if (d.isBoatSonar) {
        html += `Дно під корабликом: <span class="debug-overlay__text debug-overlay__text--warning">${d.bottomDepth ? d.bottomDepth.toFixed(2) : 0} м</span>`;
      } else {
        html += `Гачок: <span class="debug-overlay__text debug-overlay__text--warning">${d.hookDepth ? d.hookDepth.toFixed(2) : 0} м</span> /
        Дно: <span class="debug-overlay__text debug-overlay__text--warning">${d.bottomDepth ? d.bottomDepth.toFixed(2) : 0} м</span> /
        Ліска: <span class="debug-overlay__text debug-overlay__text--accent">${d.lineLength ? d.lineLength.toFixed(2) : 0} м</span>`;
      }
      html += `</div>`;

      const baitsText = Array.isArray(d.baits)
        ? d.baits.join(", ")
        : d.bait || "---";
      html += `<div class="debug-overlay__line">Наживка: <span class="debug-overlay__text debug-overlay__text--anomaly">${baitsText}</span></div>`;

      html += `<div class="debug-overlay__line debug-overlay__line--spaced">Фаза: <span class="debug-overlay__text debug-overlay__text--highlight">${d.phase || "---"}</span></div>`;

      let weather = d.isRaining
        ? "🌧️ Дощ "
        : d.isFoggy
          ? "🌫️ Туман"
          : "☀️ Ясно";
      html += `<div class="debug-overlay__line debug-overlay__line--spaced">Погода: <span class="debug-overlay__text debug-overlay__text--accent">${weather}</span></div>`;

      if (d.liveChances?.length > 0) {
        html += `<div class="debug-overlay__text debug-overlay__text--muted debug-overlay__caption">Шанси кльову:</div>`;
        d.liveChances.forEach((f) => {
          html += `<div class="debug-overlay__pair debug-overlay__pair--tight">
            <span>${f.name}</span><span class="debug-overlay__text debug-overlay__text--success debug-overlay__text--emphasis">${f.chance}</span>
          </div>`;
        });
      }
    }
    return html + `<div class="debug-overlay__spacer"></div>`;
  }
}
