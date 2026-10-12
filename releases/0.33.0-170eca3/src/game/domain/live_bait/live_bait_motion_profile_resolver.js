export class LiveBaitMotionProfileResolver {
  #fishById;
  constructor(fishDb) { this.#fishById = new Map(fishDb.map((fish) => [fish.id, fish])); }
  resolve(speciesId) {
    const physics = this.#fishById.get(speciesId)?.physics;
    const swim = physics?.behaviorProfile?.behaviors?.swim;
    if (!physics?.movementProfile || !swim) return null;
    return {
      movementProfile: physics.movementProfile,
      behaviorProfile: { behaviors: { swim } },
    };
  }
}
