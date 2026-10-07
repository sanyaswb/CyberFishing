import { EffectiveItemRarityResolver } from "../../game/domain/items/rarity/effective_item_rarity_resolver.js";
import { InventoryInstanceIdFactory } from "../../game/application/inventory/inventory_instance_id_factory.js";
import { InventoryItemFactory } from "../../game/application/inventory/inventory_item_factory.js";
import { InventoryItemViewContext } from "../../game/application/inventory/inventory_item_view_context.js";
import { InventoryItemViewFactory } from "../../game/presentation/inventory/inventory_item_view_factory.js";
import { InventoryRuntimeDisplayStatsResolver } from "../../game/application/inventory/inventory_runtime_display_stats_resolver.js";
import { InventoryV2ActionType } from "../../game/presentation/inventory/inventory_view_model.js";
import { InventoryV2CompositionRoot } from "./inventory_composition_root.js";
import { ItemDatabase } from "../../game/application/inventory/item_database.js";
import { LegacyInventorySaveSource } from "../../game/application/inventory/persistence/legacy_inventory_save_source.js";
import { PlayerInventory } from "../../game/application/inventory/player_inventory.js";
import { ROD_CAST_DISPLAY_LABELS } from "../../game/presentation/inventory/rod_cast_display_labels.js";
import { RodCastDisplayStatsWriter } from "../../game/application/inventory/rod_cast_display_stats_writer.js";
import { TackleLoadLimitPolicy } from "../../game/domain/equipment/tackle_load_limit_policy.js";

// Composes the player's inventory: the legacy save seeds Inventory V2 (only when no V2 save exists), item views
// get their runtime context, and PlayerInventory exposes the result to the game.
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
  const legacySave = new LegacyInventorySaveSource({ cache, itemDB, playerConfig, itemFactory }).load();
  const itemViewContext = new InventoryItemViewContext({
    runtimeConfigProvider,
    itemDatabase,
    legacyInventory: legacySave.inventory,
    legacyEquipment: legacySave.equipment,
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
  const inventoryV2 = InventoryV2CompositionRoot.compose({
    cache,
    legacyItems: legacySave.inventory.getAll(),
    legacyEquipment: legacySave.equipment,
    legacySettings: legacySave.settings,
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
  playerInventory = new PlayerInventory({
    inventoryV2,
    actions: InventoryV2ActionType,
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
