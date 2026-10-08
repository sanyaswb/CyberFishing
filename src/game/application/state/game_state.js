export class GameState {
  constructor(deps, data = {}) {
    this.deps = deps;
    this.data = data;
  }
  enter() {}
  exit() {}
  handleInput() {}
  update() {}
  getRenderState() {}
  dispose() {}

  getSelectedHookDepthMeters() {
    return this.deps.currentHookDepthRef?.get?.() ?? null;
  }

  getEffectiveCastDistance(
    equipment,
    fallback = Infinity,
    castPowerCoefficient = null,
  ) {
    return this.deps.rules.equipment.getEffectiveCastDistance(
      equipment,
      fallback,
      castPowerCoefficient,
      this.getSelectedHookDepthMeters(),
    );
  }
}
