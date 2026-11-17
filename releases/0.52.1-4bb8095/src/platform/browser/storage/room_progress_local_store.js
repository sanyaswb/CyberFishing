export class RoomProgressLocalStore {
  #storage;
  #key;

  constructor(storage, key = "cyber_fishing_room_1_v1") {
    this.#storage = storage;
    this.#key = key;
  }

  load() {
    try {
      const value = JSON.parse(this.#storage.getItem(this.#key));
      return value?.version === 1 ? value : null;
    } catch { return null; }
  }

  save(value) {
    try { this.#storage.setItem(this.#key, JSON.stringify(value)); return true; }
    catch { return false; }
  }
}
