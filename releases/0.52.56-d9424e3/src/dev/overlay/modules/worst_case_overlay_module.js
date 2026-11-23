import { OverlayModule } from "../overlay_module.js";

export class WorstCaseOverlayModule extends OverlayModule {
  #selector;

  constructor({ selector, ...options } = {}) {
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
    html += `<div class="debug-overlay__text debug-overlay__text--muted debug-overlay__caption">Максимальна тяга X:</div>
             <div class="debug-overlay__pair debug-overlay__pair--tight"><span>Риба:</span> <span class="debug-overlay__text debug-overlay__text--danger debug-overlay__text--emphasis">${worstCase.worstFishX.toFixed(3)}</span></div>
             <div class="debug-overlay__pair debug-overlay__pair--separated"><span>Гравець:</span> <span class="debug-overlay__text debug-overlay__text--warning debug-overlay__text--emphasis">${worstCase.playerSteerMin.toFixed(3)}</span></div>`;

    html += `<div class="debug-overlay__text debug-overlay__text--muted debug-overlay__caption">Максимальна тяга Y:</div>
             <div class="debug-overlay__pair debug-overlay__pair--tight"><span>Риба:</span> <span class="debug-overlay__text debug-overlay__text--danger debug-overlay__text--emphasis">${worstCase.maxPossibleForceY.toFixed(3)}</span></div>
             <div class="debug-overlay__pair debug-overlay__pair--spaced"><span>Гравець:</span> <span class="debug-overlay__text debug-overlay__text--warning debug-overlay__text--emphasis">${worstCase.worstPlayerY.toFixed(3)}</span></div>`;

    return html;
  }
}
