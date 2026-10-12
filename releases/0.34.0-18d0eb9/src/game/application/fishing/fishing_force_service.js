import { GroundPlaneScope } from "../world/ground_plane_scope.js";

export class FishingForceService {
  #groundPlane = new GroundPlaneScope();

  // The fight step runs on the ground plane of the location's water metric (see GroundPlaneScope), so the line,
  // fish motion, rod and landing distances of every stage are ground metres.
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
    const groundPlane = this.#groundPlane;
    const rodTipPosition = getBaseRodVirtualPos?.(bounds) || getRodVirtualPos(bounds);
    const actualRodTipPosition = getRodVirtualPos(bounds);
    const plane = groundPlane.enter({ metric: waterMetric, entity: floatEntity, bounds, checkWater });
    try {
      return fightPhysicsSystem.step({
        dtMs: dt,
        floatEntity,
        bounds: plane.bounds,
        input,
        env,
        checkWater: plane.checkWater,
        rodTipPosition: groundPlane.point(0, rodTipPosition),
        actualRodTipPosition: groundPlane.point(1, actualRodTipPosition),
        rodControlCastAnchor: groundPlane.point(2, rodControlCastAnchor),
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
      groundPlane.exit();
    }
  }
}
