export class HoldOppositionResolver {
  resolve({
    activeRodHoldKg = 0,
    fishDirectionState = "away",
    directionConfig,
  } = {}) {
    const config = directionConfig || {};
    const ratioByDirection = {
      toward_player: this.#ratio(
        config.towardPlayerHoldOppositionRatio,
        0,
      ),
      side: this.#ratio(config.sideHoldOppositionRatio, 0.35),
      away: this.#ratio(config.awayHoldOppositionRatio, 1),
    };
    const direction = Object.hasOwn(ratioByDirection, fishDirectionState)
      ? fishDirectionState
      : "away";
    const ratio = ratioByDirection[direction];
    return Object.freeze({
      direction,
      ratio,
      forceKg: this.#positive(activeRodHoldKg) * ratio,
    });
  }

  #positive(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  }

  #ratio(value, fallback) {
    const number = Number(value);
    const resolved = Number.isFinite(number) ? number : fallback;
    return Math.max(0, Math.min(1, resolved));
  }
}
