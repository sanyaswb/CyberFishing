const path = require("node:path");
const vm = require("node:vm");
const { NativeEsmTestLoader } = require("./testing/runtime/native_esm_test_loader");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({
  console,
  LocalStorageCache: {
    get(_key, fallback) {
      return fallback;
    },
    set() {},
  },
  document: {
    createElement() { return { style: {}, addEventListener() {}, remove() {} }; },
    body: { appendChild() {} },
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

// Migrated classic paths are activation shims (or retired ones): the loader runs the runtime first and renders
// retired activations test-only, so the check keeps naming the same classes.
const files = [
  "src/game/domain/equipment/auto_refill_trigger.js",
  "src/game/domain/equipment/auto_refill_scope.js",
  "src/game/domain/equipment/auto_refill_settings.js",
  "src/game/domain/equipment/auto_refill_memory.js",
  "src/game/domain/equipment/auto_refill_policy.js",
  "src/game/application/inventory/equipment_auto_refill_target_provider.js",
  "src/game/application/inventory/equipment_service.js",
  "src/game/application/fishing/fishing_controller.js",
  "src/game/application/fishing/cast_service.js",
  "src/game/application/fishing/fight_session_factory.js",
  "src/game/application/fishing/fishing_force_service.js",
  "src/game/application/fishing/catch_resolution_service.js",
  "src/game/application/fishing/fight_service.js",
  "src/platform/browser/ui/chum_controls.js",
  "src/game/application/chum/chum_controller.js",
  "src/game/application/chum/chum_zone.js",
  "src/game/application/chum/bait_boat.js",
  "src/game/application/chum/chum_service.js",
  "src/game/application/fishing/bite_system.js",
  "src/game/application/fishing/cast_penalty.js",
];

new NativeEsmTestLoader({ projectRoot: root, context }).loadAll([...files, "src/game/presentation/fishing/fishing_messages.js"]);
// Player-facing chum and casting messages are injected the way GameCompositionRoot injects them.
for (const name of ["ChumController", "CastService"]) {
  if (context[name]) context[name] = require("./testing/runtime/constructor_defaults").bindConstructorDefaults(context[name], { messages: context.FISHING_MESSAGES });
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
  const chumManager = new ChumService(
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
    { cache: LocalStorageCache, configEvents: document, onBoatReturned: (event) => boatReturnEvents.push(event) },
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
    memory: new AutoRefillMemory(),
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
      projector: {
        screenToVirtual(x, y, out = {}) { out.x = x; out.y = y; return out; },
        virtualToScreen(x, y, out = {}) { out.x = x; out.y = y; return out; },
        getScale: () => 1,
        getPerspective: () => ({ scale: 1, squashY: 1 }),
      },
      inventoryUI: { showWarning: (message) => warnings.push(message) },
      fishing,
      location: { chumCastDistance: 100 },
      clock,
      config: { casting: { enabled: true, cancelPowerThreshold: 0, handChumAccuracyPx: 0, travelDelayMinMs: 25, travelDelayMaxMs: 25 } },
      rng: { next: () => 0.5 },
      getViewportSize: () => ({ width: 100, height: 100 }),
      panViewport() {},
      depthUI: { hide() {} },
      getDynamicBounds: () => ({ top: 0, bottom: 100 }),
      getRodVirtualPos: () => ({ x: 0, y: 0 }),
      checkWater: () => true,
      markInvalidCast() {},
      canPlayerCast: () => true,
      getGameStateName: () => "scouting",
      createUi: (onClick) => new ChumControls(onClick),
    });

    controller.toggleAim();
    clock.now = 1_300;
    controller.handleAiming({ pointerDown: true, pointerStart: { x: 50, y: 0 }, pointerCurrent: { x: 50, y: 100 }, clickPos: null }, { top: 0, bottom: 100 }, 1);
    controller.handleAiming({ pointerReleased: true, pointerRelease: { x: 50, y: 100 }, clickPos: null }, { top: 0, bottom: 100 }, 1);

    // Equipment changes while the throw animation is in flight.
    equippedHandChum = {
      id: "new-hand-chum",
      instanceId: "hand-current-instance",
    };
    controller.refreshActiveHandChum();
    clock.now = 1_400;
    controller.handleAiming({ clickPos: null }, { top: 0, bottom: 100 }, 30);

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

  // Cast spam penalty and chum zone bonus curves (Stage 4 cluster 027 hot-loop evidence).
  const castPenalty = new CastPenalty();
  const multipliers = [];
  for (let frame = 0; frame < 120; frame++) {
    if (frame % 20 === 0 && castPenalty.canCast()) castPenalty.registerCast(frame * 100);
    castPenalty.update(100);
    multipliers.push(castPenalty.getBiteChanceMultiplier());
  }
  assertIdentity(Math.min(...multipliers) < 1 && multipliers.every((value) => value >= 0 && value <= 1),
    "cast spam penalty stays a bounded bite multiplier");
  const zoneConfig = { id: "probe_mix", radius: 100, targetFishes: ["carp"], rampUpTimeMs: 1000, peakDurationMs: 1000,
    totalBonusTimeMs: 4000, minBonusDurationHours: 0.001, maxBonus: 2, minBonus: 1.2 };
  // Zones are created by their owner (ChumZone has no global of its own once migrated).
  const flatProjector = { getPerspective: () => ({ scale: 1, squashY: 0.5 }) };
  const zoneManager = new ChumService("zone-probe", { baits: { probe_mix: zoneConfig }, deliveryMethods: { boat: {
    level: 1, statsByLevel: { 1: { maxEnergy: 100 } } } } }, flatProjector, { cache: LocalStorageCache, rng: { next: () => 0.5 },
    now: () => 0 });
  zoneManager.deployBait(50, 50, "probe_mix");
  zoneManager.deployBait(400, 50, "probe_mix");
  const [zone, other] = zoneManager.getZones();
  const bonuses = [];
  for (let step = 0; step <= 14; step++) bonuses.push(zone.updateState(step * 600, 1));
  assertIdentity(bonuses[0] === 1 && bonuses[2] === 2 && bonuses[10] === 1.2 && bonuses[14] === 0 && zone.isExpired &&
    other.getMultiplierAt(400, 50, "carp", flatProjector) >= 1 && zone.checkOverlap(other, flatProjector) === false,
    "chum zone bonus ramps, peaks, decays and expires");
  `,
  context,
);

console.log("Consumable event identity check passed.");
