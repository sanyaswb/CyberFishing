import { AutoRefillScope } from "./auto_refill_scope.js";
import { AutoRefillSettings } from "./auto_refill_settings.js";
import { AutoRefillTrigger } from "./auto_refill_trigger.js";

export class AutoRefillPolicy {
  #settings;

  constructor({ settings = null } = {}) {
    this.#settings = settings || new AutoRefillSettings();
  }

  resolveScopes(trigger, context = {}) {
    if (trigger === AutoRefillTrigger.ROD_RETRIEVED) {
      const scopes = [];
      if (this.#settings.autoBait) scopes.push(AutoRefillScope.TACKLE_BAIT);
      if (this.#settings.autoChum) scopes.push(AutoRefillScope.TACKLE_CHUM);
      return Object.freeze(scopes);
    }
    if (trigger === AutoRefillTrigger.HAND_CHUM_USED) {
      return Object.freeze(
        this.#settings.autoChum ? [AutoRefillScope.HAND_CHUM] : [],
      );
    }
    if (trigger === AutoRefillTrigger.BOAT_RETURNED) {
      const allBaysEmptied =
        context.allBaysEmptied === true || context.allSectionsUsed === true;
      const returned =
        context.hasReturnedToPlayer === true || context.isAtPlayer === true;
      return Object.freeze(
        this.#settings.autoChum && allBaysEmptied && returned
          ? [AutoRefillScope.BOAT_CHUM]
          : [],
      );
    }
    return Object.freeze([]);
  }
}
