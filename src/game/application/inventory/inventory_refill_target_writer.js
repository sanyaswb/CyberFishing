import { ItemAssemblyPath } from "../../domain/assemblies/item_assembly_path.js";

export class InventoryRefillTargetWriter {
  #repository;
  #equipmentState;
  #assemblyService;
  #assemblyReader;

  constructor({ repository, equipmentState, assemblyService, assemblyReader } = {}) {
    this.#repository = repository;
    this.#equipmentState = equipmentState;
    this.#assemblyService = assemblyService;
    this.#assemblyReader = assemblyReader;
  }

  fillTarget(target, item) {
    if (target.targetType === "equipment-slot") {
      if (this.#equipmentState.getRootInstanceId(target.slotId)) return false;
      this.#equipmentState.setRootInstanceId(target.slotId, item.instanceId);
      return true;
    }
    if (target.targetType !== "assembly-slot") return false;

    const segments = ItemAssemblyPath.parse(target.path);
    const destination = segments.pop();
    let parentInstanceId = target.rootInstanceId;
    for (const segment of segments) {
      const child = this.#assemblyReader.getChild(
        parentInstanceId,
        segment.slotId,
        segment.slotIndex,
      );
      if (!child) return false;
      parentInstanceId = child.instanceId;
    }
    this.#assemblyService.attach({
      rootInstanceId: target.rootInstanceId,
      parentInstanceId,
      sourceInstanceId: item.instanceId,
      slotId: destination.slotId,
      slotIndex: destination.slotIndex,
    });
    return true;
  }
}
