"use strict";

// Depth-limited, cycle-safe snapshot: classes are tagged, functions named, non-finite numbers spelled out.
const encode = (value, seen = new Set(), depth = 0) => {
  if (value === undefined) return "#undefined";
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : `#${value}`;
  if (typeof value === "function") return `#function:${value.name || "anonymous"}`;
  if (typeof value !== "object") return `#${typeof value}`;
  if (seen.has(value)) return "#cycle";
  if (depth > 5) return `#depth:${value.constructor?.name || "Object"}`;
  seen.add(value);
  let result;
  if (Array.isArray(value)) result = value.map(item => encode(item, seen, depth + 1));
  else if (value instanceof Map) result = { $map: [...value.entries()].map(entry => encode(entry, seen, depth + 1)) };
  else if (value instanceof Set) result = { $set: [...value].map(item => encode(item, seen, depth + 1)) };
  else {
    result = {};
    const name = value.constructor?.name;
    if (name && name !== "Object") result.$class = name;
    if (Object.isFrozen(value)) result.$frozen = true;
    for (const key of Object.keys(value).sort()) result[key] = encode(value[key], seen, depth + 1);
  }
  seen.delete(value);
  return result;
};
const attempt = action => {
  try { return { value: encode(action()) }; } catch (error) { return { error: error.name }; }
};
const methods = Type => Object.getOwnPropertyNames(Type.prototype).sort();
const rng = (seed = 7) => {
  let state = seed;
  return { next: () => { state = (state * 9301 + 49297) % 233280; return state / 233280; },
    range: (min, max) => { state = (state * 9301 + 49297) % 233280; return min + (state / 233280) * (max - min); } };
};
const logger = () => ({ lines: [], log(...args) { this.lines.push(["log", ...args]); },
  warn(...args) { this.lines.push(["warn", ...args]); }, error(...args) { this.lines.push(["error", ...args]); } });
// Calls each [method, ...args] on a fresh instance and records every result and the public state after.
const exercise = (make, calls) => attempt(() => {
  const instance = make();
  const results = calls.map(([name, ...args]) => [name, attempt(() =>
    typeof instance[name] === "function" ? instance[name](...args) : instance[name])]);
  return { results, state: instance };
});

