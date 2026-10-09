import { INVENTORY_MESSAGES } from "../../game/presentation/inventory/inventory_messages.js";
import { EffectiveItemRarityResolver } from "../../game/domain/items/rarity/effective_item_rarity_resolver.js";
import { InventoryInstanceIdFactory } from "../../game/application/inventory/inventory_instance_id_factory.js";
import { InventoryItemFactory } from "../../game/application/inventory/inventory_item_factory.js";
import { InventoryItemViewContext } from "../../game/application/inventory/inventory_item_view_context.js";
import { InventoryItemViewFactory } from "../../game/presentation/inventory/inventory_item_view_factory.js";
import { InventoryRuntimeDisplayStatsResolver } from "../../game/application/inventory/inventory_runtime_display_stats_resolver.js";
import { InventoryActionType } from "../../game/presentation/inventory/inventory_action_type.js";
import { InventoryCompositionRoot } from "./inventory_composition_root.js";
import { ItemDatabase } from "../../game/application/inventory/item_database.js";
import { LegacyInventorySaveSource } from "../../game/application/inventory/persistence/legacy_inventory_save_source.js";
import { PlayerInventory } from "../../game/application/inventory/player_inventory.js";
import { ROD_CAST_DISPLAY_LABELS } from "../../game/presentation/inventory/rod_cast_display_labels.js";
import { RodCastDisplayStatsWriter } from "../../game/application/inventory/rod_cast_display_stats_writer.js";
import { TackleLoadLimitPolicy } from "../../game/domain/equipment/tackle_load_limit_policy.js";

// Composes the player's inventory. Without a current save, a new player starts from the configured items in the
// current format and a classic save is converted once; item views get their runtime context, and PlayerInventory
// exposes the result to the game.
export function createPlayerInventory({
  itemDB,
  playerConfig,
  events,
  castDistanceCalculator,
  lineRules,
  runtimeConfigProvider,
  itemRarityResolver,
  itemProgressionResolver,
  itemConditionResolver,
  itemFreshnessResolver,
  baitEffectivenessCatalogResolver,
  effectiveStatsResolver,
  itemStatOverridePolicy,
  cache,
  assemblyProfileConfig,
  makeRandomId,
  now,
}) {
  const itemDatabase = new ItemDatabase(itemDB);
  const effectiveRarityResolver = new EffectiveItemRarityResolver({ itemRarityResolver });
  const itemFactory = new InventoryItemFactory({ itemDatabase, itemRarityResolver });
  const legacySaveSource = new LegacyInventorySaveSource({ cache, itemDB, playerConfig, itemFactory });
  const itemViewContext = new InventoryItemViewContext({
    runtimeConfigProvider,
    itemDatabase,
    effectiveStatsResolver,
  });
  const itemViewFactory = new InventoryItemViewFactory({
    itemDatabase,
    progressionResolver: itemProgressionResolver,
    conditionResolver: itemConditionResolver,
    freshnessResolver: itemFreshnessResolver,
    baitEffectivenessCatalogResolver,
    effectiveRarityResolver,
    displayStatsResolver: new InventoryRuntimeDisplayStatsResolver(),
    effectiveStatsResolver,
    runtimeContextProvider: (item) => itemViewContext.resolve(item),
  });
  const instanceIds = new InventoryInstanceIdFactory({ makeRandomId, now });
  let playerInventory = null;
  const inventory = InventoryCompositionRoot.compose({
    cache,
    // Both providers are read only when neither a current nor a previous-schema save exists.
    startingStateProvider: () => legacySaveSource.hasSave() ? null : {
      items: playerConfig.inventory || [],
      equipment: playerConfig.equipment || {},
      buildTemplates: itemDB.builds || {},
      settings: playerConfig.inventorySettings || {},
    },
    legacyStateProvider: () => {
      const legacySave = legacySaveSource.load();
      return {
        legacyItems: legacySave.inventory.getAll(),
        legacyEquipment: legacySave.equipment,
        settings: legacySave.settings,
      };
    },
    itemDefinitionResolver: itemDatabase,
    itemViewFactory,
    instanceIdFactory: (context = {}) => {
      const prefix =
        typeof context === "string" ? context : context?.prefix || "item";
      return instanceIds.create(prefix);
    },
    now: () => now(),
    // Read only when a view model is built, after composition has finished.
    loadValueProvider: () => playerInventory.getMaxTackleLoadKg(),
    lineConfig: lineRules.config,
    itemFreshnessResolver,
    itemStatOverridePolicy,
    effectiveStatsResolver,
    assemblyProfileConfig,
  });
  itemViewContext.attachEquipment(inventory);
  playerInventory = new PlayerInventory({
    messages: INVENTORY_MESSAGES,
    inventory,
    actions: InventoryActionType,
    events,
    rodCastDisplayStats: new RodCastDisplayStatsWriter({
      castDistanceCalculator,
      linePolicy: lineRules,
      labels: ROD_CAST_DISPLAY_LABELS,
    }),
    tackleLoadLimitPolicy: new TackleLoadLimitPolicy(),
    itemDatabase,
    itemViewContext,
  });
  return playerInventory;
}
