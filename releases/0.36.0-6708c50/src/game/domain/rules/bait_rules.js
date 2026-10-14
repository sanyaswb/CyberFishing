export class BaitRules {
  isActiveLure(item) {
    return item?.itemType === "lure";
  }

  hasActiveLureType(types) {
    for (let i = 0; i < types.length; i++) {
      if (["lure", "spinner", "wobbler", "jig"].includes(types[i])) {
        return true;
      }
    }
    return false;
  }

  getPhysicsType(item, fallback = "float") {
    if (!item) return fallback;
    return item.variant || item.itemType || fallback;
  }

  getSinkRate(item, fallback = 1) {
    return item?.effectiveStats?.sinkSpeed || fallback;
  }
}
