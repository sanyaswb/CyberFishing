export class EquipmentStateMigrationPolicy {
  static migrate({ equipment = {}, inventoryItems = [], itemDB = {} } = {}) {
    const migrated = { ...(equipment || {}) };
    if (!migrated.feederRigId && migrated.sinkerId) {
      const itemType = this.#getItemType(
        migrated.sinkerId,
        inventoryItems,
        itemDB,
      );
      if (itemType === "feeder_rig") {
        migrated.feederRigId = migrated.sinkerId;
      }
    }
    delete migrated.sinkerId;
    return migrated;
  }

  static #getItemType(instanceId, inventoryItems, itemDB) {
    const instance = inventoryItems.find(
      (item) => item?.instanceId === instanceId,
    );
    if (!instance?.itemId) return null;

    for (const category of Object.values(itemDB || {})) {
      if (!category || typeof category !== "object") continue;
      const item = category[instance.itemId];
      if (item?.itemType) return item.itemType;
    }
    return null;
  }
}
