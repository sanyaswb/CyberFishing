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

  // Cast accuracy of the equipped rod with the casting config fallbacks (casting and recasting share it).
  getRodAccuracyPx(equipment) {
    return (
      Number(equipment?.rod?.effectiveStats?.accuracy) ||
      this.deps.config.casting?.rodAccuracyFallbackPx ||
      80
    );
  }

  getRodAccuracyPercent(equipment) {
    return (
      Number(equipment?.rod?.effectiveStats?.accuracyPercent) ||
      this.deps.config.casting?.accuracyDistancePercent ||
      null
    );
  }

  getRodAccuracyMultiplier(equipment) {
    return (
      Number(equipment?.rod?.effectiveStats?.accuracyMultiplier) ||
      this.deps.config.casting?.accuracyDistanceMultiplier ||
      1
    );
  }

  // Where a released cast lands for the equipped rod (same order of reads as before).
  resolveCastTarget(aim, release, bounds, equipment) {
    const canCastAnywhere =
      this.deps.services.devFlags.isEnabled("infiniteCasting");
    const maxDistance = this.getEffectiveCastDistance(equipment);
    const accuracyPx = this.getRodAccuracyPx(equipment);
    const accuracyPercent = this.getRodAccuracyPercent(equipment);
    const accuracyMultiplier = this.getRodAccuracyMultiplier(equipment);
    return aim.resolveTarget(release, {
      bounds,
      maxDistance,
      accuracyPx,
      accuracyPercent,
      accuracyMultiplier,
      canCastAnywhere,
      checkWater: (vx, vy) => this.deps.world.checkWater(vx, vy),
    });
  }
}
