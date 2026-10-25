// Spec 143 D-P1/D-P2/D-P6: the boat consumes power only in the water. Moving (out and back) at its authored rate times
// its level's factor, waiting at the spot at idleShare of that, idle (only equipped or aimed), drifting and
// finished at 0. Units per second.
export class BoatPowerRatePolicy {
  unitsPerSecond(boatState, stats) {
    const power = stats?.batteryUse || {};
    const moving = Math.max(0, Number(power.unitsPerSecond) || 0);
    const level = stats?.statsByLevel?.[stats?.upgradeLevel] || stats?.statsByLevel?.[1] || {};
    const factor = Number.isFinite(Number(level.powerFactor)) ? Math.max(0, Number(level.powerFactor)) : 1;
    const idleShare = Number.isFinite(Number(power.idleShare)) ? Math.max(0, Number(power.idleShare)) : 1;
    if (boatState === "deploying" || boatState === "returning") return moving * factor;
    if (boatState === "waiting") return moving * factor * idleShare;
    return 0;
  }
}
