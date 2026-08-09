const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({
  console,
  CacheManager: {
    get(_key, fallback) {
      return fallback;
    },
    set() {},
  },
  document: {
    addEventListener() {},
    removeEventListener() {},
  },
  Vector2: class Vector2 {
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
  },
});

vm.runInContext(
  `
  class CastPowerAim {
    constructor() {
      this.released = false;
    }

    reset() {
      this.released = false;
    }

    update() {
      if (this.released) return null;
      this.released = true;
      return { power: 1, screenX: 10, screenY: 20 };
    }

    resolveTarget() {
      return { success: true, travelDelayMs: 25, x: 30, y: 40 };
    }

    getVisualState() {
      return null;
    }

    getAccuracyPreview() {
      return null;
    }
  }

  class ChumUI {
    setState() {}
    dispose() {}
  }
  `,
  context,
);

const files = [
  "src/core/equipment/auto_refill_policy.js",
  "src/application/inventory/equipment_auto_refill_target_provider.js",
  "src/app/inventory.js",
  "src/app/fishing.js",
  "src/app/chum.js",
  "src/systems/chum_system.js",
];

for (const file of files) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, {
    filename: file,
  });
}

vm.runInContext(
  `
  const assertIdentity = (condition, message) => {
    if (!condition) {
      throw new Error("Consumable event identity check failed: " + message);
    }
  };

  // A boat carries its originating assembly identity until the physical
  // return event, independent of the currently equipped delivery item.
  const boatReturnEvents = [];
  const chumManager = new ChumManager(
    "identity-test",
    {
      baits: {},
      deliveryMethods: {
        boat: {
          level: 1,
          statsByLevel: { 1: { maxEnergy: 100 } },
        },
      },
    },
    {},
    { onBoatReturned: (event) => boatReturnEvents.push(event) },
  );
  const tripBoat = chumManager.spawnIdleBoat(0, 0, {
    instanceId: "boat-trip-root",
    level: 1,
    sections: 1,
    statsByLevel: {
      1: { maxEnergy: 100, energyDrainPerSec: 0, speedPxPerSec: 1 },
    },
  });
  tripBoat.remainingSections = 0;
  tripBoat.isFinished = true;
  chumManager.updateBoats(0, null, null, 1, null);
  assertIdentity(
    boatReturnEvents.length === 1 &&
      boatReturnEvents[0].rootInstanceId === "boat-trip-root",
    "boat return event must preserve the trip rootInstanceId",
  );

  const signature = Object.freeze({ itemId: "trip-chum" });
  const assemblyStates = {
    "boat-trip-root": {
      refillSignatures: { "cargo[0]": signature },
    },
    "boat-current-root": {
      refillSignatures: { "cargo[0]": { itemId: "current-chum" } },
    },
  };
  const targetProvider = new EquipmentAutoRefillTargetProvider({
    equipmentState: {
      getRootInstanceId(slotId) {
        return slotId === "delivery" ? "boat-current-root" : null;
      },
    },
    assemblyReader: {
      getAssemblyState(rootInstanceId) {
        return assemblyStates[rootInstanceId] || {};
      },
      readPath() {
        return null;
      },
      getRefillSignature(rootInstanceId, path) {
        return assemblyStates[rootInstanceId]?.refillSignatures?.[path] || null;
      },
    },
  });
  const tripTargets = targetProvider.listTargets(AutoRefillScope.BOAT_CHUM, {
    rootInstanceId: boatReturnEvents[0].rootInstanceId,
  });
  assertIdentity(
    tripTargets.length === 1 &&
      tripTargets[0].rootInstanceId === "boat-trip-root" &&
      tripTargets[0].signature.itemId === "trip-chum",
    "boat refill must target the returned boat instead of current delivery",
  );

  const makeDelayedHandCast = ({ canConsume }) => {
    let equippedHandChum = {
      id: "trip-hand-chum",
      instanceId: "hand-trip-instance",
    };
    const consumedIds = [];
    const refillEvents = [];
    const deployedIds = [];
    const warnings = [];
    const inventory = {
      getEquipped() {
        return { handChum: equippedHandChum, delivery: null };
      },
      consumeItem(instanceId) {
        consumedIds.push(instanceId);
        return canConsume && instanceId === "hand-trip-instance";
      },
      handleHandChumUsed(event) {
        refillEvents.push(event);
      },
    };
    const equipment = new EquipmentService(inventory);
    const fishing = new FishingController({
      inventory,
      equipment,
      devFlags: { isEnabled: () => false },
      equipmentRules: {},
      baitRules: {},
    });
    const clock = { now: 1_000 };
    const controller = new ChumController({
      inventory,
      chum: {
        deployBait(_x, _y, chumId) {
          deployedIds.push(chumId);
        },
        getBoats: () => [],
      },
      projector: {},
      inventoryUI: { showWarning: (message) => warnings.push(message) },
      fishing,
      location: { chumCastDistance: 100 },
      clock,
      config: { casting: { enabled: true, cancelPowerThreshold: 0 } },
      rng: {},
      getViewportSize: () => ({ width: 100, height: 100 }),
      panViewport() {},
      depthUI: { hide() {} },
      getDynamicBounds: () => ({ bottom: 100 }),
      getRodVirtualPos: () => ({ x: 0, y: 0 }),
      checkWater: () => true,
      markInvalidCast() {},
      canPlayerCast: () => true,
      getGameStateName: () => "scouting",
    });

    controller.toggleAim();
    clock.now = 1_300;
    controller.handleAiming({ clickPos: null }, { bottom: 100 }, 1);

    // Equipment changes while the throw animation is in flight.
    equippedHandChum = {
      id: "new-hand-chum",
      instanceId: "hand-current-instance",
    };
    controller.refreshActiveHandChum();
    clock.now = 1_400;
    controller.handleAiming({ clickPos: null }, { bottom: 100 }, 30);

    return { consumedIds, refillEvents, deployedIds, warnings };
  };

  const completedCast = makeDelayedHandCast({ canConsume: true });
  assertIdentity(
    completedCast.consumedIds.join(",") === "hand-trip-instance",
    "delayed hand cast must consume only the captured instanceId",
  );
  assertIdentity(
    completedCast.refillEvents.length === 1 &&
      completedCast.refillEvents[0].consumedInstanceId ===
        "hand-trip-instance",
    "successful exact consumption must emit one matching refill event",
  );
  assertIdentity(
    completedCast.deployedIds.join(",") === "trip-hand-chum",
    "successful delayed cast must deploy the captured chum variant once",
  );

  const infiniteInventory = {
    consumeItem() {
      throw new Error("infinite resources must not mutate inventory");
    },
    handleHandChumUsed() {
      throw new Error("infinite resources must not trigger auto-refill");
    },
  };
  const infiniteFishing = new FishingController({
    inventory: infiniteInventory,
    equipment: new EquipmentService(infiniteInventory),
    devFlags: { isEnabled: () => true },
    equipmentRules: {},
    baitRules: {},
  });
  assertIdentity(
    infiniteFishing.consumeHandChum({ instanceId: "infinite-chum" }) === true,
    "infinite resources must still allow the delayed throw",
  );

  const rejectedCast = makeDelayedHandCast({ canConsume: false });
  assertIdentity(
    rejectedCast.consumedIds.join(",") === "hand-trip-instance" &&
      rejectedCast.deployedIds.length === 0 &&
      rejectedCast.refillEvents.length === 0 &&
      rejectedCast.warnings.length === 1,
    "missing captured item must not consume current chum or create a free zone",
  );
  `,
  context,
);

console.log("Consumable event identity check passed.");
