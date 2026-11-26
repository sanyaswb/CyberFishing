export class InventorySettingsTransactionParticipant {
  #settings;

  constructor(settings) {
    this.#settings = settings;
  }

  snapshot() {
    return this.#settings.snapshot();
  }

  restore(snapshot = {}) {
    this.#settings
      .setAutoBait(snapshot.autoBait === true)
      .setAutoChum(snapshot.autoChum === true);
  }
}
