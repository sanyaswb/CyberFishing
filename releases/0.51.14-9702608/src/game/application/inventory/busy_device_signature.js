// A comparable reading of devices that are away from the player (spec 151: a bait boat on the water): the delivery
// slot's root and, for every busy root, the root and its attached items (ids, catalog ids, quantities, places).
// An inventory action that changes it would change a boat on the water, so InventoryCommandService rolls it back.
export class BusyDeviceSignature {
  read(rootInstanceIds, repository, equipmentState) {
    const parts = [String(equipmentState.getRootInstanceId("delivery") ?? "")];
    for (const rootInstanceId of rootInstanceIds) {
      const root = repository.get(rootInstanceId);
      parts.push(root ? this.#item(root) : `missing:${rootInstanceId}`);
      if (!root) continue;
      for (const { item } of repository.listDescendants(rootInstanceId)) parts.push(this.#item(item));
    }
    return parts.join("|");
  }

  #item(item) {
    const location = item.location || {};
    return [item.instanceId, item.itemId, item.quantity, location.kind, location.parentInstanceId, location.slotId,
      location.slotIndex].join(",");
  }
}
