import { EQUIPMENT_MAIN_SLOT_IDS } from "../../domain/equipment/equipment_slot_catalog.js";
import { EquipmentLoadout } from "../../domain/loadouts/equipment_loadout.js";

export class LoadoutApplicationService {
  #messages;
  #port;
  #capacityPolicy;
  #transitionPlanner;
  #mainSlotIds;
  #equipmentActivationValidator;
  #now;

  constructor({
    messages,
    port,
    capacityPolicy = null,
    transitionPlanner = null,
    mainSlotIds = null,
    equipmentActivationValidator = null,
    now = null,
  } = {}) {
    this.#messages = messages;
    if (!port || typeof port.runAtomic !== "function") {
      throw new TypeError("LoadoutApplicationService requires LoadoutApplicationPort");
    }
    this.#port = port;
    this.#capacityPolicy = capacityPolicy;
    this.#mainSlotIds = [
      ...(mainSlotIds || EQUIPMENT_MAIN_SLOT_IDS),
    ];
    this.#transitionPlanner = transitionPlanner;
    this.#equipmentActivationValidator = equipmentActivationValidator;
    this.#now = now;
  }

  createFromEquipment({ loadoutId, name, equipmentState, capacityContext = {} } = {}) {
    const rootInstanceIds = this.#mainAssignments(equipmentState);
    const containedRoots = Object.values(rootInstanceIds).filter(Boolean);
    if (containedRoots.length === 0) {
      return Object.freeze({ success: false, warning: this.#messages.noEquipmentForLoadout });
    }
    for (const instanceId of containedRoots) {
      const owner = this.#port.getRootOwner?.(instanceId);
      if (owner?.kind === "loadout" && owner.loadoutId !== loadoutId) {
        return Object.freeze({
          success: false,
          warning: this.#messages.itemInAnotherLoadout,
        });
      }
    }

    const capacity = this.#capacityPolicy.evaluateTransition({
      incomingRootInstanceIds: [],
      outgoingRootInstanceIds: [],
      incomingConceptualCellCount: 1,
      reason: "create-loadout",
      ...capacityContext,
    });
    if (capacity.allowed === false) {
      return Object.freeze({ success: false, warning: capacity.warning || null });
    }

    const loadout = new EquipmentLoadout({ loadoutId, name, rootInstanceIds, now: this.#now });
    try {
      this.#port.runAtomic(() => {
        for (const slotId of this.#mainSlotIds) {
          const instanceId = rootInstanceIds[slotId];
          if (instanceId) {
            this.#port.assignRootToLoadout(instanceId, loadoutId, slotId);
          }
        }
        this.#port.saveLoadout(loadout);
      });
      return Object.freeze({ success: true, loadout, warning: null });
    } catch (error) {
      return Object.freeze({ success: false, warning: error.message, error });
    }
  }

  equip({ loadout, equipmentState, capacityContext = {} } = {}) {
    const plan = this.#transitionPlanner.plan({
      loadout,
      equipmentState,
      capacityContext,
    });
    if (!plan.allowed) {
      return Object.freeze({ success: false, warning: plan.warning, plan });
    }
    const readiness = this.#validateEquipmentActivation(plan.after);
    if (readiness.isValid === false) {
      return Object.freeze({
        success: false,
        warning: readiness.warning || null,
        readiness,
        plan,
      });
    }
    const before = equipmentState.snapshot();
    try {
      this.#port.runAtomic(() => {
        // Publish the post-transition equipment aggregate before cleanup so an
        // outgoing loose root is no longer reserved and can safely merge back
        // into inventory. The aggregate transaction restores this snapshot on
        // any later failure.
        equipmentState.restore(plan.after);
        for (const movement of plan.movements) {
          this.#port.applyEquipmentMovement(movement);
        }
        this.#port.commitEquipmentState(equipmentState.snapshot());
      });
      return Object.freeze({ success: true, warning: null, plan });
    } catch (error) {
      equipmentState.restore(before);
      return Object.freeze({ success: false, warning: error.message, error, plan });
    }
  }

  disassemble({ loadout, equipmentState, capacityContext = {} } = {}) {
    if (!loadout || typeof loadout.getRootInstanceIds !== "function") {
      throw new TypeError("LoadoutApplicationService.disassemble requires EquipmentLoadout");
    }
    const roots = loadout.getRootInstanceIds();
    const rootIds = Object.values(roots).filter(Boolean);
    const capacity = this.#capacityPolicy.evaluateTransition({
      incomingRootInstanceIds: rootIds,
      outgoingRootInstanceIds: [],
      outgoingConceptualCellCount: 1,
      reason: "disassemble-loadout",
      ...capacityContext,
    });
    if (capacity.allowed === false) {
      return Object.freeze({ success: false, warning: capacity.warning || null });
    }

    const before = equipmentState.snapshot();
    const after = { ...before };
    for (const slotId of this.#mainSlotIds) {
      if (roots[slotId] && after[slotId] === roots[slotId]) after[slotId] = null;
    }
    try {
      this.#port.runAtomic(() => {
        // Both ownership sources must release the roots before terminal-line
        // cleanup: EquipmentState owns activity and the loadout owns custody.
        equipmentState.restore(after);
        this.#port.removeLoadout(loadout.loadoutId);
        for (const slotId of this.#mainSlotIds) {
          const instanceId = roots[slotId];
          if (instanceId) {
            this.#port.releaseRootFromLoadout(
              instanceId,
              loadout.loadoutId,
              slotId,
            );
          }
        }
        this.#port.commitEquipmentState(equipmentState.snapshot());
      });
      return Object.freeze({ success: true, warning: null });
    } catch (error) {
      equipmentState.restore(before);
      return Object.freeze({ success: false, warning: error.message, error });
    }
  }

  #mainAssignments(equipmentState) {
    if (typeof equipmentState?.getMainRootInstanceIds === "function") {
      return equipmentState.getMainRootInstanceIds();
    }
    const source = equipmentState?.rootInstanceIds || equipmentState || {};
    const result = {};
    for (const slotId of this.#mainSlotIds) result[slotId] = source[slotId] || null;
    return result;
  }

  #validateEquipmentActivation(snapshot) {
    if (!this.#equipmentActivationValidator) return { isValid: true };
    const result =
      typeof this.#equipmentActivationValidator === "function"
        ? this.#equipmentActivationValidator(snapshot)
        : this.#equipmentActivationValidator.validate?.(snapshot);
    return result || { isValid: true };
  }
}
