import { OverlayModule } from "../overlay_module.js";

export class ChumOverlayModule extends OverlayModule {
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
      html += `<div class="debug-overlay__pair debug-overlay__pair--compact">
                <span>Зона ${idx + 1}:</span>
                <span class="debug-overlay__text debug-overlay__text--custom debug-overlay__text--emphasis" style="--debug-overlay-color:${color};">x${(z.currentBonus || 1).toFixed(2)}</span>
               </div>`;
    });
    return html + `<div class="debug-overlay__spacer"></div>`;
  }
}
