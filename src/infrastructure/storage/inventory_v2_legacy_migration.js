class InventoryV2LegacyMigration {
  static #legacyItemIdMap = Object.freeze({
    line_test_25m: "line_test_1",
    line_test_10m: "line_test_2",
    line_test_50m: "line_test_3",
  });
  static #removedLegacyItemIds = new Set(["sinker_light"]);

  #itemDefinitionResolver;
  #instanceIdFactory;
  #legacyItemsById = new Map();
  #itemStateMigration;
  #effectiveStatsResolver;

  constructor({
    itemDefinitionResolver,
    instanceIdFactory = null,
    itemStateMigration = new LegacyItemStateMigration(),
    effectiveStatsResolver = new EffectiveItemStatsResolver(),
  } = {}) {
    this.#itemDefinitionResolver = itemDefinitionResolver;
    this.#instanceIdFactory = instanceIdFactory;
    this.#itemStateMigration = itemStateMigration;
    this.#effectiveStatsResolver = effectiveStatsResolver;
  }

  migrate({ legacyItems = [], legacyEquipment = {}, settings = {} } = {}) {
    const warnings = [];
    const normalizedLegacy = this.#normalizeLegacyItems(
      legacyItems,
      legacyEquipment,
      warnings,
    );
    const normalizedEquipment = this.#normalizeLegacyEquipment(
      legacyEquipment,
      normalizedLegacy,
      warnings,
    );
    this.#legacyItemsById = new Map(
      normalizedLegacy.map((item) => [item.instanceId, item]),
    );
    const buildMetadata = this.#collectBuildMetadata(normalizedLegacy);
    const repositoryItems = normalizedLegacy
      .filter((item) => !this.#isBuildBox(item))
      .map((item) => this.#toRepositoryItem(item));

    const repository = new FlatInventoryItemRepository({
      items: repositoryItems,
      instanceIdFactory: this.#instanceIdFactory,
    });
    const assemblyStates = new AssemblyStateRepository();
    const profileRegistry = new AssemblyProfileRegistry(
      ITEM_ASSEMBLY_PROFILE_CONFIG,
      { itemDefinitionResolver: this.#itemDefinitionResolver },
    );
    const assemblyReader = new ItemAssemblyReader({
      repository,
      stateRepository: assemblyStates,
      profileRegistry,
    });
    const assemblyService = new ItemAssemblyService({
      repository,
      stateRepository: assemblyStates,
      profileRegistry,
      reader: assemblyReader,
    });
    const allocator = new LegacyInventoryUnitAllocator({ repository });
    const loadouts = new EquipmentLoadoutRepository();
    const context = {
      repository,
      assemblyStates,
      profileRegistry,
      assemblyReader,
      assemblyService,
      allocator,
      loadouts,
      warnings,
      legacyEquipment: normalizedEquipment,
      activeClaims: new Set(),
      conservationBaseline: repositoryItems.map((item) =>
        JSON.parse(JSON.stringify(item)),
      ),
    };

    for (const build of buildMetadata.values()) {
      this.#migrateBuild(context, build);
    }
    const equipment = this.#migrateEquipment(context);
    this.#validate(context, equipment);
    const handChum = repository.get(
      equipment.getRootInstanceId("handChum"),
    );
    const refillMemory = handChum
      ? {
          handChum: new ExactAssemblyRefillSignaturePolicy().create(handChum),
        }
      : {};

    return Object.freeze({
      snapshot: {
        schemaVersion: INVENTORY_V2_SCHEMA_VERSION,
        items: repository.toSnapshot(),
        assemblies: assemblyStates.toSnapshot(),
        equipment: equipment.snapshot(),
        loadouts: loadouts.toSnapshot(),
        settings: {
          autoBait: settings.autoBait === true,
          autoChum: settings.autoChum === true,
          refillMemory,
        },
      },
      warnings: Object.freeze([...warnings]),
    });
  }

  #normalizeLegacyItems(items, equipment, warnings) {
    const deduplicated = new Map();
    for (const source of items || []) {
      if (!source?.instanceId || !source?.itemId) continue;
      const itemId =
        InventoryV2LegacyMigration.#legacyItemIdMap[source.itemId] ||
        source.itemId;
      if (InventoryV2LegacyMigration.#removedLegacyItemIds.has(itemId)) {
        warnings.push(
          `Deprecated inventory item ${source.instanceId} (${itemId}) was removed during migration.`,
        );
        continue;
      }
      const quantity = Number(source.quantity ?? 1);
      if (!Number.isInteger(quantity) || quantity < 1) {
        warnings.push(`Пропущено пошкоджений стек ${source.instanceId}.`);
        continue;
      }
      deduplicated.set(source.instanceId, { ...source, itemId, quantity });
    }

    const activeLineId = equipment?.lineId || null;
    for (const item of [...deduplicated.values()]) {
      if (!item.detachedLineSegment) continue;
      const source = deduplicated.get(item.sourceLineInstanceId);
      const sameBuild = (source?.buildId || null) === (item.buildId || null);
      if (
        item.instanceId !== activeLineId &&
        source &&
        sameBuild &&
        this.#hasSameLegacyLineSignature(source, item)
      ) {
        const sourceLength = Number(source.lengthMeters);
        const segmentLength = Number(item.lengthMeters);
        if (Number.isFinite(sourceLength) && Number.isFinite(segmentLength)) {
          source.lengthMeters =
            Math.max(0, sourceLength) + Math.max(0, segmentLength);
          deduplicated.delete(item.instanceId);
          continue;
        }
        warnings.push(
          `Detached line ${item.instanceId} was kept separate because its saved length is incomplete.`,
        );
      } else if (item.instanceId !== activeLineId && source) {
        warnings.push(
          `Detached line ${item.instanceId} was kept separate because its source signature changed.`,
        );
      }
      delete item.detachedLineSegment;
      delete item.sourceLineItemId;
      delete item.sourceLineInstanceId;
    }
    return [...deduplicated.values()];
  }

  #normalizeLegacyEquipment(equipment, items, warnings) {
    const normalized = { ...(equipment || {}) };
    if (!normalized.feederRigId && normalized.sinkerId) {
      const item = items.find(
        (candidate) => candidate.instanceId === normalized.sinkerId,
      );
      const type = this.#typeFromLegacyItem(item);
      if (["feeder_rig", "spring", "feeder_tackle"].includes(type)) {
        normalized.feederRigId = normalized.sinkerId;
      } else {
        warnings.push(
          `Legacy sinker slot ${normalized.sinkerId} could not be mapped to a feeder rig.`,
        );
      }
    }
    delete normalized.sinkerId;
    return normalized;
  }

  #hasSameLegacyLineSignature(left, right) {
    if (!left || !right || left.itemId !== right.itemId) return false;
    const ignoredKeys = new Set([
      "instanceId",
      "quantity",
      "lengthMeters",
      "buildId",
      "location",
      "detachedLineSegment",
      "sourceLineItemId",
      "sourceLineInstanceId",
    ]);
    const signature = (item) => {
      const payload = {};
      for (const key of Object.keys(item).sort()) {
        if (!ignoredKeys.has(key) && item[key] !== undefined) {
          payload[key] = item[key];
        }
      }
      return this.#stableSerialize(payload);
    };
    return signature(left) === signature(right);
  }

  #typeFromLegacyItem(item) {
    if (!item) return null;
    const definition = this.#definition(item.itemId) || {};
    return (
      item.variant ??
      item.type ??
      item.itemType ??
      definition.variant ??
      definition.itemType ??
      null
    );
  }

  #collectBuildMetadata(items) {
    const builds = new Map();
    for (const item of items) {
      if (this.#isBuildBox(item)) {
        const loadoutId = item.instanceId;
        builds.set(loadoutId, {
          loadoutId,
          name: item.buildName || "Імпортований комплект",
          legacyInstanceIds: [],
        });
      }
    }
    for (const item of items) {
      if (!item.buildId || this.#isBuildBox(item)) continue;
      if (!builds.has(item.buildId)) {
        builds.set(item.buildId, {
          loadoutId: item.buildId,
          name: "Відновлений комплект",
          legacyInstanceIds: [],
        });
      }
      builds.get(item.buildId).legacyInstanceIds.push(item.instanceId);
    }
    return builds;
  }

  #toRepositoryItem(source) {
    const definition = this.#definition(source.itemId) || {};
    const item = this.#itemStateMigration.migrate(source, definition);
    delete item.buildId;
    delete item.buildName;
    delete item.detachedLineSegment;
    delete item.sourceLineItemId;
    delete item.sourceLineInstanceId;
    item.location = InventoryItemLocation.inventory();
    return item;
  }

  #migrateBuild(context, build) {
    const ids = [...new Set(build.legacyInstanceIds)].filter((instanceId) =>
      context.repository.has(instanceId),
    );
    const equipment = context.legacyEquipment;
    const rodLegacyId = this.#pickLegacyId(
      ids,
      (type) => ["spinning", "feeder", "float", "pole", "match", "bolognese"].includes(type),
      equipment.rodId,
    );
    const rodInstanceId = this.#allocate(context, rodLegacyId);
    const rod = this.#view(context, rodInstanceId);
    const capabilities = new RodCapabilityResolver().resolve(rod);

    const reelLegacyId = capabilities.supportsReel
      ? this.#pickLegacyId(ids, (type) => type === "spinning_reel", equipment.reelId)
      : null;
    const reelInstanceId = this.#allocate(context, reelLegacyId);
    if (reelInstanceId) this.#ensurePreparedAssembly(context, reelInstanceId);

    const fishingLineLegacyId = this.#pickLegacyId(
      ids,
      (type) => type === "fishing_line",
      equipment.lineId,
    );
    const leaderLegacyId = this.#pickLegacyId(
      ids,
      (type) => type === "leader_line",
      equipment.leaderId,
    );
    let terminalLineInstanceId = null;
    if (capabilities.supportsReel) {
      if (reelInstanceId) {
        const lineInstanceId = this.#allocate(context, fishingLineLegacyId);
        this.#attachIfPossible(context, {
          rootInstanceId: reelInstanceId,
          sourceInstanceId: lineInstanceId,
          slotId: "line",
          slotIndex: 0,
        });
      }
      terminalLineInstanceId = this.#allocate(context, leaderLegacyId);
    } else {
      terminalLineInstanceId = this.#allocate(context, fishingLineLegacyId);
    }

    const tackleLegacyId = this.#pickTackleLegacyId(
      context,
      ids,
      rod,
      equipment,
    );
    const tackleInstanceId = this.#allocate(context, tackleLegacyId);
    if (tackleInstanceId) {
      this.#migrateTackleChildren(context, {
        rootInstanceId: tackleInstanceId,
        ids,
        active: false,
      });
    }

    const floatLegacyId = capabilities.supportsFloat
      ? this.#pickLegacyId(
          ids,
          (type) => ["float_tackle", "day", "night"].includes(type),
          equipment.floatId,
        )
      : null;
    const floatInstanceId = this.#allocate(context, floatLegacyId);
    const roots = {
      rod: rodInstanceId,
      reel: reelInstanceId,
      terminalLine: terminalLineInstanceId,
      tackle: tackleInstanceId,
      float: floatInstanceId,
    };

    if (!Object.values(roots).some(Boolean)) {
      context.warnings.push(`Порожній комплект ${build.name} було пропущено.`);
      return;
    }
    const loadout = context.loadouts.add({
      loadoutId: build.loadoutId,
      name: build.name,
      rootInstanceIds: roots,
    });
    for (const [slotId, instanceId] of Object.entries(roots)) {
      if (!instanceId) continue;
      context.repository.setLocation(
        instanceId,
        InventoryItemLocation.loadout(loadout.loadoutId, slotId),
      );
    }
  }

  #migrateEquipment(context) {
    const legacy = context.legacyEquipment;
    const rootIds = {
      rod: this.#resolveActiveRoot(context, legacy.rodId, "rod"),
      reel: null,
      terminalLine: null,
      tackle: null,
      float: null,
      handChum: this.#resolveActiveRoot(
        context,
        legacy.handChumId,
        "handChum",
      ),
      net: null,
      delivery: null,
      gasMask: null,
    };
    const rod = this.#view(context, rootIds.rod);
    const capabilities = new RodCapabilityResolver().resolve(rod);

    if (capabilities.supportsReel) {
      rootIds.reel = this.#resolveActiveRoot(context, legacy.reelId, "reel");
      if (rootIds.reel) {
        this.#ensurePreparedAssembly(context, rootIds.reel);
        const lineId = this.#resolveActiveComponent(context, legacy.lineId, {
          parentInstanceId: rootIds.reel,
          slotId: "line",
          slotIndex: 0,
          occurrenceIndex: 0,
        });
        this.#attachIfPossible(context, {
          rootInstanceId: rootIds.reel,
          sourceInstanceId: lineId,
          slotId: "line",
          slotIndex: 0,
          activeOverride: true,
        });
      }
      rootIds.terminalLine = this.#resolveActiveRoot(
        context,
        legacy.leaderId,
        "terminalLine",
      );
    } else {
      rootIds.terminalLine = this.#resolveActiveRoot(
        context,
        legacy.lineId,
        "terminalLine",
      );
    }

    const tackleSelection = this.#selectActiveTackle(context, legacy, rod);
    rootIds.tackle = this.#resolveActiveRoot(
      context,
      tackleSelection.legacyId,
      "tackle",
    );
    if (rootIds.tackle) {
      this.#migrateTackleChildren(context, {
        rootInstanceId: rootIds.tackle,
        hookLegacyIds: legacy.hooks || [],
        baitLegacyIds: legacy.baits || [],
        chumLegacyId: legacy.feederChumId,
        selectedHookIndex: tackleSelection.hookIndex,
        active: true,
      });
    }

    rootIds.float = capabilities.supportsFloat
      ? this.#resolveActiveRoot(context, legacy.floatId, "float")
      : null;
    rootIds.net = this.#resolveActiveRoot(context, legacy.netId, "net");
    rootIds.delivery = this.#resolveActiveRoot(
      context,
      legacy.deliveryId,
      "delivery",
    );
    if (rootIds.delivery) {
      this.#ensurePreparedAssembly(context, rootIds.delivery);
      const cargoIds = legacy.deliveryChums || [];
      for (let index = 0; index < cargoIds.length; index += 1) {
        const sourceInstanceId = this.#resolveActiveComponent(
          context,
          cargoIds[index],
          {
            parentInstanceId: rootIds.delivery,
            slotId: "cargo",
            slotIndex: index,
            occurrenceIndex: this.#occurrenceIndex(cargoIds, index),
          },
        );
        this.#attachIfPossible(context, {
          rootInstanceId: rootIds.delivery,
          sourceInstanceId,
          slotId: "cargo",
          slotIndex: index,
          activeOverride: true,
        });
      }
    }
    return new EquipmentState(rootIds);
  }

  #migrateTackleChildren(
    context,
    {
      rootInstanceId,
      ids = [],
      hookLegacyIds = null,
      baitLegacyIds = null,
      chumLegacyId = null,
      selectedHookIndex = 0,
      active,
    },
  ) {
    const tackle = this.#view(context, rootInstanceId);
    const type = this.#type(tackle);
    if (type === "hook") {
      this.#ensurePreparedAssembly(context, rootInstanceId);
      const candidateBaits = baitLegacyIds || this.#idsByTypes(ids, ["bait"]);
      const activeBaitCandidate = Array.isArray(candidateBaits)
        ? candidateBaits[selectedHookIndex] || null
        : null;
      let baitLegacyId = null;
      if (
        active &&
        this.#typeByLegacyId(context, activeBaitCandidate) === "bait"
      ) {
        baitLegacyId = activeBaitCandidate;
      } else if (!active && Array.isArray(candidateBaits)) {
        baitLegacyId =
          candidateBaits.find(
            (id) => this.#typeByLegacyId(context, id) === "bait",
          ) || null;
      }
      const baitId = active
        ? this.#resolveActiveComponent(context, baitLegacyId, {
            parentInstanceId: rootInstanceId,
            slotId: "bait",
            slotIndex: 0,
            occurrenceIndex: this.#occurrenceIndex(
              candidateBaits,
              selectedHookIndex,
            ),
          })
        : this.#allocate(context, baitLegacyId);
      this.#attachIfPossible(context, {
        rootInstanceId,
        sourceInstanceId: baitId,
        slotId: "bait",
        slotIndex: 0,
        activeOverride: active,
      });
      return;
    }
    if (!["feeder_rig", "spring", "feeder_tackle"].includes(type)) return;

    this.#ensurePreparedAssembly(context, rootInstanceId);
    const hookCapacity = context.assemblyReader.getSlotCapacity(
      rootInstanceId,
      "hook",
    );
    const hooks = hookLegacyIds || this.#idsByTypes(ids, ["hook"]);
    const baits = baitLegacyIds || this.#idsByTypes(ids, ["bait"]);
    const attachedHooks = [];
    for (let index = 0; index < hookCapacity; index += 1) {
      const legacyHookId = Array.isArray(hooks)
        ? active
          ? hooks[index] || null
          : hooks[index] || hooks[0] || null
        : null;
      const occurrence = this.#occurrenceIndex(hooks, index);
      const hookInstanceId = active
        ? this.#resolveActiveComponent(context, legacyHookId, {
            parentInstanceId: rootInstanceId,
            slotId: "hook",
            slotIndex: index,
            occurrenceIndex: occurrence,
          })
        : this.#allocateFromCandidates(context, hooks);
      if (!hookInstanceId) continue;
      const attached = this.#attachIfPossible(context, {
        rootInstanceId,
        sourceInstanceId: hookInstanceId,
        slotId: "hook",
        slotIndex: index,
        activeOverride: active,
      });
      if (attached) attachedHooks[index] = hookInstanceId;
    }
    for (let index = 0; index < attachedHooks.length; index += 1) {
      const parentInstanceId = attachedHooks[index];
      if (!parentInstanceId) continue;
      const legacyBaitId = Array.isArray(baits) ? baits[index] || null : null;
      const baitInstanceId = active
        ? this.#resolveActiveComponent(context, legacyBaitId, {
            parentInstanceId,
            slotId: "bait",
            slotIndex: 0,
            occurrenceIndex: this.#occurrenceIndex(baits, index),
          })
        : this.#allocateFromCandidates(context, baits);
      this.#attachIfPossible(context, {
        rootInstanceId,
        parentInstanceId,
        sourceInstanceId: baitInstanceId,
        slotId: "bait",
        slotIndex: 0,
        activeOverride: active,
      });
    }

    const chumCandidate =
      chumLegacyId || this.#idsByTypes(ids, ["chum_mix"])[0] || null;
    const chumInstanceId = active
      ? this.#resolveActiveComponent(context, chumCandidate, {
          parentInstanceId: rootInstanceId,
          slotId: "chum",
          slotIndex: 0,
          occurrenceIndex: 0,
        })
      : this.#allocate(context, chumCandidate);
    this.#attachIfPossible(context, {
      rootInstanceId,
      sourceInstanceId: chumInstanceId,
      slotId: "chum",
      slotIndex: 0,
      activeOverride: active,
    });
  }

  #ensurePreparedAssembly(context, rootInstanceId) {
    if (!rootInstanceId) return null;
    if (!context.assemblyStates.has(rootInstanceId)) {
      const root = context.repository.require(rootInstanceId);
      const previousLocation = root.location;
      if (!InventoryItemLocation.isInventory(previousLocation)) {
        context.repository.setLocation(
          rootInstanceId,
          InventoryItemLocation.inventory(),
        );
      }
      context.assemblyService.startAssembly(rootInstanceId);
      if (!InventoryItemLocation.isInventory(previousLocation)) {
        context.repository.setLocation(rootInstanceId, previousLocation);
      }
    }
    context.assemblyService.prepare(rootInstanceId);
    return rootInstanceId;
  }

  #attachIfPossible(
    context,
    {
      rootInstanceId,
      parentInstanceId = rootInstanceId,
      sourceInstanceId,
      slotId,
      slotIndex,
      activeOverride = false,
    },
  ) {
    if (!rootInstanceId || !parentInstanceId || !sourceInstanceId) return false;
    const occupied = context.repository.getChild(
      parentInstanceId,
      slotId,
      slotIndex,
    );
    if (occupied?.instanceId === sourceInstanceId) return true;
    if (activeOverride) {
      this.#releaseUnitForActiveAttachment(context, sourceInstanceId);
    }
    const source = context.repository.get(sourceInstanceId);
    if (!source) return false;
    if (occupied && !activeOverride) return false;
    if (InventoryItemLocation.isAttached(source.location)) {
      context.warnings.push(
        `Компонент ${sourceInstanceId} уже належить іншій оснастці; дублювання пропущено.`,
      );
      return false;
    }
    if (!InventoryItemLocation.isInventory(source.location)) return false;
    try {
      if (occupied) {
        context.assemblyService.replace({
          rootInstanceId,
          parentInstanceId,
          sourceInstanceId,
          slotId,
          slotIndex,
        });
      } else {
        context.assemblyService.attach({
          rootInstanceId,
          parentInstanceId,
          sourceInstanceId,
          slotId,
          slotIndex,
        });
      }
      return true;
    } catch (error) {
      context.warnings.push(error.message);
      return false;
    }
  }

  #pickTackleLegacyId(context, ids, rod, equipment) {
    const capabilities = new RodCapabilityResolver().resolve(rod);
    if (capabilities.supportsFeederRig) {
      return this.#pickLegacyId(
        ids,
        (type) => ["feeder_rig", "spring", "feeder_tackle"].includes(type),
        equipment.feederRigId,
      );
    }
    if (capabilities.supportsLures) {
      const preferred = this.#firstLegacyArrayItemByType(
        equipment.baits,
        ["lure", "spinner", "wobbler", "jig"],
        context,
      );
      return this.#pickLegacyId(
        ids,
        (type) => ["lure", "spinner", "wobbler", "jig"].includes(type),
        preferred,
      );
    }
    return this.#pickLegacyId(ids, (type) => type === "hook", equipment.hooks?.[0]);
  }

  #selectActiveTackle(context, legacy, rod) {
    const capabilities = new RodCapabilityResolver().resolve(rod);
    if (capabilities.supportsFeederRig) {
      const type = this.#legacyType(legacy.feederRigId);
      if (["feeder_rig", "spring", "feeder_tackle"].includes(type)) {
        return { legacyId: legacy.feederRigId, hookIndex: 0 };
      }
      return { legacyId: null, hookIndex: 0 };
    }

    if (capabilities.supportsLures) {
      return {
        legacyId: this.#firstLegacyArrayItemByType(
          legacy.baits,
          ["lure", "spinner", "wobbler", "jig"],
          context,
        ),
        hookIndex: 0,
      };
    }

    if (capabilities.supportsFloat) {
      const hooks = legacy.hooks || [];
      const hookIndex = hooks.findIndex(
        (legacyId) => this.#legacyType(legacyId) === "hook",
      );
      return {
        legacyId: hookIndex >= 0 ? hooks[hookIndex] : null,
        hookIndex: Math.max(0, hookIndex),
      };
    }

    return { legacyId: null, hookIndex: 0 };
  }

  #pickLegacyId(ids, predicate, preferredId = null) {
    if (preferredId && ids.includes(preferredId)) {
      const type = this.#legacyType(preferredId);
      if (predicate(type)) return preferredId;
    }
    return ids.find((instanceId) => predicate(this.#legacyType(instanceId))) || null;
  }

  #idsByTypes(ids, types) {
    return (ids || []).filter((instanceId) =>
      types.includes(this.#legacyType(instanceId)),
    );
  }

  #allocateFromCandidates(context, legacyIds) {
    for (const legacyId of [...new Set(legacyIds || [])]) {
      const allocated = this.#allocate(context, legacyId);
      if (allocated) return allocated;
    }
    return null;
  }

  #allocate(context, legacyId) {
    return legacyId ? context.allocator.allocate(legacyId) : null;
  }

  #resolveActiveRoot(context, legacyId, slotId) {
    if (!legacyId) return null;
    if (!this.#legacyItemsById.has(legacyId)) {
      context.warnings.push(
        `Active ${slotId} reference ${legacyId} is missing from legacy inventory.`,
      );
      return null;
    }
    if (!this.#isAcceptedInEquipmentSlot(legacyId, slotId)) {
      context.warnings.push(
        `Active item ${legacyId} is incompatible with equipment slot ${slotId}.`,
      );
      return null;
    }

    const allocations = context.allocator.getAllocations(legacyId);
    let instanceId = allocations.find((candidateId) => {
      if (context.activeClaims.has(candidateId)) return false;
      const location = context.repository.get(candidateId)?.location;
      return (
        InventoryItemLocation.isLoadout(location) &&
        location.slotId === slotId
      );
    });
    instanceId = instanceId || context.allocator.allocate(legacyId);
    instanceId =
      instanceId ||
      allocations.find((candidateId) => !context.activeClaims.has(candidateId));
    if (!instanceId) {
      context.warnings.push(
        `Not enough units of ${legacyId} to restore active slot ${slotId}.`,
      );
      return null;
    }

    this.#releaseUnitForActiveRoot(context, instanceId, slotId);
    context.activeClaims.add(instanceId);
    return instanceId;
  }

  #resolveActiveComponent(
    context,
    legacyId,
    {
      parentInstanceId,
      slotId,
      slotIndex = 0,
      occurrenceIndex = 0,
    } = {},
  ) {
    if (!legacyId) return null;
    if (!this.#legacyItemsById.has(legacyId)) {
      context.warnings.push(
        `Active ${slotId} reference ${legacyId} is missing from legacy inventory.`,
      );
      return null;
    }
    const allocations = context.allocator.getAllocations(legacyId);
    const desiredChild = context.repository.getChild(
      parentInstanceId,
      slotId,
      slotIndex,
    );
    if (
      desiredChild &&
      allocations.includes(desiredChild.instanceId) &&
      !context.activeClaims.has(desiredChild.instanceId)
    ) {
      context.activeClaims.add(desiredChild.instanceId);
      return desiredChild.instanceId;
    }

    let instanceId = context.allocator.allocate(legacyId);
    if (!instanceId) {
      const available = allocations.filter(
        (candidateId) => !context.activeClaims.has(candidateId),
      );
      instanceId = available[occurrenceIndex] || available[0] || null;
    }
    if (!instanceId) {
      context.warnings.push(
        `Not enough units of ${legacyId} to restore ${slotId}[${slotIndex}].`,
      );
      return null;
    }
    context.activeClaims.add(instanceId);
    return instanceId;
  }

  #isAcceptedInEquipmentSlot(legacyId, slotId) {
    const acceptedTypes = EQUIPMENT_SLOT_CONFIG?.[slotId]?.acceptTypes || [];
    return (
      acceptedTypes.length === 0 ||
      acceptedTypes.includes(this.#itemTypeByLegacyId(legacyId))
    );
  }

  #itemTypeByLegacyId(instanceId) {
    const item = this.#legacyItemsById.get(instanceId);
    const definition = this.#definition(item?.itemId) || {};
    return (
      item?.itemType ??
      definition.itemType ??
      item?.type ??
      definition.type ??
      null
    );
  }

  #releaseUnitForActiveRoot(context, instanceId, slotId) {
    const item = context.repository.get(instanceId);
    if (!item) return;
    const location = item.location;
    if (
      InventoryItemLocation.isLoadout(location) &&
      location.slotId === slotId
    ) {
      return;
    }
    if (InventoryItemLocation.isAttached(location)) {
      const rootInstanceId = context.assemblyReader.getRootInstanceId(instanceId);
      const path = context.assemblyReader.getPathToSlot(
        rootInstanceId,
        location.parentInstanceId,
        location.slotId,
        location.slotIndex,
      );
      context.assemblyStates
        .get(rootInstanceId)
        ?.clearRefill(path, { descendants: true });
    }
    if (InventoryItemLocation.isLoadout(location)) {
      this.#removeRootFromLoadout(context, instanceId);
    }
    if (!InventoryItemLocation.isInventory(item.location)) {
      context.repository.setLocation(
        instanceId,
        InventoryItemLocation.inventory(),
      );
    }
  }

  #releaseUnitForActiveAttachment(context, instanceId) {
    const item = context.repository.get(instanceId);
    if (!item) return;
    if (InventoryItemLocation.isAttached(item.location)) {
      const rootInstanceId = context.assemblyReader.getRootInstanceId(instanceId);
      const path = context.assemblyReader.getPathToSlot(
        rootInstanceId,
        item.location.parentInstanceId,
        item.location.slotId,
        item.location.slotIndex,
      );
      context.assemblyStates
        .get(rootInstanceId)
        ?.clearRefill(path, { descendants: true });
    }
    if (InventoryItemLocation.isLoadout(item.location)) {
      this.#removeRootFromLoadout(context, instanceId);
    }

    const descendants = context.repository.listDescendants(instanceId);
    for (const entry of [...descendants].sort(
      (left, right) => right.depth - left.depth,
    )) {
      context.repository.setLocation(
        entry.item.instanceId,
        InventoryItemLocation.inventory(),
      );
    }
    if (context.assemblyStates.has(instanceId)) {
      context.assemblyStates.remove(instanceId);
    }
    if (!InventoryItemLocation.isInventory(item.location)) {
      context.repository.setLocation(
        instanceId,
        InventoryItemLocation.inventory(),
      );
    }
  }

  #removeRootFromLoadout(context, instanceId) {
    const loadout = context.loadouts.findByRootInstanceId(instanceId);
    if (!loadout) return;
    const snapshot = loadout.snapshot();
    const roots = { ...snapshot.rootInstanceIds };
    for (const [slotId, rootId] of Object.entries(roots)) {
      if (rootId === instanceId) roots[slotId] = null;
    }
    context.loadouts.remove(loadout.loadoutId);
    if (Object.values(roots).some(Boolean)) {
      context.loadouts.add({ ...snapshot, rootInstanceIds: roots });
    } else {
      context.warnings.push(
        `Loadout ${loadout.loadoutId} became empty while restoring active equipment.`,
      );
    }
  }

  #occurrenceIndex(list, index) {
    if (!Array.isArray(list) || index < 0 || index >= list.length) return 0;
    let occurrence = 0;
    for (let cursor = 0; cursor < index; cursor += 1) {
      if (list[cursor] === list[index]) occurrence += 1;
    }
    return occurrence;
  }

  #firstLegacyArrayItemByType(list, types, context) {
    for (const legacyId of list || []) {
      if (types.includes(this.#typeByLegacyId(context, legacyId))) return legacyId;
    }
    return null;
  }

  #typeByLegacyId(context, legacyId) {
    const item = context.repository.get(legacyId);
    return item ? this.#type(this.#viewFromRaw(item)) : this.#legacyType(legacyId);
  }

  #view(context, instanceId) {
    return this.#viewFromRaw(context.repository.get(instanceId));
  }

  #viewFromRaw(raw) {
    if (!raw) return null;
    const definition = this.#definition(raw.itemId) || {};
    const instanceState = this.#itemStateMigration.migrate(raw, definition);
    return {
      ...definition,
      ...instanceState,
      effectiveStats: this.#effectiveStatsResolver.resolve({
        definition,
        instanceState,
      }),
    };
  }

  #type(item) {
    return item?.variant ?? item?.itemType ?? item?.type ?? null;
  }

  #definition(itemId) {
    if (!itemId) return null;
    if (typeof this.#itemDefinitionResolver === "function") {
      return this.#itemDefinitionResolver(itemId) || null;
    }
    return this.#itemDefinitionResolver?.getItemData?.(itemId) || null;
  }

  #isBuildBox(item) {
    return (
      item?.itemId === "sys_build_box" ||
      item?.itemType === "build_box" ||
      item?.type === "build_box"
    );
  }

  #legacyType(instanceId) {
    const item = this.#legacyItemsById.get(instanceId);
    const definition = this.#definition(item?.itemId) || {};
    return (
      item?.variant ??
      item?.type ??
      item?.itemType ??
      definition.variant ??
      definition.itemType ??
      null
    );
  }

  #stableSerialize(value) {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.#stableSerialize(entry)).join(",")}]`;
    }
    if (value && typeof value === "object") {
      const entries = Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map(
          (key) =>
            `${JSON.stringify(key)}:${this.#stableSerialize(value[key])}`,
        );
      return `{${entries.join(",")}}`;
    }
    return JSON.stringify(value);
  }

  #conservationLedger(items) {
    const ledger = new Map();
    for (const item of items || []) {
      const type = this.#type(this.#viewFromRaw(item));
      const isLine = type === "fishing_line";
      const payload = {};
      for (const key of Object.keys(item).sort()) {
        if (["instanceId", "quantity", "location"].includes(key)) continue;
        if (isLine && key === "lengthMeters") continue;
        if (item[key] !== undefined) payload[key] = item[key];
      }
      const key = `${isLine ? "line" : "item"}:${this.#stableSerialize(payload)}`;
      const quantity = Number(item.quantity ?? 1);
      const amount = isLine
        ? this.#lineLengthMeters(item) * quantity
        : quantity;
      ledger.set(key, (ledger.get(key) || 0) + amount);
    }
    return ledger;
  }

  #lineLengthMeters(item) {
    const ownLength = Number(
      item?.statOverrides?.lengthMeters ?? item?.lengthMeters,
    );
    if (Number.isFinite(ownLength)) return Math.max(0, ownLength);
    const definition = this.#definition(item?.itemId) || {};
    const baseLength = Number(
      definition.gameplayStats?.lengthMeters,
    );
    return Number.isFinite(baseLength) ? Math.max(0, baseLength) : 0;
  }

  #validateConservation(context) {
    const before = this.#conservationLedger(context.conservationBaseline);
    const after = this.#conservationLedger(context.repository.list());
    const keys = new Set([...before.keys(), ...after.keys()]);
    for (const key of keys) {
      const expected = before.get(key) || 0;
      const actual = after.get(key) || 0;
      if (Math.abs(expected - actual) > 0.000001) {
        throw new Error(
          `Inventory conservation failed for ${key}: expected ${expected}, received ${actual}`,
        );
      }
    }
  }

  #validate(context, equipment) {
    for (const item of context.repository.list()) {
      if (item.buildId || item.itemId === "sys_build_box") {
        throw new Error("Legacy build metadata remained after migration");
      }
    }
    for (const instanceId of Object.values(equipment.snapshot())) {
      if (!instanceId) continue;
      const item = context.repository.require(instanceId);
      if (InventoryItemLocation.isAttached(item.location)) {
        throw new Error(`Equipment root ${instanceId} cannot be attached`);
      }
    }
    for (const [slotId, instanceId] of Object.entries(equipment.snapshot())) {
      if (!instanceId) continue;
      const type = this.#view(context, instanceId)?.itemType;
      const acceptedTypes = EQUIPMENT_SLOT_CONFIG?.[slotId]?.acceptTypes || [];
      if (acceptedTypes.length > 0 && !acceptedTypes.includes(type)) {
        throw new Error(`Equipment root ${instanceId} is invalid for ${slotId}`);
      }
    }
    const equipmentSnapshot = equipment.snapshot();
    const rod = this.#view(context, equipmentSnapshot.rod);
    const capabilities = new RodCapabilityResolver().resolve(rod);
    if (!capabilities.supportsReel && equipmentSnapshot.reel) {
      throw new Error("A reel is active on a rod that does not support reels");
    }
    if (!capabilities.supportsFloat && equipmentSnapshot.float) {
      throw new Error("A float is active on a rod that does not support floats");
    }
    if (equipmentSnapshot.terminalLine) {
      const terminalType = this.#type(
        this.#view(context, equipmentSnapshot.terminalLine),
      );
      const expectedType = capabilities.supportsReel
        ? "leader_line"
        : "fishing_line";
      if (terminalType !== expectedType) {
        throw new Error(
          `Terminal line ${equipmentSnapshot.terminalLine} must be ${expectedType}`,
        );
      }
    }
    for (const state of context.assemblyStates.list()) {
      const root = context.repository.require(state.rootInstanceId);
      if (InventoryItemLocation.isAttached(root.location)) {
        throw new Error(`Assembly root ${state.rootInstanceId} cannot be attached`);
      }
      context.profileRegistry.require(state.profileId);
    }
    for (const loadout of context.loadouts.list()) {
      for (const [slotId, instanceId] of Object.entries(
        loadout.getRootInstanceIds(),
      )) {
        if (!instanceId) continue;
        const location = context.repository.require(instanceId).location;
        if (
          !InventoryItemLocation.isLoadout(location) ||
          location.loadoutId !== loadout.loadoutId ||
          location.slotId !== slotId
        ) {
          throw new Error(`Invalid loadout custody for ${instanceId}`);
        }
      }
    }
    for (const item of context.repository.list()) {
      if (!InventoryItemLocation.isLoadout(item.location)) continue;
      const loadout = context.loadouts.get(item.location.loadoutId);
      if (
        !loadout ||
        loadout.getRootInstanceId(item.location.slotId) !== item.instanceId
      ) {
        throw new Error(`Orphan loadout custody for ${item.instanceId}`);
      }
    }
    this.#validateConservation(context);
  }

}

globalThis.InventoryV2LegacyMigration = InventoryV2LegacyMigration;