const FISH = {"id":"crucian_stalker","name":"Карась-сталкер","baseChance":0.02,"maxHookSize":6,"trophyWeightKg":1,"visual":{"imagePattern":"assets/fish/crucian_stalker/standart/crucian_stalker--{level}.webp","uniqueImagePattern":"assets/fish/crucian_stalker/unique/crucian_stalker--{level}-uniq.webp"},"anomalyVariant":{"enabled":true,"anomalyId":"inside","chance":0.01,"locationIds":["test"]},"weatherMultipliers":{"rain":1.5,"fog":1.2},"depthConfig":{"minDepth":0.5,"maxDepth":11,"minWeightAtMinDepth":0.05,"maxWeightAtMinDepth":0.3,"minWeightAtMaxDepth":0.751,"maxWeightAtMaxDepth":5,"chanceMultAtMaxDepth":0.2},"weightConfig":{"rarityCurve":1,"maxLevel":6,"levelWeightRanges":[{"level":1,"min":0.05,"max":0.25,"basePower":1},{"level":2,"min":0.251,"max":0.75,"basePower":1},{"level":3,"min":0.751,"max":1.5,"basePower":1},{"level":4,"min":1.501,"max":2.5,"basePower":1},{"level":5,"min":2.501,"max":3.5,"basePower":1},{"level":6,"min":3.501,"max":5,"basePower":1}]},"baitMultipliers":{"oil_worm":1,"bread":1},"timeMultipliers":{"morning":1,"day":1,"evening":1,"night":1},"dayMultipliers":{"0":1,"1":1,"2":1,"3":1,"4":1,"5":1,"6":1},"physics":{"forceProfile":{"basePower":1},"staminaProfile":{"baseStamina":1000},"movementProfile":{"baseSpeed":1,"agility":0.2,"bounceCooldownMs":2000,"dirChangeMinMs":500,"dirChangeMaxMs":1500,"radialRange":[-0.3,1],"lateralRange":[-1,1],"lastDashTrigger":{"enabled":true,"targetState":"lastDash","chance":0.5,"checkIntervalMs":1000,"catchZoneMultiplier":2,"stayUntilLeaveZone":false}},"behaviorProfile":{"behaviors":{"idle":{"forceMultiplier":0.7,"speedMultiplier":1,"agility":0.35,"minTime":500,"maxTime":3000,"weight":25},"rest":{"forceMultiplier":0.3,"speedMultiplier":0.5,"agility":0.25,"minTime":500,"maxTime":2500,"weight":25},"swim":{"forceMultiplier":1,"speedMultiplier":1,"agility":0.45,"minTime":2000,"maxTime":4000,"weight":25},"dash":{"forceMultiplier":1.2,"speedMultiplier":1.5,"direction":{"radialRange":[0.75,1],"lateralRange":[-0.55,0.55],"agility":0.8},"minTime":1000,"maxTime":2200,"weight":25},"lastDash":{"enabled":true,"forceMultiplier":1.5,"speedMultiplier":2,"direction":{"radialRange":[0.85,1],"lateralRange":[-0.35,0.35],"agility":1},"minTime":1000,"maxTime":3000,"weight":0,"dirChangeMinMs":500,"dirChangeMaxMs":1000,"agility":1}}}},"biteMechanics":{"passive":{"maxSequences":[1,5],"sequenceIntervalMs":[1555,5333],"chanceGuaranteed":0.4,"chanceNormal":0.6,"normalIters":[1,6],"guaranteedIters":[1,3],"intervalMs":[400,1100],"animDurationMs":[300,800],"movementChance":0.4,"movementSpeedPx":[2,4],"movementDurationMs":[1000,2500],"animations":{"bob":{"heightPercent":[-5,5]},"sink":{"heightPercent":[-50,-10]},"rise":{"heightPercent":[10,30]},"tilt":{"angle":[-25,25]},"slide":{}},"guaranteedModifiers":{"bobAmpAdd":10,"sinkHeightPercent":[-100,-80],"riseHeightPercent":[30,70],"holdDurationMs":[1000,2500],"tiltAngle":[85,90],"movementSpeedMult":[4,3],"movementDurationMult":[2,2]}}}};
const STAMINA_FISH = {"baseStamina":500,"baseStaminaMultiplier":50,"flatBonus":500,"staminaRatioFromEndurance":0.1,"staminaBossMultiplier":1.5};

const fightContext = { dtMs: 16, dt: 16, isPulling: true, tensionKg: 2, distanceMeters: 8, playerPullDirection: { x: 0, y: 1 },
  fishPosition: { x: 10, y: 20 }, rodTipPosition: { x: 0, y: 0 } };

