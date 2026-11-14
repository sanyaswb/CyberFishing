export class BiteRules {
  constructor(baitRules) {
    this.baitRules = baitRules;
  }

  selectBiteSequence(fishTemplate, baitTypes) {
    if (!fishTemplate?.biteMechanics) return null;
    return this.baitRules.hasActiveLureType(baitTypes)
      ? fishTemplate.biteMechanics.active
      : fishTemplate.biteMechanics.passive;
  }
}
