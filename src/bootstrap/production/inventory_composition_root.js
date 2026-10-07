import { ApplyBaitExposureService } from "../../game/application/inventory/apply_bait_exposure_service.js";
import { AssemblyAttachmentTargetResolver } from "../../game/domain/assemblies/assembly_attachment_target_resolver.js";
import { AssemblyCompletionPolicy } from "../../game/domain/assemblies/assembly_completion_policy.js";
import { AssemblyInventoryContextFilterStrategy, EquipmentInventoryContextFilterStrategy, InventoryContextItemFilter } from "../../game/application/inventory/inventory_context_item_filter.js";
import { AssemblyProfileRegistry } from "../../game/domain/assemblies/assembly_profile_registry.js";
import { AssemblyStateRepository } from "../../game/domain/assemblies/assembly_state_repository.js";
import { AutoRefillCoordinator, ExactInventoryAutoRefillPort } from "../../game/application/inventory/auto_refill_coordinator.js";
import { AutoRefillMemory, AutoRefillPolicy, AutoRefillSettings } from "../../game/domain/equipment/auto_refill_policy.js";
import { CacheManager } from "../../platform/browser/storage/cache_manager.js";
import { EQUIPMENT_ALL_SLOT_IDS, EQUIPMENT_SLOT_CONFIG } from "../../game/domain/equipment/equipment_slot_catalog.js";
import { EQUIPMENT_SLOT_PRESENTATION } from "../../game/presentation/inventory/equipment_slot_presentation.js";
import { EquipmentAutoRefillTargetProvider } from "../../game/application/inventory/equipment_auto_refill_target_provider.js";
import { EquipmentCompatibilityPolicy } from "../../game/domain/equipment/equipment_compatibility_policy.js";
import { EquipmentLoadoutRepository } from "../../game/domain/loadouts/equipment_loadout_repository.js";
import { EquipmentReadModelFactory } from "../../game/application/inventory/equipment_read_model_factory.js";
import { EquipmentSlotAvailabilityPolicy } from "../../game/presentation/inventory/equipment_slot_availability_policy.js";
import { EquipmentSlotVisibilityPolicy } from "../../game/domain/equipment/equipment_slot_visibility_policy.js";
import { EquipmentState } from "../../game/domain/equipment/equipment_state.js";
import { EquipmentTransitionExecutor } from "../../game/application/inventory/equipment_transition_executor.js";
import { FishingReadinessPolicy } from "../../game/domain/equipment/fishing_readiness_policy.js";
import { FlatInventoryItemRepository } from "../../game/domain/inventory/flat_inventory_item_repository.js";
import { FreshestRefillCandidatePolicy } from "../../game/application/inventory/freshest_refill_candidate_policy.js";
import { INVENTORY_RULE_MESSAGES } from "../../game/presentation/inventory/inventory_rule_messages.js";
import { INVENTORY_SCHEMA_VERSION, InventoryStateStore } from "../../game/application/inventory/persistence/inventory_state_store.js";
import { INVENTORY_SORT_CONFIG } from "../../game/presentation/inventory/inventory_sort_config.js";
import { InventoryItemReservationPolicy } from "../../game/domain/inventory/inventory_item_reservation_policy.js";
import { InventoryItemSnapshotMapper } from "../../game/application/inventory/persistence/inventory_item_snapshot_mapper.js";
import { InventoryActionType } from "../../game/presentation/inventory/inventory_view_model.js";
import { InventoryCommandService } from "../../game/application/inventory/inventory_command_service.js";
import { InventoryGameplayCommands } from "../../game/application/inventory/inventory_gameplay_commands.js";
import { InventoryItemRemovalService } from "../../game/application/inventory/inventory_item_removal_service.js";
import { InventoryUiState } from "../../game/application/inventory/inventory_ui_state.js";
import { InventoryEquipmentLineReadinessPolicy } from "../../game/application/inventory/inventory_equipment_line_readiness_policy.js";
import { InventoryEquipmentTransitionPort } from "../../game/application/inventory/inventory_equipment_transition_adapter.js";
import { InventoryFacade } from "../../game/application/inventory/inventory_facade.js";
import { InventoryGameplayBridge } from "../../game/application/inventory/inventory_gameplay_facade.js";
import { InventoryItemHydrator } from "../../game/application/inventory/inventory_item_hydrator.js";
import { InventoryItemOrderResolver } from "../../game/presentation/inventory/inventory_item_order_resolver.js";
import { InventoryItemTreeViewFactory } from "../../game/presentation/inventory/inventory_item_tree_view_factory.js";
import { InventoryLegacyMigration } from "../../game/application/inventory/persistence/inventory_legacy_migration.js";
import { InventoryLineAllocationService } from "../../game/application/inventory/inventory_line_allocation_service.js";
import { InventoryLoadoutPort } from "../../game/application/inventory/inventory_loadout_adapter.js";
import { InventoryRefillInventoryPort, InventoryRefillTargetWriter } from "../../game/application/inventory/inventory_refill_adapters.js";
import { InventoryRefillMemoryTransactionParticipant, InventorySettingsTransactionParticipant } from "../../game/application/inventory/inventory_transaction_participants.js";
import { InventorySnapshotFactory } from "../../game/application/inventory/persistence/inventory_snapshot_factory.js";
import { InventorySnapshotMigration } from "../../game/application/inventory/persistence/inventory_snapshot_migration.js";
import { InventorySubfilterResolver } from "../../game/presentation/inventory/inventory_subfilter_resolver.js";
import { InventoryTransactionCoordinator } from "../../game/application/inventory/inventory_transaction_coordinator.js";
import { InventoryViewModelFactory } from "../../game/presentation/inventory/inventory_view_model_factory.js";
import { ItemAssemblyReader } from "../../game/domain/assemblies/item_assembly_reader.js";
import { ItemAssemblyService } from "../../game/domain/assemblies/item_assembly_service.js";
import { ItemAssemblyStackingPolicy } from "../../game/domain/inventory/item_assembly_stacking_policy.js";
import { LegacyItemStateMigration } from "../../game/application/inventory/persistence/legacy_item_state_migration.js";
import { LineAllocationPolicy } from "../../game/domain/line/line_allocation_policy.js";
import { LoadoutApplicationService } from "../../game/application/inventory/loadout_application_service.js";
import { LoadoutEquipmentTransitionPlanner } from "../../game/domain/loadouts/loadout_equipment_transition_planner.js";
import { ManualRodChangePlanner } from "../../game/domain/equipment/equipment_transition_planner.js";
import { RefillCompatibleSignaturePolicy } from "../../game/domain/assemblies/refill_compatible_signature_policy.js";
import { RodCapabilityResolver } from "../../game/domain/equipment/rod_capability_resolver.js";
import { TerminalLineSlotLabelResolver } from "../../game/presentation/inventory/terminal_line_slot_label_resolver.js";
import { TerminalLineSlotResolver } from "../../game/domain/equipment/terminal_line_slot_resolver.js";
import { UnlimitedAssemblyCapacityPolicy } from "../../game/domain/inventory/unlimited_assembly_capacity_policy.js";
import { UnlimitedInventoryCapacityPolicy } from "../../game/domain/inventory/inventory_capacity_policy.js";

