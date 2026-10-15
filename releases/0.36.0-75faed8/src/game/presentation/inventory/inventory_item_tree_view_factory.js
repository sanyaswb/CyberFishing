export class InventoryItemTreeViewFactory {
  #repository;
  #assemblyStates;
  #profileRegistry;
  #completionPolicy;
  #hydrate;
  #boatChargeProvider;

  constructor({
    repository,
    assemblyStates,
    profileRegistry,
    completionPolicy = null,
    hydrate,
    boatChargeProvider = null,
  } = {}) {
    this.#repository = repository;
    this.#assemblyStates = assemblyStates;
    this.#profileRegistry = profileRegistry;
    this.#completionPolicy = completionPolicy;
    this.#hydrate = hydrate;
    this.#boatChargeProvider = boatChargeProvider;
  }

  setBoatChargeProvider(provider) {
    this.#boatChargeProvider =
      typeof provider === "function" ? provider : null;
  }

  create(instanceId, { includeAttachments = true } = {}) {
    const raw = this.#repository.get(instanceId);
    if (!raw) return null;
    const item = this.#hydrateItem(raw);
    if (!item) return null;
    const state = this.#assemblyStates.get(instanceId);
    const assemblyCompletion = state
      ? this.#completionPolicy?.analyze?.(instanceId, {
          profileId: state.profileId,
        }) || null
      : null;
    const view = {
      ...item,
      instanceId: raw.instanceId,
      quantity: raw.quantity,
      status: state?.isDraft ? "draft" : state?.isPrepared ? "prepared" : null,
      prepared: state ? state.isPrepared : null,
      assemblyCompletion,
      loadoutMembership: this.#loadoutMembership(raw),
    };
    if (includeAttachments) {
      view.attachments = this.#createAttachmentSlots(raw, state?.profileId);
    }
    const reelLineCapacity = this.#createReelLineCapacity(view);
    if (reelLineCapacity) view.reelLineCapacity = reelLineCapacity;
    const charge = this.#createBoatCharge(view);
    if (charge) view.charge = charge;
    return view;
  }

  createLoadout(loadout) {
    const roots = Object.entries(loadout.getRootInstanceIds())
      .map(([slotId, id]) => ({ slotId, item: id ? this.create(id, { includeAttachments: false }) : null }))
      .filter((entry) => entry.item);
    const main = roots.find((entry) => entry.slotId === "rod") || roots[0];
    return {
      ...main?.item,
      instanceId: loadout.loadoutId,
      itemId: "equipment_loadout",
      itemType: "equipment_loadout",
      name: loadout.name,
      icon: main?.item.icon || "🎣",
      quantity: 1,
      loadoutId: loadout.loadoutId,
      prepared: true,
      attachments: roots.filter((entry) => entry !== main).map(({ slotId, item }) => ({
        instanceId: item.instanceId, name: item.name, icon: item.icon,
        iconUrl: item.iconUrl || item.imageUrl, rarity: item.rarity,
        kind: slotId, placement: "bottom", empty: false,
      })),
    };
  }

  #hydrateItem(raw) {
    if (typeof this.#hydrate === "function") {
      return this.#hydrate(raw) || null;
    }
    return { ...raw };
  }

  #loadoutMembership(raw) {
    let root = raw;
    while (root?.location?.kind === "ATTACHED") {
      root = this.#repository.get(root.location.parentInstanceId);
    }
    const id = root?.location?.loadoutId;
    if (!id) return null;
    let hash = 0;
    for (let index = 0; index < id.length; index++) {
      hash = (Math.imul(hash, 31) + id.charCodeAt(index)) >>> 0;
    }
    return { id, color: `hsl(${hash % 360} 70% 60%)` };
  }

  #createAttachmentSlots(root, profileId) {
    const badges = [];
    this.#appendAttachmentSlots(root, profileId, badges);
    return badges;
  }

  #appendAttachmentSlots(parent, profileId, badges) {
    const profile = this.#profileRegistry.resolveForItem(parent, profileId);
    for (const slot of profile?.slots || []) {
      if (slot.id === "bait") continue;
      const capacity = this.#profileRegistry.getSlotCapacity(parent, slot);
      for (let index = 0; index < capacity; index++) {
        const raw = this.#repository.getChild(parent.instanceId, slot.id, index);
        const hydrated = raw ? this.#hydrateItem(raw) || raw : null;
        badges.push({
          instanceId: raw?.instanceId || null,
          parentInstanceId: parent.instanceId,
          slotIndex: index,
          empty: !raw,
          name: hydrated?.name,
          icon: hydrated?.icon,
          iconUrl: hydrated?.iconUrl || hydrated?.imageUrl,
          rarity: hydrated?.rarity,
          kind: slot.id,
          placement: this.#placement(slot.id),
        });
        if (raw) this.#appendAttachmentSlots(raw, null, badges);
      }
    }
  }

  #createReelLineCapacity(item) {
    if (item.itemType !== "reel") return null;
    const rawLine = this.#repository.getChild(item.instanceId, "line", 0);
    if (!rawLine) return null;
    const line = this.#hydrateItem(rawLine);
    const maximum = Number(item.effectiveStats?.lineCapacityMeters);
    const remaining = line?.progression?.capacity?.available === true
      ? line.progression.capacity.current
      : line?.effectiveStats?.lengthMeters;
    if (remaining == null || !Number.isFinite(Number(remaining)) ||
        !Number.isFinite(maximum) || maximum <= 0) return null;
    const current = Math.max(0, Math.min(maximum, Number(remaining)));
    return {
      current,
      maximum,
      percent: current / maximum * 100,
      label: "Заповнення котушки",
    };
  }

  #placement(slotId) {
    if (slotId === "line") return "reel-line";
    if (slotId === "hook") return "hook";
    if (slotId === "cargo") return "boat-cargo";
    return "bottom";
  }

  #createBoatCharge(item) {
    if (
      !["boat", "chum_delivery"].includes(item?.itemType) ||
      !this.#boatChargeProvider
    ) {
      return null;
    }
    const reading = this.#boatChargeProvider(item);
    const current = Number(
      typeof reading === "number" ? reading : reading?.current,
    );
    const maximum = Number(
      reading?.maximum ?? item.effectiveStats?.maxEnergy,
    );
    if (!Number.isFinite(current)) return null;
    const percent = Number.isFinite(maximum) && maximum > 0
      ? (current / maximum) * 100
      : current;
    return {
      current,
      maximum: Number.isFinite(maximum) ? maximum : null,
      percent: Math.max(0, Math.min(100, percent)),
      label: `Заряд ${Math.round(Math.max(0, Math.min(100, percent)))}%`,
    };
  }
}
