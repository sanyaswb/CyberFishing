import { RoomProgress } from "../../domain/house/room_progress.js";

export class RoomUpgradeService {
  #config;
  #store;
  #now;
  #progress;

  constructor({ config, store, now }) {
    this.#config = config;
    this.#store = store;
    this.#now = now;
    this.#progress = new RoomProgress(config, store.load());
  }

  getView() {
    this.#reload();
    const now = this.#now();
    if (this.#progress.settle(now)) this.#store.save(this.#progress.snapshot());
    const { level, targetLevel, endsAt } = this.#progress;
    return { level, targetLevel, endsAt, remainingMs: endsAt === null ? null : Math.max(0, endsAt - now),
      maxLevel: this.#config.maxLevel, nextDurationMs: level < this.#config.maxLevel
        ? this.#config.upgradeDurationMs[level + 1] : null };
  }

  start() {
    this.getView();
    const result = this.#progress.start(this.#now());
    if (result.ok && !this.#store.save(this.#progress.snapshot())) return { ok: false, reason: "save_failed" };
    return result;
  }

  finish() {
    this.getView();
    const result = this.#progress.finish();
    if (result.ok && !this.#store.save(this.#progress.snapshot())) return { ok: false, reason: "save_failed" };
    return result;
  }

  #reload() { this.#progress = new RoomProgress(this.#config, this.#store.load()); }
}
