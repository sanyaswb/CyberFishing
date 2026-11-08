export class BrowserSnapshotTransaction {
  #storage;
  #journalKey;
  #keys;
  constructor({ storage, journalKey, keys }) { this.#storage = storage; this.#journalKey = journalKey; this.#keys = new Set(keys); }
  recover() {
    try {
      const raw = this.#storage.getItem(this.#journalKey);
      if (raw === null) return { ok: true };
      const changes = JSON.parse(raw);
      if (!Array.isArray(changes) || !changes.length || changes.some((entry) =>
        !entry || !this.#keys.has(entry.key) || typeof entry.after !== "string" ||
        !(entry.before === null || typeof entry.before === "string"))) return { ok: false, reason: "invalid_transaction" };
      if (new Set(changes.map((entry) => entry.key)).size !== changes.length) return { ok: false, reason: "invalid_transaction" };
      for (const entry of changes) {
        const current = this.#storage.getItem(entry.key);
        if (current !== entry.before && current !== entry.after) return { ok: false, reason: "stale_revision" };
      }
      for (const entry of changes) this.#storage.setItem(entry.key, entry.after);
      this.#storage.removeItem(this.#journalKey);
      return { ok: true };
    } catch (error) { return { ok: false, reason: "storage_write_failed", error }; }
  }
  commit(changes) {
    const recovered = this.recover();
    if (!recovered.ok) return recovered;
    try {
      if (changes.some((entry) => this.#storage.getItem(entry.key) !== entry.before)) return { ok: false, reason: "stale_revision" };
      this.#storage.setItem(this.#journalKey, JSON.stringify(changes));
      return this.recover();
    } catch (error) { return { ok: false, reason: "storage_write_failed", error }; }
  }
}
