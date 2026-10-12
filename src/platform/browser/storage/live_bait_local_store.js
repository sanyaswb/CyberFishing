export class LiveBaitLocalStore {
  static KEY = "fishing_game_player_live_bait_v1";
  #storage;
  #transaction;
  constructor(storage, transaction = null) { this.#storage = storage; this.#transaction = transaction; }
  read() {
    const recovered = this.#transaction?.recover();
    if (recovered && !recovered.ok) return recovered;
    try { return { ok: true, raw: this.#storage.getItem(LiveBaitLocalStore.KEY) }; }
    catch (error) { return { ok: false, reason: "storage_read_failed", error }; }
  }
  write(raw, expectedRaw, changes = []) {
    if (changes.length) return this.#transaction.commit([...changes, { key: LiveBaitLocalStore.KEY, before: expectedRaw, after: raw }]);
    try {
      if (this.#storage.getItem(LiveBaitLocalStore.KEY) !== expectedRaw) return { ok: false, reason: "stale_revision" };
      this.#storage.setItem(LiveBaitLocalStore.KEY, raw);
      return { ok: true };
    } catch (error) { return { ok: false, reason: "storage_write_failed", error }; }
  }
}
