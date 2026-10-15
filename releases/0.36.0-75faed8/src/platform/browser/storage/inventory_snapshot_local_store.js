export class InventorySnapshotLocalStore {
  static KEY = "fishing_game_player_inventory_v2";
  #storage;
  #transaction;
  constructor({ storage, transaction }) { this.#storage = storage; this.#transaction = transaction; }
  read() {
    const recovered = this.#transaction.recover();
    if (!recovered.ok) return recovered;
    try { return { ok: true, raw: this.#storage.getItem(InventorySnapshotLocalStore.KEY), key: InventorySnapshotLocalStore.KEY }; }
    catch (error) { return { ok: false, reason: "storage_read_failed", error }; }
  }
}
