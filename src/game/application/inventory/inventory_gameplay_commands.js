import { AutoRefillTrigger } from "../../domain/equipment/auto_refill_trigger.js";
import { inventoryCommandFailure, inventoryCommandSuccess } from "./inventory_command_result.js";

// Inventory changes driven by the fishing game rather than the inventory UI: consuming items and equipped
// slots, line breaks, bait exposure on rod retrieval and auto-refill after retrieval, hand chum use and boat
// return. Each command runs in one inventory transaction.
export class InventoryGameplayCommands {
  #transaction;
  #itemRemoval;
  #repository;
  #assemblyReader;
  #equipmentState;
  #lineAllocationService;
  #autoRefillCoordinator;
  #baitExposureService;
  #hydrator;

  constructor({
    transaction,
    itemRemoval,
    repository,
    assemblyReader,
    equipmentState,
    lineAllocationService,
    autoRefillCoordinator,
    baitExposureService = null,
    hydrator,
  }) {
    this.#transaction = transaction;
    this.#itemRemoval = itemRemoval;
    this.#repository = repository;
    this.#assemblyReader = assemblyReader;
    this.#equipmentState = equipmentState;
    this.#lineAllocationService = lineAllocationService;
    this.#autoRefillCoordinator = autoRefillCoordinator;
    this.#baitExposureService = baitExposureService;
    this.#hydrator = hydrator;
  }