export class InventoryCompositionRoot {
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
    now = null,
    boatChargeProvider = null,
    loadValueProvider = null,
    warningSink = null,
    lineConfig = {},
    itemFreshnessResolver = null,
    itemStatOverridePolicy,
    effectiveStatsResolver,
    assemblyProfileConfig,
  } = {}) {
    // The composed item stat override policy is shared by every item-state collaborator.
    const overridePolicy = itemStatOverridePolicy;
    const itemStateMigration = new LegacyItemStateMigration({ overridePolicy });
    const definitions = itemDefinitionResolver || null;
    const hydrator = new InventoryItemHydrator({
      itemDefinitionResolver: definitions,
      effectiveStatsResolver,
    });
    const definitionLookup = (itemId) => hydrator.getDefinition(itemId);
    const itemSnapshotMapper = new InventoryItemSnapshotMapper({
      itemDefinitionResolver: definitionLookup,
      overridePolicy,
    });
    const store =
      stateStore ||
      new InventoryStateStore({
        cache:
          cache ||
          CacheManager,
        itemSnapshotMapper,
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
      itemSnapshotMapper,
      instanceIdFactory,
      now,
      itemStateMigration,
      effectiveStatsResolver,
      assemblyProfileConfig,
    });
    const snapshot = resolvedState.snapshot;

    const equipmentState = new EquipmentState(snapshot.equipment);
    const loadouts = new EquipmentLoadoutRepository({
      loadouts: snapshot.loadouts,
      now,
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
      assemblyProfileConfig,
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
    const signaturePolicy = new RefillCompatibleSignaturePolicy();
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
    const snapshotFactory = new InventorySnapshotFactory({
      repository,
      assemblyStates,
      equipmentState,
      loadouts,
      settings,
      refillMemory,
      itemSnapshotMapper,
    });
    const transaction = new InventoryTransactionCoordinator({
      participants: [
        repository,
        assemblyStates,
        equipmentState,
        loadouts,
        new InventorySettingsTransactionParticipant(settings),
        new InventoryRefillMemoryTransactionParticipant(refillMemory),
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
    const terminalLineLabelResolver = new TerminalLineSlotLabelResolver({
      capabilityResolver,
    });
    const itemReader = (instanceId) =>
      hydrator.hydrate(instanceId, repository);
    const equipmentReadModelFactory = new EquipmentReadModelFactory({
      itemReader,
      assemblyReader,
      capabilityResolver,
    });
    const readinessPolicy = new FishingReadinessPolicy({
      itemReader,
      assemblyReader,
      capabilityResolver,
      messages: INVENTORY_RULE_MESSAGES,
    });
    const compatibilityPolicy = new EquipmentCompatibilityPolicy({
      slotConfig: EQUIPMENT_SLOT_CONFIG,
      visibilityPolicy,
      terminalLineResolver,
      capabilityResolver,
      readinessPolicy,
      messages: INVENTORY_RULE_MESSAGES,
    });
    const availabilityPolicy = new EquipmentSlotAvailabilityPolicy({
      slotConfig: EQUIPMENT_SLOT_CONFIG,
      slotPresentation: EQUIPMENT_SLOT_PRESENTATION,
      visibilityPolicy,
      terminalLineResolver,
    });
    const contextItemFilter = new InventoryContextItemFilter({
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
    const rodChangePlanner = new ManualRodChangePlanner({
      capacityPolicy,
      messages: INVENTORY_RULE_MESSAGES,
    });
    const equipmentTransitionPort = new InventoryEquipmentTransitionPort({
      transaction,
    });
    const equipmentTransitionExecutor = new EquipmentTransitionExecutor({
      port: equipmentTransitionPort,
    });
    const lineAllocationService = new InventoryLineAllocationService({
      linePolicy: new LineAllocationPolicy(lineConfig, {
        messages: INVENTORY_RULE_MESSAGES,
      }),
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
      new InventoryEquipmentLineReadinessPolicy({
        repository,
        assemblyReader,
        itemReader: (raw) => hydrator.hydrate(raw, repository),
        lineAllocationService,
      });

    const loadoutPort = new InventoryLoadoutPort({
      repository,
      loadouts,
      transaction,
      lineAllocationService,
    });
    const loadoutTransitionPlanner = new LoadoutEquipmentTransitionPlanner({
      capacityPolicy,
      ownershipReader: (instanceId) => loadoutPort.getRootOwner(instanceId),
      messages: INVENTORY_RULE_MESSAGES,
    });
    const loadoutService = new LoadoutApplicationService({
      port: loadoutPort,
      capacityPolicy,
      transitionPlanner: loadoutTransitionPlanner,
      equipmentActivationValidator: equipmentLineReadinessPolicy,
      now,
    });

    const autoRefillPolicy = new AutoRefillPolicy({ settings });
    const autoRefillTargetProvider = new EquipmentAutoRefillTargetProvider({
      equipmentState,
      assemblyReader,
      memory: refillMemory,
    });
    const refillInventoryPort = new InventoryRefillInventoryPort({
      repository,
      signaturePolicy,
      stackingPolicy,
      reservationPolicy,
      candidatePolicy: new FreshestRefillCandidatePolicy(),
    });
    const refillTargetWriter = new InventoryRefillTargetWriter({
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
    const itemViews = new InventoryItemTreeViewFactory({
      repository,
      assemblyStates,
      assemblyReader,
      completionPolicy,
      hydrate: (raw) =>
        itemViewFactory?.create?.(raw) || hydrator.hydrate(raw, repository),
      boatChargeProvider,
    });
    const subfilterResolver = new InventorySubfilterResolver();
    const itemOrderResolver = new InventoryItemOrderResolver({
      config: INVENTORY_SORT_CONFIG,
    });
    const viewModels = new InventoryViewModelFactory({
      repository,
      assemblyStates,
      attachmentTargetResolver,
      contextItemFilter,
      equipmentState,
      loadouts,
      itemViews,
      subfilterResolver,
      itemOrderResolver,
      visibilityPolicy,
      availabilityPolicy,
      terminalLineLabelResolver,
      compatibilityPolicy,
      equipmentLineReadinessPolicy,
      equipmentReadModelFactory,
      settings,
      loadValueProvider,
    });
    const itemRemoval = new InventoryItemRemovalService({
      repository,
      assemblyReader,
      assemblyService,
      assemblyStates,
      equipmentState,
      loadouts,
      now,
    });
    const commands = new InventoryCommandService({
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
      hydrator,
      lineAllocationService,
      equipmentLineReadinessPolicy,
      stackingPolicy,
      reservationPolicy,
      instanceIdFactory,
      sortConfig: INVENTORY_SORT_CONFIG,
      actionTypes: InventoryActionType,
      now,
      uiState: new InventoryUiState({ sortConfig: INVENTORY_SORT_CONFIG }),
      itemRemoval,
    });
    const gameplayCommands = new InventoryGameplayCommands({
      transaction,
      itemRemoval,
      repository,
      assemblyReader,
      equipmentState,
      lineAllocationService,
      autoRefillCoordinator,
      baitExposureService: itemFreshnessResolver
        ? new ApplyBaitExposureService({
            repository,
            hydrator,
            freshnessResolver: itemFreshnessResolver,
          })
        : null,
      hydrator,
    });
    const gameplayBridge = new InventoryGameplayBridge({
      repository,
      hydrator,
      equipmentState,
      equipmentReadModelFactory,
      readinessPolicy,
      gameplayCommands,
      itemViews,
    });
    const facade = new InventoryFacade({
      commands,
      viewModels,
      gameplayBridge,
      migrationWarnings: resolvedState.warnings,
    });

    return Object.freeze({
      facade,
      gameplayBridge,
      commands,
      gameplayCommands,
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
      equipmentReadModelFactory,
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
      itemSnapshotMapper,
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
    itemSnapshotMapper,
    instanceIdFactory,
    now,
    itemStateMigration,
    effectiveStatsResolver,
    assemblyProfileConfig,
  }) {
    if (initialSnapshot) {
      const migration = new InventorySnapshotMigration({
        itemDefinitionResolver: definitionLookup,
        itemSnapshotMapper,
        itemStateMigration,
        targetSchemaVersion: INVENTORY_SCHEMA_VERSION,
      }).migrate(initialSnapshot);
      const snapshot = store.save(migration.snapshot);
      return { snapshot, warnings: [...migration.warnings] };
    }
    const loaded = store.load();
    if (loaded) {
      const normalized = new InventorySnapshotMigration({
        itemDefinitionResolver: definitionLookup,
        itemSnapshotMapper,
        itemStateMigration,
        targetSchemaVersion: INVENTORY_SCHEMA_VERSION,
      }).migrate(loaded);
      return {
        snapshot: normalized.snapshot,
        warnings: [...normalized.warnings],
      };
    }

    const previousSnapshot = store.loadPrevious?.([3, 2]) || null;
    if (previousSnapshot) {
      const migration = new InventorySnapshotMigration({
        itemDefinitionResolver: definitionLookup,
        itemSnapshotMapper,
        itemStateMigration,
        targetSchemaVersion: INVENTORY_SCHEMA_VERSION,
      }).migrate(previousSnapshot);
      const snapshot = store.save(migration.snapshot);
      return { snapshot, warnings: [...migration.warnings] };
    }

    const provided =
      typeof legacyStateProvider === "function"
        ? legacyStateProvider() || {}
        : legacyStateProvider || {};
    const cacheAdapter =
      cache || CacheManager;
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
    const migration = new InventoryLegacyMigration({
      itemDefinitionResolver: definitionLookup,
      itemSnapshotMapper,
      instanceIdFactory,
      now,
      itemStateMigration,
      effectiveStatsResolver,
      assemblyProfileConfig,
    }).migrate({
      legacyItems: sourceItems,
      legacyEquipment: sourceEquipment,
      settings: sourceSettings,
    });
    const snapshot = store.save(migration.snapshot);
    return { snapshot, warnings: [...migration.warnings] };
  }
}
