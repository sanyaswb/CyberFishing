export class FishingController {
  #inventory;
  #equipment;
  #devFlags;
  #equipmentRules;
  #baitRules;
  #logger;

  // logger: the platform diagnostics logger (GodMode notices); without it the notices are skipped.
  constructor({ inventory, equipment, devFlags, equipmentRules, baitRules, debugEvents = null, logger = null }) {
    this.#logger = logger;
    this.#inventory = inventory;
    this.#equipment = equipment;
    this.#devFlags = devFlags;
    this.#equipmentRules = equipmentRules;
    this.#baitRules = baitRules;
  }

  consumeFirstBaitForFight(eq) {
    if (this.#devFlags.isEnabled("infiniteResources")) return false;
    return this.#equipment.consumeFirstBait(eq);
  }

  consumeExpiredFeederChum(eq) {
    return this.#consumeFeederChumLoad(eq);
  }

  consumeWetFeederChum(eq, elapsedMs = Infinity) {
    if (this.#isWithinSafeRecastWindow(eq?.feederChum, elapsedMs)) {
      return false;
    }
    return this.#consumeFeederChumLoad(eq);
  }

  #consumeFeederChumLoad(eq) {
    if (!this.#equipmentRules.isFeeder(eq) || !eq?.feederChum) return false;
    if (this.#devFlags.isEnabled("infiniteResources")) return false;
    return this.#equipment.consumeFeederChum(eq, true);
  }

  #isWithinSafeRecastWindow(chum, elapsedMs) {
    if (!chum || !Number.isFinite(elapsedMs)) return false;
    const safeWindowMs =
      chum.effectiveStats?.safeRecastWindowMs ??
      chum.effectiveStats?.feederSafeRecastWindowMs ??
      chum.effectiveStats?.recastGraceMs ??
      0;
    return safeWindowMs > 0 && elapsedMs <= safeWindowMs;
  }

  consumeHandChum(chum) {
    if (this.#devFlags.isEnabled("infiniteResources")) return true;
    if (!chum?.instanceId) return false;
    const consumed =
      this.#equipment.consumeHandChum?.(chum.instanceId) || false;
    if (consumed) {
      this.#inventory.handleHandChumUsed?.({
        consumedInstanceId: chum.instanceId,
      });
    }
    return consumed;
  }

  consumeDeliveryChum(slotIndex) {
    if (this.#devFlags.isEnabled("infiniteResources")) return false;
    return this.#equipment.consumeDeliveryChum(slotIndex);
  }

  collectAvailableBaits(eq, eatenBaits, outCandidates) {
    outCandidates.length = 0;

    const hooks = eq?.hooks || [];
    const baits = eq?.baits || [];
    const eaten = eatenBaits || [];
    for (let i = 0; i < baits.length; i++) {
      const hook = hooks[i];
      const bait = baits[i];
      if (!bait) continue;

      // A lure, spinner, wobbler or jig is the terminal tackle itself, so the
      // canonical item is a valid candidate without a separate hook child.
      const isSelfContainedLure = this.#baitRules.isActiveLure(bait);
      if (!hook && !isSelfContainedLure) continue;

      let isEaten = false;
      for (let j = 0; j < eaten.length; j++) {
        if (eaten[j].instanceId === bait.instanceId) {
          isEaten = true;
          break;
        }
      }

      if (!isEaten) {
        outCandidates.push(bait);
      }
    }
  }

  applyFailureEquipmentLoss(reason, eq, failure = {}) {
    if (this.#devFlags.isEnabled("noEquipmentLoss")) {
      this.#logger?.log(
        "%c[GOD MODE] 🛡️ Снасті та наживку врятовано від втрати!",
        "color: #00ff00;",
      );
      return;
    }

    if (
      reason === "rod" ||
      reason === "line" ||
      reason === "leader" ||
      reason === "reel" ||
      reason === "hook" ||
      reason === "net_escape"
    ) {
      this.#equipment.consumeAllBaits(eq);
    }

    if (reason === "leader") {
      this.#equipment.consumeAllHooks(eq);
    }

    if (reason === "rod" || reason === "line" || reason === "reel") {
      this.#equipment.consumeAllHooks(eq);
      this.#equipment.consumeFloat(eq);
      this.#equipment.consumeFeederRig(eq);
      this.#consumeFeederChumLoad(eq);
    }

    if (reason === "rod" && eq?.rod) {
      this.#equipment.consumeRod(eq);
    }

    if (reason === "leader" && eq?.leader) {
      this.#equipment.consumeLeader(eq);
    }

    if (reason === "line" && eq?.line) {
      const lineLossMeters = Math.max(0, Number(failure?.lineLossMeters) || 0);
      if (!this.#equipment.breakEquippedLine(lineLossMeters)) {
        this.#equipment.consumeLine(eq);
      }
    }
  }

  tryConsumeBaitDuringBite(eq, stepInfo, rng, physicsConfig) {
    if (!stepInfo?.isAction) return false;

    let consumedBaitId = null;
    const hooks = eq?.hooks || [];
    const baits = eq?.baits || [];
    for (let i = 0; i < baits.length; i++) {
      if (hooks[i] && baits[i]?.itemType === "bait") {
        consumedBaitId = baits[i].instanceId;
        break;
      }
    }

    if (!consumedBaitId) return false;

    const lossChance = stepInfo.isGuaranteed
      ? (physicsConfig.baitLossChance?.guaranteed ?? 0.5)
      : (physicsConfig.baitLossChance?.normal ?? 0.15);

    if (!rng.chance(lossChance)) return false;

    if (this.#devFlags.isEnabled("noEquipmentLoss")) {
      this.#logger?.log(
        "%c[GOD MODE] 🛡️ Риба намагалась вкрасти наживку, але Бог не дозволив!",
        "color: #00ff00;",
      );
    } else {
      this.#equipment.consumeFirstBait(eq);
    }

    return true;
  }
}
