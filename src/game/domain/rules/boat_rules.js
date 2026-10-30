export class BoatRules {
  isManual(boatItem) {
    return boatItem?.effectiveStats?.manualControl ?? true;
  }

  // The one reading of a boat's bunker count (TK-156): its effective `sections`, the same property the cargo slot's
  // capacity reads (item_assembly_profiles capacityProperty). Anything but a positive integer means no bunkers.
  sectionCount(stats) {
    const count = Number(stats?.sections);
    return Number.isInteger(count) && count > 0 ? count : 0;
  }

  canPlayerCastWithBoat(boat, boatItem) {
    if (!boat) return true;
    if (boat.state === "drifting" || boat.state === "returning") return true;
    return !this.isManual(boatItem) && boat.remainingSections <= 0;
  }
}