const EXECUTABLE_CASES = Object.freeze({
  FISH_FIGHT_EVENT: Object.freeze({
    "frozen-fight-event-table": table => ({ table, frozen: Object.isFrozen(table), keys: Object.keys(table) }),
  }),
  FishPhysicsProfile: Object.freeze({
    "physics-profile-from-raw-and-runtime-config": Profile => ({ methods: methods(Profile),
      statics: Object.getOwnPropertyNames(Profile).sort(),
      from: [attempt(() => Profile.from(FISH.physics)), attempt(() => Profile.from(null)), attempt(() => Profile.from({}))],
      runtime: [attempt(() => Profile.toRuntimeConfig(FISH.physics)), attempt(() => Profile.toRuntimeConfig({})),
        attempt(() => new Profile(FISH.physics).toRuntimeConfig?.({ basePower: 2 }))],
      created: exercise(() => new Profile(FISH.physics), methods(Profile).filter(name => name !== "constructor")
        .map(name => [name])) }),
  }),
  Fish: Object.freeze({
    "fish-power-speed-mastery-and-behavior-frames": FishClass => {
      const make = (level, weight) => new FishClass(level, weight, FISH.physics, rng(level * 3 + 1), logger());
      const frames = level => attempt(() => {
        const fish = make(level, 0.8 * level);
        const trace = [];
        for (let frame = 0; frame < 40; frame += 1) {
          trace.push(encode(fish.getBehavior?.(16, frame % 10 === 0 ? 0.2 : 0)));
          if (frame === 10) fish.applyPowerDebuff?.(0.3, "fixture");
          if (frame === 20) fish.setMasteryMultiplier?.(1.2);
          if (frame === 30) fish.clearMasteryDebuff?.();
        }
        return { trace, power: [fish.getPower(), fish.getPowerBeforeMastery(), fish.getPowerDebuff()], weight: fish.getWeight() };
      });
      const simple = methods(FishClass).filter(name => /^(get|has|is)[A-Z]/u.test(name) && name !== "getBehavior");
      return { methods: methods(FishClass), frames: [1, 3, 6].map(frames),
        reads: [1, 4].map(level => exercise(() => make(level, level), simple.map(name => [name, 50]))),
        invalid: [attempt(() => new FishClass(1, 1, null, rng())), attempt(() => new FishClass(undefined, undefined, {}, rng()))] };
    },
  }),
  FishBehavior: Object.freeze({
    "behavior-state-machine-updates-and-fight-events": Behavior => {
      const run = seed => attempt(() => {
        const behavior = new Behavior(FISH.physics, rng(seed), logger());
        const trace = [];
        for (let frame = 0; frame < 60; frame += 1) {
          trace.push(encode(behavior.update?.(16, { ...fightContext, frame })));
          if (frame === 15) trace.push(encode(behavior.reactToWall?.("left")));
          if (frame === 25) trace.push(encode(behavior.handleFightEvent?.({ type: "catch_zone_entered" })));
          if (frame === 35) trace.push(encode(behavior.forceState?.("rest")));
          if (frame === 45) trace.push(encode(behavior.evaluateLastDashTrigger?.({ ...fightContext, stamina: 0.1 })));
        }
        return { trace, state: encode(behavior.getStateData?.()), dash: encode(behavior.getLastDashDebugData?.()) };
      });
      return { methods: methods(Behavior), runs: [3, 11, 29].map(run), invalid: attempt(() => new Behavior(null, rng())) };
    },
  }),
  FishCondition: Object.freeze({
    "stamina-exhaustion-damage-and-regen": Condition => {
      const make = (level, weight) => new Condition(level, weight, STAMINA_FISH, FISH.physics, { maxLevel: 6 });
      const run = (level, weight) => exercise(() => make(level, weight), [
        ["maxStamina"], ["currentStamina"], ["maxEndurance"], ["phase"], ["applyStaminaDamage", 120],
        ["applyStaminaRegen", 30], ["applyStaminaDamage", 100000], ["phase"], ["applyExhaustionDamage", 15],
        ["applyExhaustionRegen", 5, 0.5], ["applyExhaustionStaminaRegen", 10], ["currentExhaustion"], ["breakExhaustion"],
        ["restoreFull"], ["currentStamina"], ["hasActiveDebuff"], ["activeDebuffName"], ["maxPoints"],
        ...methods(Condition).filter(name => /^(get|is|has)[A-Z]/u.test(name)).map(name => [name])]);
      return { methods: methods(Condition), runs: [[1, 0.2], [3, 1.5], [6, 4]].map(([level, weight]) => run(level, weight)),
        noPhysics: exercise(() => new Condition(2, 1, STAMINA_FISH), [["maxStamina"], ["maxEndurance"]]) };
    },
  }),
  FishEndurancePointsCalculator: Object.freeze({
    "endurance-points-by-level-weight-and-physics": Calculator => ({ methods: methods(Calculator),
      results: [[1, 0.2], [3, 1.5], [6, 4], [0, 0]].map(([level, weight]) => attempt(() =>
        new Calculator().calculate({ level, weight, fishPhysics: FISH.physics, maxLevel: 6, config: STAMINA_FISH }))),
      empty: attempt(() => new Calculator().calculate({})) }),
  }),
  FishStaminaPointsCalculator: Object.freeze({
    "stamina-points-by-level-weight-and-config": Calculator => ({ methods: methods(Calculator),
      results: [[1, 0.2, 100], [3, 1.5, 500], [6, 4, 900]].map(([level, weight, endurance]) => attempt(() =>
        new Calculator().calculate({ level, weight, enduranceMax: endurance, maxEndurance: endurance,
          staminaConfig: STAMINA_FISH, config: STAMINA_FISH, fishPhysics: FISH.physics, maxLevel: 6 }))),
      empty: attempt(() => new Calculator().calculate({})) }),
  }),
  Equipment: Object.freeze({
    "equipment-power": Equipment => ({ methods: methods(Equipment),
      powers: [[1, 2], [5, 0.5], [0, 0], [undefined, undefined]].map(([level, power]) =>
        attempt(() => new Equipment(level, power).getPower())) }),
  }),
  Rod: Object.freeze({
    "rod-stats-and-load-limits": Rod => {
      const calls = methods(Rod).filter(name => name !== "constructor").map(name => [name]);
      return { methods: methods(Rod), rods: [
        exercise(() => new Rod(3, 2, 0.1, "float_match", 40, true, { lengthMeters: 4, castPowerCoefficient: 0.8,
          maxLoadKg: 6, durability: 70, durabilityMaxLoadLossPerPercent: 0.01, holdTensionRatio: 0.9 }), calls),
        exercise(() => new Rod(1, 1, 0, "pole", Infinity, false, {}), calls),
        exercise(() => new Rod(2, 3, -1, "spinning", 0, true, { lengthMeters: "x", maxLoadKg: null }), calls),
        exercise(() => new Rod(), calls)] };
    },
  }),
  Reel: Object.freeze({
    "reel-retrieve-drag-and-hold-stats": Reel => {
      const calls = methods(Reel).filter(name => name !== "constructor").map(name => [name]);
      const runtimeConfig = { fightPhysicsConfig: { getReelConfig: () => ({ bearingRetrieveSpeedBonusMetersPerSec: 0.05 }) } };
      return { methods: methods(Reel), reels: [
        exercise(() => new Reel(3, 2, { maxLoadKg: 8, lineCapacityMeters: 120, retrieveSpeedMetersPerSec: 1.1, bearingCount: 5,
          dragMinKg: 0.5, dragMaxKg: 6, dragChangeSpeedPerSec: 2, durability: 50, holdConfig: { enabled: true },
          runtimeConfig }), calls),
        exercise(() => new Reel(1, 1, {}), calls),
        exercise(() => new Reel(2, 2, { bearingCount: "x", hasDrag: false, runtimeConfig }), calls)] };
    },
  }),
  Hook: Object.freeze({
    "hook-power-and-load": Hook => {
      const calls = methods(Hook).filter(name => name !== "constructor").map(name => [name]);
      return { methods: methods(Hook), hooks: [
        exercise(() => new Hook({ hookPowerGrade: 3, weight: 2, quality: 4, maxLoadKg: 5, durability: 60 }), calls),
        exercise(() => new Hook(), calls),
        exercise(() => new Hook({}, { powerPolicy: { resolve: input => input.hookPowerGrade * 10 } }), calls)] };
    },
  }),
  Net: Object.freeze({
    "net-reach-trigger-zone-and-catch-chance": Net => {
      const config = { active: true, lengthMeters: 3, maxWeight: 2, quality: 3,
        chances: [{ min: 0, max: 50, chance: 70 }, { min: 50, max: null, chance: 20, openEnded: true }] };
      const calls = [["isActive"], ["getReachMeters"], ["getReachPixels"], ["virtualReach"], ["getMaxWeight"],
        ["getTriggerVirtualY", 600], ["isFloatInZone", 590, 600], ["isFloatInZone", 100, 600],
        ...[0.5, 2, 2.5, 4, 10].map(weight => ["calculateCatchChance", weight])];
      return { methods: methods(Net), nets: [exercise(() => new Net(config, { pixelsPerMeter: 40 }), calls),
        exercise(() => new Net(null), calls), exercise(() => new Net({ active: true, maxWeight: 0 }, null,
          { getCatchChanceBonusPercent: () => 5 }), calls)] };
    },
  }),
  WaterEntity: Object.freeze({
    "water-entity-forces-depth-and-bite": Entity => exercise(() =>
      new Entity(100, 200, { type: "day", maxDepth: 4, friction: 0.8, waterFriction: 0.1 }, 4, rng(5)), [
      ["getPosition"], ["getVelocity"], ["setVelocity", 2, -1], ["applyForce", { x: 1, y: 0.5 }], ["setHookDepth", 1.5],
      ["getCurrentHookDepth"], ["getEffectiveHookDepth", 3], ["getEffectiveLineLength", 3], ["isBottomLocked"],
      ["setPosition", 50, 60], ["isGuaranteedBite"], ["isHooked"], ["isBiting"], ["getBiteStepInfo"], ["getVisualState"],
      ["startBite", false], ["updateBite", 16], ["stopBite"], ["hook"], ["isHooked"]]),
  }),
  ...Object.fromEntries([["FloatEntity", "float"], ["FeederEntity", "feeder"], ["SpinnerEntity", "spinner"],
    ["WobblerEntity", "wobbler"], ["JigEntity", "jig"]].map(([name, type]) => [name, Object.freeze({
    [`${type}-entity-cast-update-and-visual-state`]: Entity => {
      const run = seed => attempt(() => {
        const entity = new Entity(300, 400, { type, maxDepth: 5, friction: 0.85, waterFriction: 0.2, sinkSpeed: 1,
          weight: 2, castDistance: 10 }, 5, rng(seed));
        const trace = [encode(attempt(() => entity.cast?.(320, 380, { x: 0, y: 0 })))];
        const bounds = { x: 0, y: 0, width: 1280, height: 720, w: 1280, h: 720 };
        for (let frame = 0; frame < 30; frame += 1) {
          trace.push(encode(attempt(() => entity.update(bounds, 16, { windX: 0.1, time: 12 }, () => true,
            { isPulling: frame % 7 === 0 }, frame % 7 === 0 ? 1 : 0, frame % 7 === 0 ? { x: 0, y: 1 } : null))));
        }
        trace.push(encode(attempt(() => entity.getVisualState())), encode(attempt(() => entity.getPosition())),
          encode(attempt(() => entity.getEffectiveHookDepth(4))), encode(attempt(() => entity.isBottomLocked())));
        if (typeof entity.getChumBonus === "function") trace.push(encode(attempt(() => entity.getChumBonus(1000, {}))));
        return trace;
      });
      return { methods: methods(Entity), runs: [2, 9].map(run) };
    },
  })])),
  BaitFactory: Object.freeze({
    "bait-factory-types": Factory => ({ statics: Object.getOwnPropertyNames(Factory).sort(),
      created: ["float", "spinner", "wobbler", "jig", "feeder", "unknown"].map(type => attempt(() => {
        const entity = Factory.create(type, 10, 20, { type, maxDepth: 3, friction: 0.9 }, {}, rng(4));
        return [entity.constructor.name, entity.getPosition(), entity.getCurrentHookDepth()];
      })) }),
  }),
  BuffManager: Object.freeze({
    "buff-expiry-and-multiplier": Buffs => {
      const buffs = new Buffs();
      const trace = [buffs.getTotalMultiplier()];
      buffs.addBuff(1.5, 100);
      buffs.addBuff(2, 250);
      buffs.addBuff(0.5, 0);
      for (const dt of [0, 16, 50, 34, 100, 1000]) { buffs.update(dt); trace.push(buffs.getTotalMultiplier()); }
      return { methods: methods(Buffs), trace };
    },
  }),
  RodPullSystem: Object.freeze({
    "rod-pull-strokes-recovery-and-reset": PullSystem => {
      const run = config => attempt(() => {
        const system = new PullSystem(config);
        const trace = [];
        for (let frame = 0; frame < 40; frame += 1) {
          trace.push(encode(attempt(() => system.update({ dtSec: 0.016, dt: 16, isPulling: frame % 9 < 6,
            pullInput: frame % 9 < 6 ? 1 : 0, rod: { getMaxLoadKg: () => 6, getLengthMeters: () => 3 },
            tensionKg: 1 + (frame % 5), distanceMeters: 10 - frame * 0.1, config }))));
          if (frame === 12) trace.push(encode(attempt(() => system.recordAppliedStroke({ meters: 0.4, dtSec: 0.016 }))));
          if (frame === 20) trace.push(encode(attempt(() => system.recordDistanceMovement({ deltaMeters: -0.2 }))));
          if (frame === 28) trace.push(encode(attempt(() => system.recoverStroke({ dtSec: 0.5 }))));
        }
        const stateA = system.getState();
        trace.push(encode(stateA), stateA === system.getState());
        system.reset();
        trace.push(encode(system.getState()));
        return trace;
      });
      return { methods: methods(PullSystem), runs: [run({}), run({ rodPull: { maxStrokeMeters: 0.6 } }), run(undefined)] };
    },
  }),
  GridCell: Object.freeze({
    "grid-cell-shape": Cell => ({ cells: [[0, 0, 10], [3, 4, 25], [undefined, undefined, undefined]].map(args =>
      attempt(() => new Cell(...args))) }),
  }),
  DynamicZone: Object.freeze({
    "dynamic-zone-movement-by-delta-time": Zone => {
      const run = config => attempt(() => {
        const zone = new Zone(config, rng(13));
        const trace = [];
        for (const dt of [16, 16, 2500, 16, 4000, 16]) { zone.update(dt); trace.push(encode(zone)); }
        return trace;
      });
      return { methods: methods(Zone), runs: [
        run({ id: "z", type: "fish", multiplier: 1.4, x: 3, y: 3, w: 2, h: 2, moving: true, speedX: 1,
          bounds: { x: 0, y: 0, w: 10, h: 6 } }),
        run({ id: "s", type: "snag", x: 1, y: 1, w: 1, h: 1, moving: false }),
        run({ id: "n", moving: true, x: NaN, y: 2, w: 1, h: 1 })] };
    },
  }),
  LocationMap: Object.freeze({
    "location-grid-background-zones-and-refresh": LocationMap => {
      const config = { map: { lake: {
        zones: { castable: [{ x: 0, y: 2, w: 10, h: 4 }], collisions: [{ x: 0, y: 0, w: 2, h: 1 }],
          snags: [{ x: 5, y: 3, w: 1, h: 1 }], dynamic: [{ id: "school", type: "fish", multiplier: 1.4, x: 3, y: 3, w: 2,
            h: 2, moving: true, speedX: 1, bounds: { x: 0, y: 2, w: 10, h: 4 } }] },
        depthBounds: { min: 1, max: 5 } } },
      baseResolution: { width: 100, height: 60 }, cellSize: 10, designCellSize: 20, enableDynamicZones: true };
      const clock = () => new Date(2026, 9, 1, 20, 15);
      const run = (resources, hours) => attempt(() => {
        const map = new LocationMap("lake", config, rng(21), resources, clock);
        const trace = [];
        for (const time of hours) {
          map.update(16, time);
          trace.push(encode(map.getBackgroundRenderData()));
        }
        trace.push(encode(map.getCastableBoundsVirtual(10)), encode(map.getCellAtVirtualPos(35, 35, 10)),
          [map.getCols(), map.getRows(), map.currentLocationId, map.getDebugRevision()], encode(map.getDynamicZones()),
          encode(map.getLocationZones()), encode(map.getGrid()[1][2]));
        map.refreshConfig({ ...config, cellSize: 20, designCellSize: 20 }, resources);
        trace.push([map.getCols(), map.getRows(), map.getDebugRevision()], encode(map.getCastableBoundsVirtual(20)));
        return trace;
      });
      return { methods: methods(LocationMap), runs: [
        run({ background: { dynamic: true, assetIds: { day: "d" } }, loaded: true }, [null, 6, 8, 12, 18, 20, 22, 4, null]),
        run({ background: { dynamic: false }, loaded: false }, [12, null]),
        attempt(() => new LocationMap("lake", config, rng(), null, clock))] };
    },
  }),
  FlatInventoryItemRepository: Object.freeze({
    "inventory-store-split-attach-merge-and-restore": Repository => {
      let sequence = 0;
      const location = { inventory: () => ({ kind: "INVENTORY" }),
        attached: (parentInstanceId, slotId, slotIndex = 0) => ({ kind: "ATTACHED", parentInstanceId, slotId, slotIndex }) };
      const items = [
        { instanceId: "rod", itemId: "rod_test", quantity: 1, location: location.inventory() },
        { instanceId: "reel", itemId: "reel_test", quantity: 1, location: location.attached("rod", "reel") },
        { instanceId: "line", itemId: "line_test", quantity: 1, location: location.attached("reel", "line") },
        { instanceId: "worm", itemId: "worm", quantity: 3, location: location.inventory() },
      ];
      const repository = new Repository({ items, instanceIdFactory: source => `${source.itemId}#${++sequence}`,
        now: () => 1790000000000 });
      const steps = [attempt(() => repository.splitOne("worm")), attempt(() => repository.splitOne("rod")),
        attempt(() => repository.setLocation("worm#1", location.attached("rod", "bait"))),
        attempt(() => repository.listDescendants("rod").map(entry => [entry.item.instanceId, entry.depth])),
        attempt(() => repository.getChild("rod", "bait")), attempt(() => repository.getChildren("reel", "line")),
        attempt(() => repository.setLocation("worm#1", location.inventory())),
        attempt(() => repository.mergeInventoryItem("worm#1", { canStack: (left, right) => left.itemId === right.itemId })),
        attempt(() => repository.update("worm", { quantity: 9 })), attempt(() => repository.remove("nope")),
        attempt(() => repository.add({ instanceId: "worm", itemId: "x", quantity: 1, location: location.inventory() })),
        attempt(() => repository.find(item => item.quantity > 5)), attempt(() => repository.size)];
      const snapshot = repository.toSnapshot();
      const rejected = [attempt(() => repository.restoreSnapshot([snapshot[0], snapshot[0]])),
        attempt(() => repository.restoreSnapshot([{ instanceId: "o", itemId: "o", quantity: 1,
          location: location.attached("missing", "slot") }]))];
      const kept = repository.toSnapshot();
      repository.restoreSnapshot(snapshot.filter(item => item.instanceId !== "line"));
      const fallback = new Repository({ items: [{ instanceId: "w", itemId: "w", quantity: 2, location: location.inventory() }],
        now: () => 1790000000000 });
      return { methods: methods(Repository), steps, snapshot, rejected, kept, restored: repository.toSnapshot(),
        children: repository.getChildren("reel").length, fallback: [attempt(() => fallback.splitOne("w")), fallback.toSnapshot()],
        invalid: attempt(() => new Repository({ items: [items[1]] })) };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: Object.fromEntries(Object.entries(EXECUTABLE_CASES).map(([name, cases]) => [name, Object.keys(cases)])),
  compatibilityCases: [
    "six-representation-only-named-esm-targets-and-twenty-five-exact-exports",
    "thirteen-exact-completed-prefix-and-foundation-imports-bound-to-the-cumulative-instances",
    "one-reviewed-frozen-constant-exported-with-its-activation",
    "one-esm-evaluation-per-target-without-top-level-effects",
    "twelve-exact-classic-activations-at-their-legacy-positions-and-nine-retired-activations",
    "twelve-exact-classic-consumer-relationships-and-eleven-retired-bridges",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
