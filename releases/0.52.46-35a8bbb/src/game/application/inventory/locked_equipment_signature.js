// Spec 185 D9 (TK-385): a comparable reading of the equipment while the tackle is in the water — every slot's root and
// every root's attached items, except the items attached to the worn gas mask (its filters change while fishing, owner:
// «Змінювати фільтри можна під час риболовлі в інвентарі»). The gas mask itself stays in the reading: it is not put on
// or taken off while fishing. An action allowed under the lock that changes it is rolled back by InventoryCommandService.
export class LockedEquipmentSignature {
  read(repository, equipmentState) {
    const slots = equipmentState.snapshot();
    const maskId = equipmentState.getRootInstanceId("gasMask");
    const parts = [];
    for (const slotId of Object.keys(slots).sort()) {
      const rootInstanceId = slots[slotId];
      parts.push(`${slotId}:${rootInstanceId ?? ""}`);
      if (!rootInstanceId || rootInstanceId === maskId) continue;
      const root = repository.get(rootInstanceId);
      if (root) parts.push(this.#item(root));
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
