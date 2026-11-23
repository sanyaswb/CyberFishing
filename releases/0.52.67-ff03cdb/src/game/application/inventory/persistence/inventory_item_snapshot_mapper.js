import { ItemFreshnessStatePolicy } from "../../../domain/items/freshness/item_freshness_state_policy.js";
import { ItemPercentStatePolicy } from "../../../domain/items/metrics/item_percent_state_policy.js";

/**
 * Persistence DTO boundary for inventory item instances.
 *
 * Item definitions and derived read-model data are intentionally excluded.
 * Only source facts required to restore an item instance may cross this
 * boundary.
 */
export class InventoryItemSnapshotMapper {
  static #optionalFactKeys = Object.freeze([
    "statOverrides",
    "rolledStats",
    "rarity",
    "recipe",
    "recipeVariant",
    "qualityGrade",
    "freshnessState",
    "chargeState",
    "conditionState",
    "upgradeState",
    "resourceState",
    "detachedLineSegment",
    "sourceLineItemId",
    "sourceLineInstanceId",
  ]);

  #definitionResolver;
  #overridePolicy;
  #freshnessStatePolicy;
  #freshnessCapabilityProvider;
  #chargeStatePolicy;
  #chargeCapabilityProvider;

  constructor({
    itemDefinitionResolver,
    overridePolicy,
    freshnessStatePolicy = new ItemFreshnessStatePolicy(),
    freshnessCapabilityProvider = null,
    chargeStatePolicy = new ItemPercentStatePolicy({ stateName: "chargeState" }),
    chargeCapabilityProvider = () => null,
  } = {}) {
    if (!itemDefinitionResolver) {
      throw new TypeError(
        "InventoryItemSnapshotMapper requires itemDefinitionResolver",
      );
    }
    if (!overridePolicy || typeof overridePolicy.normalize !== "function") {
      throw new TypeError(
        "InventoryItemSnapshotMapper requires ItemStatOverridePolicy",
      );
    }
    this.#definitionResolver = itemDefinitionResolver;
    this.#overridePolicy = overridePolicy;
    this.#freshnessStatePolicy = freshnessStatePolicy;
    // freshnessCapabilityProvider(definition): the item's freshness capability or null; composition injects it.
    this.#freshnessCapabilityProvider = freshnessCapabilityProvider;
    // chargeCapabilityProvider(definition): the battery's charge capability or null (spec 143); composition injects it.
    this.#chargeStatePolicy = chargeStatePolicy;
    this.#chargeCapabilityProvider = chargeCapabilityProvider;
  }

  toSnapshot(item) {
    this.#assertIdentity(item);
    const definition = this.#definition(item.itemId);
    if (!definition) {
      throw new RangeError(`Unknown item definition: ${item.itemId}`);
    }
    const snapshot = {
      instanceId: item.instanceId,
      itemId: item.itemId,
      quantity: this.#quantity(item.quantity),
      location: this.#location(item.location),
    };
    for (const key of InventoryItemSnapshotMapper.#optionalFactKeys) {
      if (!Object.prototype.hasOwnProperty.call(item, key)) continue;
      if (key === "statOverrides") {
        const overrides = this.#overridePolicy.normalize({
          definition,
          overrides: item.statOverrides || {},
        });
        if (Object.keys(overrides).length > 0) {
          snapshot.statOverrides = this.#clone(overrides);
        }
        continue;
      }
      if (key === "freshnessState") {
        if (!this.#freshnessCapabilityProvider(definition)) {
          throw new TypeError(
            `freshnessState is not supported by item ${item.itemId}`,
          );
        }
        const state = this.#freshnessStatePolicy.normalize(item[key], {
          omitDefault: true,
        });
        if (state) snapshot.freshnessState = this.#clone(state);
        continue;
      }
      if (key === "chargeState") {
        if (!this.#chargeCapabilityProvider(definition)) {
          throw new TypeError(`chargeState is not supported by item ${item.itemId}`);
        }
        const state = this.#chargeStatePolicy.normalize(item[key], { omitDefault: true });
        if (state) snapshot.chargeState = this.#clone(state);
        continue;
      }
      if (key === "rarity" && this.#matchesAuthoredRarity(item.rarity, definition)) {
        continue;
      }
      if (item[key] !== undefined) snapshot[key] = this.#clone(item[key]);
    }
    return snapshot;
  }

  toSnapshots(items = []) {
    if (!Array.isArray(items)) {
      throw new TypeError("Inventory item snapshot source must be an array");
    }
    return items.map((item) => this.toSnapshot(item));
  }

  #assertIdentity(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new TypeError("Inventory item snapshot requires an item object");
    }
    if (typeof item.instanceId !== "string" || item.instanceId.length === 0) {
      throw new TypeError("Inventory item snapshot requires instanceId");
    }
    if (typeof item.itemId !== "string" || item.itemId.length === 0) {
      throw new TypeError("Inventory item snapshot requires itemId");
    }
  }

  #quantity(value) {
    const quantity = Number(value ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new RangeError("Inventory item snapshot quantity must be positive");
    }
    return quantity;
  }

  #location(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError("Inventory item snapshot requires location");
    }
    return this.#clone(value);
  }

  #definition(itemId) {
    if (typeof this.#definitionResolver === "function") {
      return this.#definitionResolver(itemId) || null;
    }
    return (
      this.#definitionResolver?.getItemData?.(itemId) ||
      this.#definitionResolver?.get?.(itemId) ||
      null
    );
  }

  #matchesAuthoredRarity(rarity, definition) {
    const profile = definition?.rarityProfile;
    if (!profile || profile.mode !== "authored") return false;
    if (!rarity || typeof rarity !== "object" || Array.isArray(rarity)) {
      return false;
    }
    return (
      Number(rarity.tier) === Number(profile.tier) &&
      Number(rarity.maxTier) === Number(profile.maxTier) &&
      Boolean(rarity.isUnique) === Boolean(profile.isUnique) &&
      (rarity.uniqueId || null) === (profile.uniqueId || null)
    );
  }

  #clone(value) {
    if (Array.isArray(value)) return value.map((entry) => this.#clone(entry));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, this.#clone(entry)]),
    );
  }
}
