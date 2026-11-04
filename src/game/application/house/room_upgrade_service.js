import { RoomProgress } from "../../domain/house/room_progress.js";

export class RoomUpgradeService {
  #config;
  #store;
  #now;
  #progress;
  #onProgress;
  #reported = "";

  // onProgress({ level, targetLevel }): the room's levels changed (the load plan opens the art they reach), or null.
  constructor({ config, store, now, onProgress = null }) {
    this.#onProgress = onProgress;
    this.#config = config;
    this.#store = store;
    this.#now = now;
    this.#progress = new RoomProgress(config, store.load());
  }

  getView() {
    this.#reload();
    const now = this.#now();
    if (this.#progress.settle(now)) this.#store.save(this.#progress.snapshot());
    this.#report();
    const { level, targetLevel, endsAt } = this.#progress;
    return { level, targetLevel, endsAt, remainingMs: endsAt === null ? null : Math.max(0, endsAt - now),
      maxLevel: this.#config.maxLevel, nextDurationMs: level < this.#config.maxLevel
        ? this.#config.upgradeDurationMs[level + 1] : null };
  }

  start() {
    this.getView();
    const result = this.#progress.start(this.#now());
    if (result.ok && !this.#store.save(this.#progress.snapshot())) return { ok: false, reason: "save_failed" };
    this.#report();
    return result;
  }

  finish() {
    this.getView();
    const result = this.#progress.finish();
    if (result.ok && !this.#store.save(this.#progress.snapshot())) return { ok: false, reason: "save_failed" };
    this.#report();
    return result;
  }

  #report() {
    const { level, targetLevel } = this.#progress;
    const key = `${level} ${targetLevel}`;
    if (key === this.#reported) return;
    this.#reported = key;
    this.#onProgress?.({ level, targetLevel });
  }

  #reload() { this.#progress = new RoomProgress(this.#config, this.#store.load()); }
}
