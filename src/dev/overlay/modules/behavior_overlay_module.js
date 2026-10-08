import { OverlayModule } from "../overlay_module.js";

export class BehaviorOverlayModule extends OverlayModule {
  constructor(options = {}) {
    super("state", options);
  }

  shouldRender(d) {
    return d.gameState === "playing" && d.hookedFish;
  }

  render(d) {
    const color = this.getStateColor(d.fishState);
    let html = this.formatHeader(
      `🧠 ПОВЕДІНКА (${d.hookedFish.name || "Риба"})`,
    );

    // Основні параметри поведінки
    html += `<div class="debug-overlay__line">Стан: <span class="debug-overlay__text debug-overlay__text--custom debug-overlay__text--state" style="--debug-overlay-color:${color};">${d.fishState || "---"}</span></div>`;
    html += `<div class="debug-overlay__line">Множник Тяги (Y): <span class="debug-overlay__text debug-overlay__text--custom" style="--debug-overlay-color:${color};">x${(d.pullMult || 0).toFixed(2)}</span></div>`;
    html += `<div class="debug-overlay__line">Множник Втечі (X): <span class="debug-overlay__text debug-overlay__text--custom" style="--debug-overlay-color:${color};">x${(d.moveMult || 0).toFixed(2)}</span></div>`;

    // --- НОВИЙ БЛОК: Прикормка для цієї риби ---
    if (d.chumZones && d.chumZones.length > 0) {
      // Шукаємо зони, які націлені на ID цієї риби
      const activeBonus = d.chumZones
        .filter(
          (z) =>
            !z.isExpired && z.baitConfig?.targets?.includes(d.hookedFish.id),
        )
        .reduce((max, z) => Math.max(max, z.currentBonus || 1), 1.0);

      if (activeBonus > 1) {
        html += `<div class="debug-overlay__divider">`;
        html += `<span class="debug-overlay__text debug-overlay__text--highlight">🧲 БОНУС ПРИКОРМКИ:</span> <span class="debug-overlay__text debug-overlay__text--success debug-overlay__text--emphasis">x${activeBonus.toFixed(2)}</span>`;
        html += `</div>`;
      } else {
        html += `<div class="debug-overlay__text debug-overlay__text--muted debug-overlay__note">Прикормка не впливає на цей вид</div>`;
      }
    }

    return html + `<div class="debug-overlay__spacer"></div>`;
  }
}
