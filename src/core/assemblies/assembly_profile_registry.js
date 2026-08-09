class AssemblyProfileRegistry {
  #profiles = new Map();
  #profileIdByFallbackType = new Map();
  #itemDefinitionResolver;

  constructor(
    profileConfig = ITEM_ASSEMBLY_PROFILE_CONFIG,
    { itemDefinitionResolver = null } = {},
  ) {
    this.#itemDefinitionResolver = itemDefinitionResolver;
    const profiles = Array.isArray(profileConfig)
      ? profileConfig
      : Object.values(profileConfig || {});
    for (const profile of profiles) this.register(profile);
  }

  register(profile) {
    if (!profile || typeof profile !== "object") {
      throw new TypeError("Assembly profile must be an object");
    }
    if (typeof profile.id !== "string" || profile.id.length === 0) {
      throw new TypeError("Assembly profile requires id");
    }
    if (this.#profiles.has(profile.id)) {
      throw new RangeError(`Duplicate assembly profile: ${profile.id}`);
    }
    const normalized = Object.freeze({
      ...profile,
      fallbackTypes: Object.freeze([...(profile.fallbackTypes || [])]),
      slots: Object.freeze(
        (profile.slots || []).map((slot) => this.#normalizeSlot(slot)),
      ),
    });
    this.#profiles.set(normalized.id, normalized);
    for (const type of normalized.fallbackTypes) {
      if (!this.#profileIdByFallbackType.has(type)) {
        this.#profileIdByFallbackType.set(type, normalized.id);
      }
    }
    return normalized;
  }

  get(profileId) {
    return this.#profiles.get(profileId) || null;
  }

  require(profileId) {
    const profile = this.get(profileId);
    if (!profile) throw new RangeError(`Unknown assembly profile: ${profileId}`);
    return profile;
  }

  resolveProfileIdForItem(item, explicitProfileId = null) {
    const definition = this.#resolveDefinition(item);
    const requestedProfileId =
      explicitProfileId ||
      item?.assemblyProfileId ||
      item?.engineStats?.assemblyProfileId ||
      definition?.assemblyProfileId ||
      definition?.engineStats?.assemblyProfileId ||
      null;
    if (requestedProfileId) {
      this.require(requestedProfileId);
      return requestedProfileId;
    }

    for (const type of this.#itemTypes(item)) {
      const profileId = this.#profileIdByFallbackType.get(type);
      if (profileId) return profileId;
    }
    return null;
  }

  resolveForItem(item, explicitProfileId = null) {
    const profileId = this.resolveProfileIdForItem(item, explicitProfileId);
    return profileId ? this.require(profileId) : null;
  }

  resolveSlot(parentItem, slotId, explicitProfileId = null) {
    const profile = this.resolveForItem(parentItem, explicitProfileId);
    if (!profile) return null;
    return profile.slots.find((slot) => slot.id === slotId) || null;
  }

  getSlotCapacity(parentItem, slotDefinition) {
    if (!slotDefinition) return 0;
    if (slotDefinition.enabledProperty) {
      const enabled = this.#readItemProperty(
        parentItem,
        slotDefinition.enabledProperty,
      );
      if (enabled === false || enabled === 0) return 0;
    }
    const configured = slotDefinition.capacityProperty
      ? this.#readItemProperty(parentItem, slotDefinition.capacityProperty)
      : null;
    const capacity = Number(configured ?? slotDefinition.capacity ?? 1);
    return Number.isInteger(capacity) && capacity >= 0 ? capacity : 0;
  }

  accepts(slotDefinition, item) {
    if (!slotDefinition || !item) return false;
    const acceptedItemIds = slotDefinition.acceptedItemIds || [];
    if (acceptedItemIds.includes(item.itemId)) return true;
    const acceptedTypes = slotDefinition.acceptedTypes || [];
    if (acceptedTypes.length === 0 && acceptedItemIds.length === 0) return true;
    return this.#itemTypes(item).some((type) => acceptedTypes.includes(type));
  }

  #normalizeSlot(slot) {
    if (!slot || typeof slot.id !== "string" || slot.id.length === 0) {
      throw new TypeError("Assembly slot requires id");
    }
    const capacity = Number(slot.capacity ?? 1);
    if (!Number.isInteger(capacity) || capacity < 0) {
      throw new RangeError(`Invalid capacity for assembly slot ${slot.id}`);
    }
    return Object.freeze({
      ...slot,
      capacity,
      acceptedTypes: Object.freeze([...(slot.acceptedTypes || [])]),
      acceptedItemIds: Object.freeze([...(slot.acceptedItemIds || [])]),
      refillable: slot.refillable === true,
    });
  }

  #itemTypes(item) {
    const definition = this.#resolveDefinition(item);
    return [
      item?.type,
      item?.category,
      item?.kind,
      item?.engineStats?.type,
      definition?.type,
      definition?.engineStats?.type,
    ].filter((value, index, values) =>
      typeof value === "string" && value.length > 0 && values.indexOf(value) === index,
    );
  }

  #readItemProperty(item, propertyName) {
    const definition = this.#resolveDefinition(item);
    if (Object.prototype.hasOwnProperty.call(item || {}, propertyName)) {
      return item[propertyName];
    }
    if (Object.prototype.hasOwnProperty.call(item?.engineStats || {}, propertyName)) {
      return item.engineStats[propertyName];
    }
    if (Object.prototype.hasOwnProperty.call(definition || {}, propertyName)) {
      return definition[propertyName];
    }
    return definition?.engineStats?.[propertyName];
  }

  #resolveDefinition(item) {
    if (item?.definition) return item.definition;
    if (typeof this.#itemDefinitionResolver === "function") {
      return this.#itemDefinitionResolver(item?.itemId) || null;
    }
    return (
      this.#itemDefinitionResolver?.getItemData?.(item?.itemId) ||
      this.#itemDefinitionResolver?.get?.(item?.itemId) ||
      null
    );
  }
}
