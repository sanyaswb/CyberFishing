export class FishingForceService {
  #config;
  #upDirection = { x: 0, y: 1 };
  #forces = { pX: 0, pY: 0, fX: 0, fY: 0 };

  constructor(config) {
    this.#config = config;
  }

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
      buffs,
    } = context;
    return fightPhysicsSystem.step({
      dtMs: dt,
      floatEntity,
      bounds,
      input,
      env,
      checkWater,
      rodTipPosition:
        getBaseRodVirtualPos?.(bounds) || getRodVirtualPos(bounds),
      actualRodTipPosition: getRodVirtualPos(bounds),
      rodControlCastAnchor,
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
      buffs,
    });
  }
}
