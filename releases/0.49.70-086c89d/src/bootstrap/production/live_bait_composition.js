import { CONFIG } from "../../game/config/runtime/game_config.js";
import { FISH_DB } from "../../game/config/databases/fish_database.js";
import { LiveBaitCareService } from "../../game/application/live_bait/live_bait_care_service.js";
import { LiveBaitCommandService } from "../../game/application/live_bait/live_bait_command_service.js";
import { LiveBaitSnapshotStore } from "../../game/application/live_bait/live_bait_snapshot_store.js";
import { BrowserWallClock } from "../../platform/browser/time/browser_wall_clock.js";
import { LiveBaitLocalStore } from "../../platform/browser/storage/live_bait_local_store.js";
import { AquariumCareCalculator } from "../../game/domain/live_bait/aquarium_care_calculator.js";
import { AquariumStarvationPolicy } from "../../game/domain/live_bait/aquarium_starvation_policy.js";
import { BrowserSnapshotTransaction } from "../../platform/browser/storage/browser_snapshot_transaction.js";
import { InventorySnapshotLocalStore } from "../../platform/browser/storage/inventory_snapshot_local_store.js";
import { AquariumFeedInventoryPort } from "../../game/application/live_bait/aquarium_feed_inventory_port.js";

export function composeLiveBait({ storage, clock = new BrowserWallClock(), rng = { next: () => Math.random() },
  config = CONFIG.liveBait, fishDb = FISH_DB, synchronizeInventory = null } = {}) {
  const transaction = new BrowserSnapshotTransaction({ storage, journalKey: "fishing_game_aquarium_feed_transaction_v1",
    keys: [LiveBaitLocalStore.KEY, InventorySnapshotLocalStore.KEY] });
  const inventoryPort = new AquariumFeedInventoryPort({ catalog: config.aquariumFeeds,
    store: new InventorySnapshotLocalStore({ storage, transaction }), synchronize: synchronizeInventory });
  const store = new LiveBaitSnapshotStore(new LiveBaitLocalStore(storage, transaction));
  const care = new LiveBaitCareService({ clock, config,
    calculator: new AquariumCareCalculator(config), starvation: new AquariumStarvationPolicy() });
  return new LiveBaitCommandService({ config, fishDb, store, clock, rng, care, inventoryPort });
}
