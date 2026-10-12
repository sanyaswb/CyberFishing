export class BoatRules {
  isManual(boatItem) {
    return boatItem?.effectiveStats?.manualControl ?? true;
  }

  canPlayerCastWithBoat(boat, boatItem) {
    if (!boat) return true;
    if (boat.state === "drifting" || boat.state === "returning") return true;
    return !this.isManual(boatItem) && boat.remainingSections <= 0;
  }
}
