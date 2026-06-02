class LiveForcesModule extends OverlayModule {
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
          ? `<span style="color: #ff4444;">🚨 Риба тягне сильніше на ${yDiff}%</span>`
          : `<span style="color: #00ff80;">💪 Гравець тягне сильніше на ${yDiff}%</span>`;

      html += this.formatHeader("⚖️ LIVE: ТЯГА (Y)");
      html += `<div style="margin-bottom: 4px;">Гравець: <span style="color: #00ff80;">${pY.toFixed(3)}</span> | Риба: <span style="color: #ff4444;">${fY.toFixed(3)}</span></div>`;
      html += `<div style="font-weight: bold; font-size: 13px; margin-bottom: 12px;">${yLead}</div>`;
    }

    // Блок X (Керування)
    if (this.settingsStore?.isEnabled?.("liveX")) {
      const xLead =
        fX > pX
          ? `<span style="color: #ff4444;">🚨 Риба втікає (Домінує)</span>`
          : `<span style="color: #00ff80;">✅ Керування стабільне</span>`;

      html += this.formatHeader("⚖️ LIVE: КЕРУВАННЯ (X)");
      html += `<div style="margin-bottom: 4px;">Гравець: <span style="color: #00ff80;">${pX.toFixed(3)}</span> | Риба: <span style="color: #ff4444;">${fX.toFixed(3)}</span></div>`;
      html += `<div style="font-weight: bold; font-size: 13px; margin-bottom: 12px;">${xLead}</div>`;
    }

    return html;
  }
}

window.LiveForcesModule = LiveForcesModule;
