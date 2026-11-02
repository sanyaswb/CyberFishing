export class LiveBaitMotionProfileResolver {
  #fishById;
  #commonSpeciesId;
  constructor(fishDb, commonSpeciesId = null) { this.#fishById = new Map(fishDb.map((fish) => [fish.id, fish])); this.#commonSpeciesId = commonSpeciesId; }
  resolve(speciesId) {
    const physics = this.#fishById.get(this.#commonSpeciesId || speciesId)?.physics;
    const swim = physics?.behaviorProfile?.behaviors?.swim;
    if (!physics?.movementProfile || !swim) return null;
    return {
      movementProfile: physics.movementProfile,
      behaviorProfile: { behaviors: { swim } },
    };
  }
}
