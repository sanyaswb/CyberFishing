import { GameTimeClock } from "../../game/domain/time/game_time_clock.js";
import { GameTimeLocalStore } from "../../platform/browser/storage/game_time_local_store.js";
import { GAME_TIME_CONFIG } from "../../game/config/raw/time/game_time_config.js";

export function composeGameTime({ storage, now, initialHours, timeScale }) {
  const store = new GameTimeLocalStore(storage);
  let anchor = store.load();
  if (!anchor) {
    anchor = { anchorMs: now(), anchorHours: initialHours ?? GAME_TIME_CONFIG.initialHours, timeScale };
    store.save(anchor);
  }
  return new GameTimeClock({ ...anchor, now, save: (value) => store.save(value), load: () => store.load() });
}