  consumeItem(instanceId, amount = 1) {
    try {
      const consumed = this.#transaction.runAtomic(() =>
        this.#itemRemoval.consume(instanceId, amount),
      );
      return consumed
        ? inventoryCommandSuccess({ consumed: true })
        : inventoryCommandFailure("Предмет не знайдено або його кількості недостатньо.");
    } catch (error) {
      return inventoryCommandFailure(error.message, error);
    }
  }

  consumeEquipped(slotPath, amount = 1, unequipAfterConsume = true) {
    try {
      const consumed = this.#transaction.runAtomic(() => {
        const target = this.#resolveLegacyEquippedTarget(slotPath);
        if (!target?.item?.instanceId) return false;
        const success = this.#itemRemoval.consume(
          target.item.instanceId,
          amount,
        );
        if (success && unequipAfterConsume && this.#repository.has(target.item.instanceId)) {
          this.#itemRemoval.clearEquipmentRootReference(target.rootInstanceId);
        }
        return success;
      });
      return consumed
        ? inventoryCommandSuccess({ consumed: true })
        : inventoryCommandFailure("У вказаній комірці немає предмета для витрати.");
    } catch (error) {
      return inventoryCommandFailure(error.message, error);
    }
  }

  breakEquippedLine(lossMeters) {
    const loss = Math.max(0, Number(lossMeters) || 0);
    try {
      const result = this.#transaction.runAtomic(() => {
        const target = this.#resolveLegacyEquippedTarget("line");
        if (!target?.item?.instanceId) return null;
        const breakResult = this.#lineAllocationService.break(
          target.item.instanceId,
          loss,
        );
        if (breakResult.success && breakResult.depleted) {
          this.#itemRemoval.clearEquipmentRootReference(target.item.instanceId);
        }
        return breakResult;
      });
      return result?.success
        ? inventoryCommandSuccess({ broken: true, breakResult: result })
        : inventoryCommandFailure("Спорядженої ліски немає.");
    } catch (error) {
      return inventoryCommandFailure(error.message, error);
    }
  }

  rodRetrieved(context = {}) {
    try {
      const result = this.#transaction.runAtomic(() => {
        const freshness = this.#baitExposureService?.apply?.({
          instanceIds: context.baitInstanceIds || [],
          exposureMs: context.exposureMs || 0,
          exposureToken: context.exposureToken || null,
        }) || [];
        const report = this.#autoRefillCoordinator.handle(
          AutoRefillTrigger.ROD_RETRIEVED,
          context,
        );
        return { report, freshness };
      });
      this.#baitExposureService?.confirm?.({
        instanceIds: context.baitInstanceIds || [],
        exposureToken: context.exposureToken || null,
      });
      return inventoryCommandSuccess({
        report: result.report,
        freshness: result.freshness,
        warning: result.report.warning,
      });
    } catch (error) {
      return inventoryCommandFailure(error.message, error);
    }
  }

  handChumUsed(context = {}) {
    return this.#runAutoRefill(AutoRefillTrigger.HAND_CHUM_USED, context);
  }

  boatReturned(context = {}) {
    return this.#runAutoRefill(AutoRefillTrigger.BOAT_RETURNED, context);
  }

  // Resolves a classic slot path ("line", "baits_1", "deliveryChums_0", ...) to the equipped item.
  #resolveLegacyEquippedTarget(slotPath) {
    const match = /^(hooks|baits|deliveryChums)_(\d+)$/.exec(slotPath || "");
    const index = match ? Number(match[2]) : 0;
    const tackleRootId = this.#equipmentState.getRootInstanceId("tackle");
    const deliveryRootId = this.#equipmentState.getRootInstanceId("delivery");
    const reelRootId = this.#equipmentState.getRootInstanceId("reel");
    const terminalRootId = this.#equipmentState.getRootInstanceId("terminalLine");

    let item = null;
    let rootInstanceId = null;
    if (slotPath === "line") {
      item = reelRootId
        ? this.#assemblyReader.getChild(reelRootId, "line", 0)
        : this.#repository.get(terminalRootId);
      rootInstanceId = reelRootId || terminalRootId;
    } else if (slotPath === "leader") {
      item = this.#repository.get(terminalRootId);
      rootInstanceId = terminalRootId;
    } else if (slotPath === "feederRig") {
      item = this.#repository.get(tackleRootId);
      rootInstanceId = tackleRootId;
    } else if (slotPath === "feederChum") {
      item = this.#assemblyReader.getChild(tackleRootId, "chum", 0);
      rootInstanceId = tackleRootId;
    } else if (match?.[1] === "hooks") {
      const root = this.#repository.get(tackleRootId);
      item = this.#type(root) === "hook" && index === 0
        ? root
        : this.#assemblyReader.getChild(tackleRootId, "hook", index);
      rootInstanceId = tackleRootId;
    } else if (match?.[1] === "baits") {
      const root = this.#repository.get(tackleRootId);
      if (["lure", "spinner", "wobbler", "jig"].includes(this.#type(root))) {
        item = index === 0 ? root : null;
      } else {
        const hook = this.#type(root) === "hook" && index === 0
          ? root
          : this.#assemblyReader.getChild(tackleRootId, "hook", index);
        item = hook
          ? this.#assemblyReader.getChild(hook.instanceId, "bait", 0)
          : null;
      }
      rootInstanceId = tackleRootId;
    } else if (match?.[1] === "deliveryChums") {
      item = this.#assemblyReader.getChild(deliveryRootId, "cargo", index);
      rootInstanceId = deliveryRootId;
    } else {
      const slotMap = {
        rod: "rod",
        reel: "reel",
        float: "float",
        net: "net",
        delivery: "delivery",
        handChum: "handChum",
      };
      const equipmentSlotId = slotMap[slotPath];
      rootInstanceId = equipmentSlotId
        ? this.#equipmentState.getRootInstanceId(equipmentSlotId)
        : null;
      item = this.#repository.get(rootInstanceId);
    }
    return item ? { item, rootInstanceId } : null;
  }

  #runAutoRefill(trigger, context) {
    try {
      const report = this.#transaction.runAtomic(() =>
        this.#autoRefillCoordinator.handle(trigger, context),
      );
      return inventoryCommandSuccess({ report, warning: report.warning });
    } catch (error) {
      return inventoryCommandFailure(error.message, error);
    }
  }

  #type(rawItem) {
    return this.#hydrator.hydrate(rawItem, this.#repository)?.itemType || null;
  }
}
