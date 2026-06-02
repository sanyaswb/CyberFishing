class BehaviorModule extends OverlayModule {
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
    html += `<div style="margin-bottom: 4px;">Стан: <span style="color: ${color}; text-transform: uppercase; font-weight: bold;">${d.fishState || "---"}</span></div>`;
    html += `<div style="margin-bottom: 4px;">Множник Тяги (Y): <span style="color: ${color};">x${(d.pullMult || 0).toFixed(2)}</span></div>`;
    html += `<div style="margin-bottom: 4px;">Множник Втечі (X): <span style="color: ${color};">x${(d.moveMult || 0).toFixed(2)}</span></div>`;

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
        html += `<div style="margin-top: 6px; padding-top: 4px; border-top: 1px dashed #4a5b6c;">`;
        html += `<span style="color: #ffff00;">🧲 БОНУС ПРИКОРМКИ:</span> <span style="color: #00ff80; font-weight: bold;">x${activeBonus.toFixed(2)}</span>`;
        html += `</div>`;
      } else {
        html += `<div style="margin-top: 6px; color: #8a9bac; font-size: 11px;">Прикормка не впливає на цей вид</div>`;
      }
    }

    return html + `<div style="margin-bottom: 12px;"></div>`;
  }
}

window.BehaviorModule = BehaviorModule;
