import { TackleLineReachConstraint } from "../../domain/fishing/tackle_line_reach_constraint.js";

export class GameState {
  #tackleLineReach = new TackleLineReachConstraint();
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

  // Called after every source of idle tackle motion and before leaving GroundPlaneScope. Casting, the depth HUD,
  // idle drift and FightSessionFactory all take their depth cost from EquipmentRules/CastDistanceCalculator.
  constrainTackleToLine(groundPlane, bounds, equipment) {
    if (!equipment?.line) return;
    const maxDistance = this.deps.rules.equipment.getMaxCastDistance(
      equipment, Infinity, this.getSelectedHookDepthMeters(),
    );
    const rod = groundPlane.point(1, this.deps.world.getRodVirtualPos(bounds));
    this.#tackleLineReach.apply(this.deps.float.getPosition(), this.deps.float.getVelocity(), rod, maxDistance);
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

  // One rule for aiming a rod cast, the first one (scouting) and a re-cast (waiting, G-068): while the cast is aimed
  // or flying, the frame shows the CAST bar, the aim line and the accuracy preview, never the rod, line or tackle
  // (spec 099 D3: no rod before the cast). Keyed on the aim's visual and the flight, so an aim lost without a release
  // never hides the tackle. Returns whether a rod cast is in progress.
  populateRodCast(target, bounds, aim, inFlight) {
    const visual = aim.getVisualState();
    if (!visual && !inFlight) return false;
    target.fishing.visible = false;
    if (!visual) return true;
    const eq = this.deps.inventory.getEquipped();
    const maxDistance = this.getEffectiveCastDistance(eq);
    if (this.deps.config.debug?.casting?.showAccuracyArea) {
      target.casting.accuracyPreview = aim.getAccuracyPreview(bounds, maxDistance, this.getRodAccuracyPx(eq),
        this.getRodAccuracyPercent(eq), this.getRodAccuracyMultiplier(eq));
    }
    target.casting.visible = true;
    target.casting.powerVisible = true;
    target.casting.visual = visual;
    target.casting.bounds = bounds;
    target.casting.maxDistance = maxDistance;
    target.casting.nowMs = this.deps.clock.now;
    return true;
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
