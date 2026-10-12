import { CONFIG } from "../../game/config/runtime/game_config.js";
import { FISH_DB } from "../../game/config/databases/fish_database.js";
import { LiveBaitCareService } from "../../game/application/live_bait/live_bait_care_service.js";
import { LiveBaitCommandService } from "../../game/application/live_bait/live_bait_command_service.js";
import { LiveBaitSnapshotStore } from "../../game/application/live_bait/live_bait_snapshot_store.js";
import { BrowserWallClock } from "../../platform/browser/time/browser_wall_clock.js";
import { LiveBaitLocalStore } from "../../platform/browser/storage/live_bait_local_store.js";
import { AquariumCareCalculator } from "../../game/domain/live_bait/aquarium_care_calculator.js";
import { AquariumStarvationPolicy } from "../../game/domain/live_bait/aquarium_starvation_policy.js";

export function composeLiveBait({ storage, clock = new BrowserWallClock(), rng = { next: () => Math.random() },
  config = CONFIG.liveBait, fishDb = FISH_DB } = {}) {
  const store = new LiveBaitSnapshotStore(new LiveBaitLocalStore(storage));
  const care = new LiveBaitCareService({ clock, config,
    calculator: new AquariumCareCalculator(config), starvation: new AquariumStarvationPolicy() });
  return new LiveBaitCommandService({ config, fishDb, store, clock, rng, care });
}
