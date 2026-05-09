/** @typedef {{ getEquipped: () => object }} IEquipmentQueries */
class EquipmentRules {
  isSpinning(equipment) {
    return equipment?.rod?.type === "spinning";
  }

  isFeeder(equipment) {
    return equipment?.rod?.type === "feeder";
  }

  requiresReel(equipment) {
    const rod = equipment?.rod;
    if (!rod) return false;
    return rod.hasReel ?? rod.engineStats?.hasReel ?? rod.type !== "pole";
  }

  canSelectDepth(equipment) {
    if (!equipment?.rod) return false;
    if (this.isFeeder(equipment)) return false;
    const firstBait = equipment.baits?.[0];
    return (
      (this.isSpinning(equipment) && firstBait?.type === "jig") ||
      (!this.isSpinning(equipment) && !!equipment.sinker)
    );
  }

  getMaxCastDistance(equipment, fallback = Infinity) {
    return normalizeDistance(equipment?.rod?.maxDistance, fallback);
  }

  getMaxHookDepth(equipment, config) {
    const firstBait = equipment?.baits?.[0];
    if (this.isSpinning(equipment) && firstBait?.type === "jig") {
      return firstBait.engineStats?.maxDepth ?? firstBait.maxDepth ?? 8.0;
    }
    if (equipment?.sinker) {
      return (
        equipment.sinker.engineStats?.maxDepth ??
        equipment.sinker.maxDepth ??
        10.0
      );
    }
    return config.physics?.defaultDepthNoSinker ?? 0.1;
  }
}

class BaitRules {
  isActiveLure(item) {
    const type = item?.type;
    return type === "spinner" || type === "wobbler" || type === "jig";
  }

  hasActiveLureType(types) {
    for (let i = 0; i < types.length; i++) {
      if (this.isActiveLure({ type: types[i] })) return true;
    }
    return false;
  }

  getPhysicsType(item, fallback = "float") {
    if (!item) return fallback;
    const stats = item.engineStats || item;
    return stats.type || item.type || fallback;
  }

  getSinkRate(item, fallback = 1) {
    return item?.sinkSpeed || item?.engineStats?.sinkSpeed || fallback;
  }
}

class CastRules {
  constructor(equipmentRules = new EquipmentRules()) {
    this.equipmentRules = equipmentRules;
  }

  canCastAt(vx, vy, equipment, bounds, rodPos) {
    const maxDistance = this.equipmentRules.getMaxCastDistance(equipment);
    if (maxDistance === Infinity) return true;
    const maxInsideBounds = Math.min(maxDistance, bounds.bottom - bounds.top);
    const castLineY = bounds.bottom - maxInsideBounds;
    return (
      vy >= castLineY &&
      (!rodPos || Math.hypot(vx - rodPos.x, vy - rodPos.y) <= maxDistance)
    );
  }
}

class BiteRules {
  constructor(baitRules = new BaitRules()) {
    this.baitRules = baitRules;
  }

  getHookSize(equipment) {
    return equipment?.hooks?.[0]?.level || equipment?.baits?.[0]?.level || 1;
  }

  selectBiteSequence(fishTemplate, baitTypes) {
    if (!fishTemplate?.biteMechanics) return null;
    return this.baitRules.hasActiveLureType(baitTypes)
      ? fishTemplate.biteMechanics.active
      : fishTemplate.biteMechanics.passive;
  }
}

class ChumRules {
  getDeliveryMethod(equipment) {
    return equipment?.delivery ? "boat" : "hand";
  }

  hasLoadedDeliveryChum(equipment) {
    const chums = equipment?.deliveryChums || [];
    for (let i = 0; i < chums.length; i++) {
      if (chums[i]) return true;
    }
    return false;
  }

  getDeliverySections(deliveryItem) {
    return deliveryItem?.sections ?? deliveryItem?.engineStats?.sections ?? 1;
  }
}

class BoatRules {
  isManual(boatItem) {
    return boatItem?.manualControl ?? true;
  }

  isBusy(boat) {
    return !!boat && boat.state !== "idle";
  }

  canBeRemovedNearShore(boat, bounds) {
    return !!boat && boat.pos.y > bounds.bottom - 200;
  }

  canAcceptManualTarget(boat) {
    return !!boat && boat.state !== "returning";
  }

  canDropManualChum(boat, boatItem) {
    return (
      this.isManual(boatItem) &&
      !!boat &&
      boat.state === "waiting" &&
      boat.remainingSections > 0
    );
  }

  canAutoReturn(boatItem) {
    return (
      boatItem?.hasAutoReturn ?? boatItem?.engineStats?.hasAutoReturn ?? false
    );
  }

  canPlayerCastWithBoat(boat, boatItem) {
    if (!boat) return true;
    if (boat.state === "drifting" || boat.state === "returning") return true;
    return !this.isManual(boatItem) && boat.remainingSections <= 0;
  }
}

class PlayerCastRules {
  constructor(boatRules = new BoatRules()) {
    this.boatRules = boatRules;
  }

  canPlayerCast(equipment, activeBoat) {
    if (!equipment?.rod) return false;
    return this.boatRules.canPlayerCastWithBoat(
      activeBoat,
      equipment?.delivery || {},
    );
  }
}
