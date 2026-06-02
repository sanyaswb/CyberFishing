class FishPowerModule extends OverlayModule {
  constructor() {
    super("fishBase");
  }

  shouldRender(d) {
    return d.gameState === "playing";
  }

  render(d) {
    const initial = d.fishInitialPower || 0;
    const current = d.fishBasePower || 0;
    const lost = initial - current;

    let html = this.formatHeader("🔥 ПОТОЧНА БАЗОВА СИЛА РИБИ", "#ffaa00");
    html += `<div style="margin-bottom: 4px;">Початкова база: <span style="color: #8a9bac;">${initial.toFixed(2)}</span></div>`;
    html += `<div style="margin-bottom: 4px;">Втрачено (Виснаження): <span style="color: #ff4444; font-weight: bold;">-${lost.toFixed(2)}</span></div>`;
    html += `<div style="margin-bottom: 12px; font-size: 16px;">Поточна: <span style="color: #00ff80; font-weight: bold;">${current.toFixed(2)}</span></div>`;
    return html;
  }
}

window.FishPowerModule = FishPowerModule;
