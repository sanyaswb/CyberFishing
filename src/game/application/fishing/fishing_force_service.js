import { FightGroundPlane } from "./fight_ground_plane.js";

export class FishingForceService {
  #groundPlane = new FightGroundPlane();

  // The fight step runs on the ground plane of the location's water metric (see FightGroundPlane).
  applyForces(dt, context) {
    const {
      floatEntity,
      bounds,
      input,
      env,
      getRodVirtualPos,
      getBaseRodVirtualPos,
      rodControlCastAnchor,
      checkWater,
      waterMetric,
      rod,
      reel,
      fishForceSystem,
      lineSystem,
      dragSystem,
      pullInputMapper,
      rodPullSystem,
      rodControlSystem,
      reelSystem,
      tensionSystem,
      stressSystem,
      fightPhysicsSystem,
      fishCondition,
    } = context;
    const plane = this.#groundPlane.begin({
      metric: waterMetric,
      floatEntity,
      bounds,
      checkWater,
      rodTipPosition:
        getBaseRodVirtualPos?.(bounds) || getRodVirtualPos(bounds),
      actualRodTipPosition: getRodVirtualPos(bounds),
      rodControlCastAnchor,
    });
    try {
      return fightPhysicsSystem.step({
        dtMs: dt,
        floatEntity: plane.floatEntity,
        bounds: plane.bounds,
        input,
        env,
        checkWater: plane.checkWater,
        rodTipPosition: plane.rodTipPosition,
        actualRodTipPosition: plane.actualRodTipPosition,
        rodControlCastAnchor: plane.rodControlCastAnchor,
        rod,
        reel,
        fishForceSystem,
        lineSystem,
        dragSystem,
        pullInputMapper,
        rodPullSystem,
        rodControlSystem,
        reelSystem,
        tensionSystem,
        stressSystem,
        fishCondition,
      });
    } finally {
      this.#groundPlane.end();
    }
  }
}
