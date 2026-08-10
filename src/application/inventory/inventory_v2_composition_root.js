class InventoryV2CompositionRoot {
  static create(options = {}) {
    return this.compose(options).facade;
  }

  static compose({
    cache = null,
    stateStore = null,
    initialSnapshot = null,
    legacyStateProvider = null,
    legacyItems = null,
    legacyEquipment = null,
    legacySettings = null,
    itemDefinitionResolver = null,
    itemViewFactory = null,
    instanceIdFactory = null,
    boatChargeProvider = null,
    loadValueProvider = null,
    warningSink = null,
    lineConfig = {},
  } = {}) {
    const definitions =
      itemDefinitionResolver ||
      (typeof ITEM_DB !== "undefined" ? ITEM_DB : null);
    const hydrator = new InventoryV2ItemHydrator({
      itemDefinitionResolver: definitions,
    });
    const definitionLookup = (itemId) => hydrator.getDefinition(itemId);
    const store =
      stateStore ||
      new InventoryV2StateStore({
        cache:
          cache ||
          (typeof CacheManager !== "undefined" ? CacheManager : null),
      });

    const resolvedState = this.#resolveSnapshot({
      store,
      initialSnapshot,
      legacyStateProvider,
      legacyItems,
      legacyEquipment,
      legacySettings,
      cache,
      definitionLookup,
      instanceIdFactory,
    });
    const snapshot = resolvedState.snapshot;

    const equipmentState = new EquipmentState(snapshot.equipment);
    const loadouts = new EquipmentLoadoutRepository({
      loadouts: snapshot.loadouts,
    });
    const reservationPolicy = new InventoryItemReservationPolicy({
      equipmentState,
      loadouts,
    });
    const repository = new FlatInventoryItemRepository({
      items: snapshot.items,
      instanceIdFactory,
      reservationPolicy,
    });
    const assemblyStates = new AssemblyStateRepository({
      states: snapshot.assemblies,
    });
    const profileRegistry = new AssemblyProfileRegistry(
      ITEM_ASSEMBLY_PROFILE_CONFIG,
      { itemDefinitionResolver: definitionLookup },
    );
    const assemblyReader = new ItemAssemblyReader({
      repository,
      stateRepository: assemblyStates,
      profileRegistry,
    });
    const attachmentTargetResolver = new AssemblyAttachmentTargetResolver({
      repository,
      stateRepository: assemblyStates,
      profileRegistry,
      reader: assemblyReader,
    });
    const signaturePolicy = new ExactAssemblyRefillSignaturePolicy();
    const stackingPolicy = new ItemAssemblyStackingPolicy();
    const capacityPolicy = new UnlimitedInventoryCapacityPolicy();
    const assemblyService = new ItemAssemblyService({
      repository,
      stateRepository: assemblyStates,
      profileRegistry,
      reader: assemblyReader,
      stackingPolicy,
      capacityPolicy: new UnlimitedAssemblyCapacityPolicy(),
      signaturePolicy,
      reservationPolicy,
    });
    const settings = new AutoRefillSettings(snapshot.settings);
    const refillMemory = new AutoRefillMemory(
      snapshot.settings?.refillMemory || {},
    );
    const snapshotFactory = new InventoryV2SnapshotFactory({
      repository,
      assemblyStates,
      equipmentState,
      loadouts,
      settings,
      refillMemory,
    });
    const transaction = new InventoryV2TransactionCoordinator({
      participants: [
        repository,
        assemblyStates,
        equipmentState,
        loadouts,
        new InventoryV2SettingsTransactionParticipant(settings),
        new InventoryV2RefillMemoryTransactionParticipant(refillMemory),
      ],
      afterCommit: () => store.save(snapshotFactory.create()),
    });

    const capabilityResolver = new RodCapabilityResolver();
    const visibilityPolicy = new EquipmentSlotVisibilityPolicy({
      slotConfig: EQUIPMENT_SLOT_CONFIG,
      capabilityResolver,
    });
    const terminalLineResolver = new TerminalLineSlotResolver({
      capabilityResolver,
    });
    const itemReader = (instanceId) =>
      hydrator.hydrate(instanceId, repository);
    const projectionService = new EquipmentProjectionService({
      itemReader,
      assemblyReader,
      capabilityResolver,
    });
    const readinessPolicy = new FishingReadinessPolicy({
      itemReader,
      assemblyReader,
      capabilityResolver,
    });
    const compatibilityPolicy = new EquipmentCompatibilityPolicy({
      slotConfig: EQUIPMENT_SLOT_CONFIG,
      visibilityPolicy,
      terminalLineResolver,
      capabilityResolver,
      readinessPolicy,
    });
    const availabilityPolicy = new EquipmentSlotAvailabilityPolicy({
      slotConfig: EQUIPMENT_SLOT_CONFIG,
      visibilityPolicy,
      terminalLineResolver,
    });
    const contextItemFilter = new InventoryV2ContextItemFilter({
      strategies: [
        new AssemblyInventoryContextFilterStrategy({
          targetResolver: attachmentTargetResolver,
        }),
        new EquipmentInventoryContextFilterStrategy({
          equipmentState,
          compatibilityPolicy,
          visibilityPolicy,
          targetResolver: attachmentTargetResolver,
          itemReader: (raw) => hydrator.hydrate(raw, repository),
          slotIds: EQUIPMENT_ALL_SLOT_IDS,
        }),
      ],
    });
    const rodChangePlanner = new ManualRodChangePlanner({ capacityPolicy });
    const equipmentTransitionPort = new InventoryV2EquipmentTransitionPort({
      transaction,
    });
    const equipmentTransitionExecutor = new EquipmentTransitionExecutor({
      port: equipmentTransitionPort,
    });
    const lineAllocationService = new InventoryV2LineAllocationService({
      repository,
      itemReader: (raw) => hydrator.hydrate(raw, repository),
      lineConfig,
      instanceIdFactory,
      isReserved: (instanceId) => {
        const item = repository.get(instanceId);
        return reservationPolicy.isReserved(item || instanceId);
      },
    });
    const equipmentLineReadinessPolicy =
      new InventoryV2EquipmentLineReadinessPolicy({
        repository,
        assemblyReader,
        itemReader: (raw) => hydrator.hydrate(raw, repository),
        lineAllocationService,
      });

    const loadoutPort = new InventoryV2LoadoutPort({
      repository,
      loadouts,
      transaction,
      lineAllocationService,
    });
    const loadoutTransitionPlanner = new LoadoutEquipmentTransitionPlanner({
      capacityPolicy,
      ownershipReader: (instanceId) => loadoutPort.getRootOwner(instanceId),
    });
    const loadoutService = new LoadoutApplicationService({
      port: loadoutPort,
      capacityPolicy,
      transitionPlanner: loadoutTransitionPlanner,
      equipmentActivationValidator: equipmentLineReadinessPolicy,
    });

    const autoRefillPolicy = new AutoRefillPolicy({ settings });
    const autoRefillTargetProvider = new EquipmentAutoRefillTargetProvider({
      equipmentState,
      assemblyReader,
      memory: refillMemory,
    });
    const refillInventoryPort = new InventoryV2RefillInventoryPort({
      repository,
      signaturePolicy,
      stackingPolicy,
      reservationPolicy,
    });
    const refillTargetWriter = new InventoryV2RefillTargetWriter({
      repository,
      equipmentState,
      assemblyService,
      assemblyReader,
    });
    const exactRefillPort = new ExactInventoryAutoRefillPort({
      inventoryPort: refillInventoryPort,
      targetWriter: refillTargetWriter,
      signaturePolicy,
    });
    const autoRefillCoordinator = new AutoRefillCoordinator({
      policy: autoRefillPolicy,
      targetProvider: autoRefillTargetProvider,
      port: exactRefillPort,
      warningSink,
    });

    const completionPolicy = new AssemblyCompletionPolicy({
      repository,
      profileRegistry,
      assemblyReader,
    });
    const itemViews = new InventoryV2ItemViewFactory({
      repository,
      assemblyStates,
      assemblyReader,
      completionPolicy,
      hydrate: (raw) =>
        itemViewFactory?.create?.(raw) || hydrator.hydrate(raw, repository),
      boatChargeProvider,
    });
    const subfilterResolver = new InventoryV2SubfilterResolver();
    const viewModels = new InventoryV2ViewModelFactory({
      repository,
      assemblyStates,
      attachmentTargetResolver,
      contextItemFilter,
      equipmentState,
      loadouts,
      itemViews,
      subfilterResolver,
      visibilityPolicy,
      availabilityPolicy,
      terminalLineResolver,
      compatibilityPolicy,
      projectionService,
      settings,
      loadValueProvider,
    });
    const commands = new InventoryV2CommandService({
      repository,
      assemblyStates,
      profileRegistry,
      assemblyReader,
      attachmentTargetResolver,
      assemblyService,
      equipmentState,
      loadouts,
      transaction,
      compatibilityPolicy,
      rodChangePlanner,
      loadoutService,
      settings,
      refillMemory,
      signaturePolicy,
      autoRefillCoordinator,
      hydrator,
      projectionService,
      lineAllocationService,
      equipmentLineReadinessPolicy,
      stackingPolicy,
      reservationPolicy,
      instanceIdFactory,
    });
    const gameplayBridge = new InventoryV2GameplayBridge({
      repository,
      hydrator,
      equipmentState,
      projectionService,
      readinessPolicy,
      commands,
      itemViews,
    });
    const facade = new InventoryV2Facade({
      commands,
      viewModels,
      gameplayBridge,
      migrationWarnings: resolvedState.warnings,
    });

    return Object.freeze({
      facade,
      gameplayBridge,
      commands,
      repository,
      assemblyStates,
      profileRegistry,
      assemblyReader,
      attachmentTargetResolver,
      assemblyService,
      equipmentState,
      loadouts,
      settings,
      refillMemory,
      transaction,
      snapshotFactory,
      stateStore: store,
      projectionService,
      readinessPolicy,
      compatibilityPolicy,
      visibilityPolicy,
      availabilityPolicy,
      terminalLineResolver,
      rodChangePlanner,
      equipmentTransitionExecutor,
      lineAllocationService,
      equipmentLineReadinessPolicy,
      loadoutService,
      autoRefillCoordinator,
      itemViews,
      viewModels,
      contextItemFilter,
      hydrator,
      reservationPolicy,
    });
  }

  static #resolveSnapshot({
    store,
    initialSnapshot,
    legacyStateProvider,
    legacyItems,
    legacyEquipment,
    legacySettings,
    cache,
    definitionLookup,
    instanceIdFactory,
  }) {
    if (initialSnapshot) {
      const snapshot = store.save(initialSnapshot);
      return { snapshot, warnings: [] };
    }
    const loaded = store.load();
    if (loaded) return { snapshot: loaded, warnings: [] };

    const provided =
      typeof legacyStateProvider === "function"
        ? legacyStateProvider() || {}
        : legacyStateProvider || {};
    const cacheAdapter =
      cache || (typeof CacheManager !== "undefined" ? CacheManager : null);
    const sourceItems =
      legacyItems ||
      provided.legacyItems ||
      provided.inventory ||
      cacheAdapter?.get?.("player_inventory", []) ||
      [];
    const sourceEquipment =
      legacyEquipment ||
      provided.legacyEquipment ||
      provided.equipment ||
      cacheAdapter?.get?.("player_equipment", {}) ||
      {};
    const sourceSettings =
      legacySettings || provided.settings || {};
    const migration = new InventoryV2LegacyMigration({
      itemDefinitionResolver: definitionLookup,
      instanceIdFactory,
    }).migrate({
      legacyItems: sourceItems,
      legacyEquipment: sourceEquipment,
      settings: sourceSettings,
    });
    const snapshot = store.save(migration.snapshot);
    return { snapshot, warnings: [...migration.warnings] };
  }
}

globalThis.InventoryV2CompositionRoot = InventoryV2CompositionRoot;
