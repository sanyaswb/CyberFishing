import { ItemRadiationWearPolicy } from "../../domain/items/condition/item_radiation_wear_policy.js";
import { itemCondition } from "../../domain/items/condition/item_condition_quality.js";

// Spec 179 D10 (TK-370): the radiation's wear of every item with a condition the player has (backpack, assemblies,
// equipment — the whole inventory repository). The only writer of the radiation's condition loss; it never raises a
// condition and stops at 0 (broken). Runs inside the caller's inventory transaction.
export class ApplyItemWearService {
  #repository;
  #hydrator;
  #policy;

  constructor({ repository, hydrator, policy = new ItemRadiationWearPolicy() } = {}) {
    if (!repository?.update || !repository?.list) throw new TypeError("ApplyItemWearService requires repository");
    if (!hydrator?.hydrate) throw new TypeError("ApplyItemWearService requires hydrator");
    this.#repository = repository;
    this.#hydrator = hydrator;
    this.#policy = policy;
  }

  // exposure: the share of one average full emission (see ItemRadiationWearPolicy); rollFor(instanceId) → 0…1, the
  // item's roll for this emission; settings: CONFIG.emission.wear. Returns the number of items whose condition fell.
  apply(exposure, rollFor, settings) {
    if (!(exposure > 0)) return 0;
    let worn = 0;
    for (const raw of this.#repository.list()) {
      const item = this.#hydrator.hydrate(raw, this.#repository);
      const condition = itemCondition(item);
      if (condition === null || condition <= 0) continue;
      const stats = item.effectiveStats;
      const loss = this.#policy.loss({ quality: stats.baseQuality ?? stats.quality ?? 1,
        immunity: stats.radiationImmunity ?? 0, roll: rollFor(raw.instanceId), exposure }, settings);
      if (!(loss > 0)) continue;
      const next = Math.max(0, condition - loss);
      this.#repository.update(raw.instanceId, (source) => ({
        ...source,
        statOverrides: { ...(source.statOverrides || {}), durability: next },
      }));
      worn += 1;
    }
    return worn;
  }
}
