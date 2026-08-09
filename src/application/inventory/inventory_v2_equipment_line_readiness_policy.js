/**
 * Checks the line already installed in a prepared reel against a prospective
 * equipment snapshot. This policy is read-only: line allocation and custody
 * remain in their dedicated services.
 */
class InventoryV2EquipmentLineReadinessPolicy {
  #repository;
  #assemblyReader;
  #itemReader;
  #lineAllocationService;

  constructor({
    repository,
    assemblyReader,
    itemReader,
    lineAllocationService,
  } = {}) {
    if (!repository?.get) {
      throw new TypeError(
        "InventoryV2EquipmentLineReadinessPolicy requires an item repository",
      );
    }
    if (!assemblyReader?.getChild) {
      throw new TypeError(
        "InventoryV2EquipmentLineReadinessPolicy requires ItemAssemblyReader",
      );
    }
    if (!lineAllocationService?.validateExisting) {
      throw new TypeError(
        "InventoryV2EquipmentLineReadinessPolicy requires a line allocation service",
      );
    }
    this.#repository = repository;
    this.#assemblyReader = assemblyReader;
    this.#itemReader = itemReader;
    this.#lineAllocationService = lineAllocationService;
  }

  validate(equipmentSnapshot = {}) {
    const snapshot =
      equipmentSnapshot?.rootInstanceIds || equipmentSnapshot || {};
    const reelId = snapshot.reel || null;
    if (!reelId) return this.#valid();

    const reelRaw = this.#repository.get(reelId);
    const rodRaw = this.#repository.get(snapshot.rod || null);
    if (!reelRaw || !rodRaw) return this.#valid();

    const installedLine = this.#assemblyReader.getChild(reelId, "line", 0);
    if (!installedLine) return this.#valid();

    const result = this.#lineAllocationService.validateExisting({
      line: installedLine,
      rod: this.#hydrate(rodRaw),
      reel: this.#hydrate(reelRaw),
    });
    if (!result.success) {
      return Object.freeze({
        isValid: false,
        warningCode: "REEL_LINE_INCOMPATIBLE",
        warning: result.warning || "Ліска в котушці несумісна з вудилищем.",
        allocation: result.allocation || null,
      });
    }
    return this.#valid({ allocation: result.allocation || null });
  }

  #hydrate(raw) {
    if (typeof this.#itemReader === "function") {
      return this.#itemReader(raw) || raw;
    }
    return (
      this.#itemReader?.hydrate?.(raw) ||
      this.#itemReader?.getById?.(raw.instanceId) ||
      this.#itemReader?.get?.(raw.instanceId) ||
      raw
    );
  }

  #valid(details = {}) {
    return Object.freeze({
      isValid: true,
      warningCode: null,
      warning: null,
      ...details,
    });
  }
}

globalThis.InventoryV2EquipmentLineReadinessPolicy =
  InventoryV2EquipmentLineReadinessPolicy;
