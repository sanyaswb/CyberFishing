// Spec 143: a battery's charge after a device consumed units from it. Charge only falls and never goes below 0; a
// battery without a positive capacity holds nothing.
export class DevicePowerPolicy {
  drain(percent, capacityUnits, units) {
    const current = Math.max(0, Math.min(100, Number(percent) || 0));
    const capacity = Number(capacityUnits);
    const consumed = Math.max(0, Number(units) || 0);
    if (!(capacity > 0)) return 0;
    return Math.max(0, current - (consumed / capacity) * 100);
  }

  // Units a battery at `percent` still holds.
  remainingUnits(percent, capacityUnits) {
    const capacity = Number(capacityUnits);
    if (!(capacity > 0)) return 0;
    return Math.max(0, Math.min(100, Number(percent) || 0)) / 100 * capacity;
  }
}
