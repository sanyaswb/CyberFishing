class InventoryV2ItemViewFactory {
  #repository;
  #assemblyStates;
  #assemblyReader;
  #completionPolicy;
  #hydrate;
  #boatChargeProvider;

  constructor({
    repository,
    assemblyStates,
    assemblyReader,
    completionPolicy = null,
    hydrate,
    boatChargeProvider = null,
  } = {}) {
    this.#repository = repository;
    this.#assemblyStates = assemblyStates;
    this.#assemblyReader = assemblyReader;
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
    };
    if (includeAttachments && state) {
      view.attachments = this.#createAttachmentBadges(instanceId);
    }
    const charge = this.#createBoatCharge(view);
    if (charge) view.charge = charge;
    return view;
  }

  createLoadout(loadout) {
    return {
      instanceId: loadout.loadoutId,
      itemId: "equipment_loadout",
      type: "equipment_loadout",
      name: loadout.name,
      icon: "🧰",
      quantity: 1,
      loadoutId: loadout.loadoutId,
      prepared: true,
    };
  }

  #hydrateItem(raw) {
    if (typeof this.#hydrate === "function") {
      return this.#hydrate(raw) || null;
    }
    return { ...raw };
  }

  #createAttachmentBadges(rootInstanceId) {
    const badges = [];
    for (const entry of this.#repository.listDescendants(rootInstanceId)) {
      const raw = entry.item;
      const hydrated = this.#hydrateItem(raw) || raw;
      badges.push({
        instanceId: raw.instanceId,
        name: hydrated.name,
        icon: hydrated.icon,
        iconUrl: hydrated.iconUrl || hydrated.imageUrl,
        kind: raw.location.slotId,
        placement: this.#placement(raw.location.slotId),
      });
    }
    return badges;
  }

  #placement(slotId) {
    if (slotId === "line") return "reel-line";
    if (slotId === "hook") return "hook";
    if (slotId === "cargo") return "boat-cargo";
    return "bottom";
  }

  #createBoatCharge(item) {
    if (
      !["boat", "chum_delivery"].includes(item?.type) ||
      !this.#boatChargeProvider
    ) {
      return null;
    }
    const reading = this.#boatChargeProvider(item);
    const current = Number(
      typeof reading === "number" ? reading : reading?.current,
    );
    const maximum = Number(
      reading?.maximum ?? item.maxEnergy ?? item.engineStats?.maxEnergy,
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

globalThis.InventoryV2ItemViewFactory = InventoryV2ItemViewFactory;
