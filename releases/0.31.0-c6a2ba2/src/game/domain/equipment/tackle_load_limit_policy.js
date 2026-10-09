import { durabilityAdjustedMaxLoadKg } from "../items/condition/durability_max_load.js";

// The tackle holds at most the weakest effective load of the equipped rod, line and leader; durability loss
// lowers each item's limit. Returns 0 when none of them has a positive limit.
export class TackleLoadLimitPolicy {
  resolveMaxLoadKg(eq) {
    const values = [];

    const pushPositive = (value) => {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) values.push(n);
    };

    pushPositive(durabilityAdjustedMaxLoadKg(eq.rod, 0));
    pushPositive(durabilityAdjustedMaxLoadKg(eq.line, 0));
    pushPositive(durabilityAdjustedMaxLoadKg(eq.leader, 0));

    if (values.length === 0) return 0;
    return Math.min(...values);
  }
}
