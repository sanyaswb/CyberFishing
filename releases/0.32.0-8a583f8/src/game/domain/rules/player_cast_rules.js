export class PlayerCastRules {
  constructor(boatRules, equipmentRules) {
    this.boatRules = boatRules;
    this.equipmentRules = equipmentRules;
  }

  canPlayerCast(equipment, activeBoat) {
    if (!equipment?.rod) return false;
    if (this.equipmentRules.requiresReel(equipment) && !equipment.reel) {
      return false;
    }
    if (!this.equipmentRules.hasEquippedLine(equipment)) {
      return false;
    }
    return this.boatRules.canPlayerCastWithBoat(
      activeBoat,
      equipment?.delivery || {},
    );
  }
}
