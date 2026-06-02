class ChumOverlayModule extends OverlayModule {
  constructor(options = {}) {
    super("chum", options);
  }
  shouldRender(d) {
    return d.chumZones?.length > 0;
  }
  render(d) {
    let html = this.formatHeader("🧲 АКТИВНІ ПРИКОРМКИ", "#ffff00");
    d.chumZones.forEach((z, idx) => {
      const color = z.isExpired ? "#888" : "#00ff80";
      html += `<div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px;">
                <span>Зона ${idx + 1}:</span>
                <span style="color: ${color}; font-weight: bold;">x${(z.currentBonus || 1).toFixed(2)}</span>
               </div>`;
    });
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }
}

window.ChumOverlayModule = ChumOverlayModule;
