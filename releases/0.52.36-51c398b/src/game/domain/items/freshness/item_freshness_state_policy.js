import { ItemPercentStatePolicy } from "../metrics/item_percent_state_policy.js";

// The bait's freshnessState fact: the shared percent state rule under the freshness key.
export class ItemFreshnessStatePolicy extends ItemPercentStatePolicy {
  constructor({ minimum = 0, maximum = 100, defaultPercent = 100 } = {}) {
    super({ stateName: "freshnessState", minimum, maximum, defaultPercent });
  }
}
