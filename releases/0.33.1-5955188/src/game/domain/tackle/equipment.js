export class Equipment {
  #equipmentPowerLevel;
  #basePower;

  constructor(equipmentPowerLevel, basePower) {
    this.#equipmentPowerLevel = equipmentPowerLevel;
    this.#basePower = basePower;
  }

  getPower() {
    return this.#equipmentPowerLevel + this.#basePower;
  }
}
