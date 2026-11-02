export class RoomProgress {
  #level;
  #targetLevel;
  #endsAt;
  #config;

  constructor(config, snapshot = null) {
    this.#config = config;
    const level = snapshot?.level;
    this.#level = Number.isInteger(level) && level >= config.initialLevel && level <= config.maxLevel
      ? level : config.initialLevel;
    const target = snapshot?.targetLevel;
    const endsAt = snapshot?.endsAt;
    this.#targetLevel = Number.isInteger(target) && target === this.#level + 1 &&
      target <= config.maxLevel && Number.isFinite(endsAt) && endsAt >= 0 ? target : null;
    this.#endsAt = this.#targetLevel === null ? null : endsAt;
  }

  get level() { return this.#level; }
  get targetLevel() { return this.#targetLevel; }
  get endsAt() { return this.#endsAt; }

  start(now) {
    if (this.#targetLevel !== null) return { ok: false, reason: "already_upgrading" };
    if (this.#level >= this.#config.maxLevel) return { ok: false, reason: "max_level" };
    const nextLevel = this.#level + 1;
    this.#targetLevel = nextLevel;
    this.#endsAt = now + this.#config.upgradeDurationMs[nextLevel];
    return { ok: true };
  }

  finish() {
    if (this.#targetLevel === null) return { ok: false, reason: "not_upgrading" };
    this.#level = this.#targetLevel;
    this.#targetLevel = null;
    this.#endsAt = null;
    return { ok: true };
  }

  settle(now) {
    return this.#endsAt !== null && now >= this.#endsAt ? this.finish().ok : false;
  }

  snapshot() { return { version: 1, level: this.#level, targetLevel: this.#targetLevel, endsAt: this.#endsAt }; }
}
