class WorstCaseModule extends OverlayModule {
  #selector;

  constructor({ selector = new WorstCaseForceDebugSelector(), ...options } = {}) {
    super("worstCase", options);
    this.#selector = selector;
  }

  shouldRender(d) {
    return d.gameState === "playing" && d.hookedFish;
  }

  render(d) {
    const worstCase = this.#selector.select(d);
    if (!worstCase) return "";

    let html = this.formatHeader("💀 НАЙГІРШІ УМОВИ (КУТ)", "#ff4444");
    html += `<div style="color: #8a9bac; font-size: 12px; margin-bottom: 4px;">Максимальна тяга X:</div>
             <div style="margin-bottom: 2px; display: flex; justify-content: space-between;"><span>Риба:</span> <span style="color: #ff4444; font-weight: bold;">${worstCase.worstFishX.toFixed(3)}</span></div>
             <div style="margin-bottom: 8px; display: flex; justify-content: space-between;"><span>Гравець:</span> <span style="color: #ffaa00; font-weight: bold;">${worstCase.playerSteerMin.toFixed(3)}</span></div>`;

    html += `<div style="color: #8a9bac; font-size: 12px; margin-bottom: 4px;">Максимальна тяга Y:</div>
             <div style="margin-bottom: 2px; display: flex; justify-content: space-between;"><span>Риба:</span> <span style="color: #ff4444; font-weight: bold;">${worstCase.maxPossibleForceY.toFixed(3)}</span></div>
             <div style="margin-bottom: 12px; display: flex; justify-content: space-between;"><span>Гравець:</span> <span style="color: #ffaa00; font-weight: bold;">${worstCase.worstPlayerY.toFixed(3)}</span></div>`;

    return html;
  }
}

window.WorstCaseModule = WorstCaseModule;
