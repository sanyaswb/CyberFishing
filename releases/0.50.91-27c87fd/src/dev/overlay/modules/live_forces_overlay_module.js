import { OverlayModule } from "../overlay_module.js";

export class LiveForcesOverlayModule extends OverlayModule {
  constructor(options = {}) {
    super("liveY", options);
  }

  isActive(data) {
    return (
      this.shouldRender(data) &&
      (this.settingsStore?.isEnabled?.("liveY") ||
        this.settingsStore?.isEnabled?.("liveX"))
    );
  }

  shouldRender(d) {
    return d.gameState === "playing";
  }

  render(d) {
    const pY = d.playerForceY || 0,
      fY = d.fishForceY || 0;
    const pX = d.playerForceX || 0,
      fX = d.fishForceX || 0;

    let html = "";

    // Блок Y (Тяга)
    if (this.settingsStore?.isEnabled?.("liveY")) {
      const yTotal = pY + fY || 1;
      const yDiff = Math.abs((pY / yTotal) * 100 - (fY / yTotal) * 100).toFixed(
        1,
      );
      const yLead =
        fY > pY
          ? `<span class="debug-overlay__text debug-overlay__text--danger">🚨 Риба тягне сильніше на ${yDiff}%</span>`
          : `<span class="debug-overlay__text debug-overlay__text--success">💪 Гравець тягне сильніше на ${yDiff}%</span>`;

      html += this.formatHeader("⚖️ LIVE: ТЯГА (Y)");
      html += `<div class="debug-overlay__line">Гравець: <span class="debug-overlay__text debug-overlay__text--success">${pY.toFixed(3)}</span> | Риба: <span class="debug-overlay__text debug-overlay__text--danger">${fY.toFixed(3)}</span></div>`;
      html += `<div class="debug-overlay__comparison">${yLead}</div>`;
    }

    // Блок X (Керування)
    if (this.settingsStore?.isEnabled?.("liveX")) {
      const xLead =
        fX > pX
          ? `<span class="debug-overlay__text debug-overlay__text--danger">🚨 Риба втікає (Домінує)</span>`
          : `<span class="debug-overlay__text debug-overlay__text--success">✅ Керування стабільне</span>`;

      html += this.formatHeader("⚖️ LIVE: КЕРУВАННЯ (X)");
      html += `<div class="debug-overlay__line">Гравець: <span class="debug-overlay__text debug-overlay__text--success">${pX.toFixed(3)}</span> | Риба: <span class="debug-overlay__text debug-overlay__text--danger">${fX.toFixed(3)}</span></div>`;
      html += `<div class="debug-overlay__comparison">${xLead}</div>`;
    }

    return html;
  }
}
