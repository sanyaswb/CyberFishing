"use strict";

const assert = require("node:assert/strict");
const { SourceRuntime } = require("../../testing/core/source_runtime");
const runtime = new SourceRuntime();
const load = path => runtime.importModule(path);
const { FloatEntity } = load("src/game/domain/tackle/float_entity.js");
const { WaitingState } = load("src/game/application/state/waiting_state.js");
const { BitingState } = load("src/game/application/state/biting_state.js");
const { WaterMetric } = load("src/game/domain/locations/water_metric.js");
const { CastDistanceCalculator } = load("src/game/domain/casting/cast_distance_calculator.js");
const { EquipmentRules } = load("src/game/domain/rules/equipment_rules.js");
const { TackleLineReachConstraint } = load("src/game/domain/fishing/tackle_line_reach_constraint.js");
const { CastRodControl } = load("src/game/application/fishing/cast_rod_control.js");
const { CONFIG } = load("src/game/config/runtime/game_config.js");

const constraint = new TackleLineReachConstraint();
for (const [velocity, expected] of [[{ x: 3, y: 4 }, { x: 0, y: 4 }], [{ x: -3, y: 4 }, { x: -3, y: 4 }]]) {
  const p = { x: 12, y: 0 };
  constraint.apply(p, velocity, { x: 0, y: 0 }, 10);
  assert.deepEqual(p, { x: 10, y: 0 }); assert.deepEqual(velocity, expected, "remove only outward velocity");
}
{
  const p = { x: 12, y: 0 };
  const v = { x: 5, y: 0 };
  // Target arc would be x = 10, but water ends at x = 9:
  constraint.apply(p, v, { x: 0, y: 0 }, 10, (x, y) => x <= 9);
  assert(p.x <= 9.001 && p.x >= 8.99, `reach constraint must clamp to water boundary, got ${p.x}`);
}

for (const State of [WaitingState, BitingState]) {
  for (const profiled of [false, true]) {
    const water = { pixelsPerMeter: 50, shoreY: 1000, topY: 0, centerX: 500 };
    const metric = profiled ? WaterMetric.illustrated({ ...water, maxMeters: 40, lateralContraction: true })
      : new WaterMetric(water);
    const rules = new EquipmentRules(new CastDistanceCalculator(CONFIG), CONFIG, {});
    for (const variant of ["fixed", "sliding", "feeder", "spinning"]) for (const controlEnabled of [false, true]) {
      const eq = { rod: { variant: ["feeder", "spinning"].includes(variant) ? variant : "float", effectiveStats: { lengthMeters: 3 } },
        line: { effectiveStats: { lengthMeters: 9 } }, float: { effectiveStats: { mount: variant } } };
      const entity = new FloatEntity(500, 750, CONFIG.float || {}, 10, { next: () => .5 }, null, null, null, CONFIG);
      const rod = { x: 420, y: 1000 };
      const localConfig = { ...CONFIG, physics: { ...CONFIG.physics,
        castRodControl: { ...CONFIG.physics.castRodControl, enabled: controlEnabled } } };
      const projector = { focusOnVirtualPos() {}, followVirtualX() {}, virtualToScreen: (x, y, out) => out.set(x, y),
        screenToVirtual: (x, y, out) => out.set(x, y) };
      const control = new CastRodControl({ config: localConfig, projector, canvasMetrics: { width: 1000, height: 1000 },
        getBaseRodVirtualPos: () => rod });
      // Real entity physics with deterministic current, no wind or a naturally ending bite.
      entity.isBiting = () => true; entity.isGuaranteedBite = () => false; entity.updateBite = () => {};
      const deps = { float: entity, config: localConfig, projector, getViewportSize: () => ({ width: 1000, height: 1000 }),
        inventory: { getEquipped: () => eq }, currentHookDepthRef: { get: () => 1 },
        world: { getWaterMetric: () => metric, getRodVirtualPos: () => rod, checkWater: () => ({ depth: 5 }), getBiteEnv: () => ({}) },
        rules: { equipment: rules }, castRodControl: control,
        commands: { setState() {} }, input: { getState: () => ({}) }, clock: { now: 1000 }, getCastStartTime: () => 0,
        biteSystem: { reset() {}, evaluateBite: () => null }, fishing: { collectAvailableBaits() {} } };
      const state = new State(deps);
      const bounds = { left: 0, right: 1000, top: 0, bottom: 1000 };
      const reach = variant === "fixed" ? 8 : 9;
      for (let frame = 0; frame < 120; frame++) {
        state.update(16, bounds, { input: {}, env: { current: { speedPxPerSec: 2500, direction: { x: .6, y: -.8 } } } });
        const p = entity.getPosition();
        assert(metric.distanceMeters(rod.x, rod.y, p.x, p.y) <= reach + 1e-8,
          `${State.name} ${variant} profiled=${profiled}: drift cannot exceed ${reach} m`);
      }
      const before = metric.distanceMeters(rod.x, rod.y, entity.getPosition().x, entity.getPosition().y);
      entity.update = () => { const p = entity.getPosition(); p.x += (rod.x - p.x) * .02; p.y += (1000 - p.y) * .02; };
      state.update(16, bounds, { input: {}, env: {} });
      assert(metric.distanceMeters(rod.x, rod.y, entity.getPosition().x, entity.getPosition().y) < before, "inward retrieval stays possible");
    }
  }
}
// TK-263 (G-131): tackle without a fish reeled into the landing zone (a spinning lure also to the shore) stays in the
// water, in waiting and while a fish only bites; only the player's double click takes it out.
for (const State of [WaitingState, BitingState]) {
  for (const variant of ["fixed", "spinning"]) {
    const metric = new WaterMetric({ pixelsPerMeter: 50, shoreY: 1000, topY: 0, centerX: 500 });
    const rules = new EquipmentRules(new CastDistanceCalculator(CONFIG), CONFIG, {});
    const eq = { rod: { variant: variant === "spinning" ? "spinning" : "float", effectiveStats: { lengthMeters: 3 } },
      reel: { effectiveStats: { basePower: 1 } }, line: { effectiveStats: { lengthMeters: 9 } },
      float: { effectiveStats: { mount: "fixed" } } };
    const rod = { x: 500, y: 1000 };
    // At the rod's foot: inside any landing distance, and on the shore line for the spinning lure.
    const entity = new FloatEntity(rod.x, variant === "spinning" ? 1000 : 990, CONFIG.float || {}, 10, { next: () => .5 },
      null, null, null, CONFIG);
    entity.isBiting = () => true; entity.isGuaranteedBite = () => false; entity.updateBite = () => {}; entity.stopBite = () => {};
    entity.update = () => {};
    const projector = { focusOnVirtualPos() {}, followVirtualX() {}, virtualToScreen: (x, y, out) => out.set(x, y),
      screenToVirtual: (x, y, out) => out.set(x, y) };
    const control = new CastRodControl({ config: CONFIG, projector, canvasMetrics: { width: 1000, height: 1000 },
      getBaseRodVirtualPos: () => rod });
    const transitions = [];
    const deps = { float: entity, config: CONFIG, projector, getViewportSize: () => ({ width: 1000, height: 1000 }),
      inventory: { getEquipped: () => eq }, currentHookDepthRef: { get: () => 1 }, canPlayerCast: () => false,
      world: { getWaterMetric: () => metric, getRodVirtualPos: () => rod, checkWater: () => ({ depth: 5 }), getBiteEnv: () => ({}) },
      rules: { equipment: rules }, castRodControl: control,
      commands: { setState: (name) => transitions.push(name) }, input: { getState: () => ({}) }, clock: { now: 1000 },
      getCastStartTime: () => 0, biteSystem: { reset() {}, evaluateBite: () => null }, fishing: { collectAvailableBaits() {} } };
    const state = new State(deps);
    const bounds = { left: 0, right: 1000, top: 0, bottom: 1000 };
    for (let frame = 0; frame < 30; frame++) state.update(16, bounds, { input: { isPulling: true }, env: {} });
    assert.deepEqual(transitions, [], `${State.name} ${variant}: tackle in the landing zone stays until the player takes it out`);
    state.handleInput({ isDoubleClick: true });
    assert.deepEqual(transitions, ["scouting"], `${State.name} ${variant}: a double click takes the tackle out`);
  }
}
// TK-362.1 (owner, phone screenshot): the tackle got onto land over a stair of the castable zone's mask and could not be
// reeled back. Each axis was tested alone, so a diagonal step past a stair's corner passed both tests and landed on land;
// from there both tests failed for good. Real mask of the test map, real FloatEntity: drift, a bite's run and a fight move
// never leave the water, and a tackle put on land by another path comes back when retrieved.
{
  const { LocationMap } = load("src/game/domain/locations/location_map.js");
  const { SeededRng } = load("src/engine/random/seeded_rng.js");
  const locations = JSON.parse(JSON.stringify(CONFIG.locations));
  const map = new LocationMap("test", locations, new SeededRng("tk363:map"), { depthReader: { getDepthAtPixel: () => 2 } });
  const water = (x, y) => (map.isCastableAt(x, y) ? { depth: 2 } : null);
  water.getDepth = () => 2;
  const bounds = map.getCastableBoundsVirtual(locations.cellSize);
  const fixedRng = { next: () => 0.5, range: (low) => low, chance: () => false };
  // A stair of the mask: land at (370, 815), water left of it below and right of it on the same row.
  assert.deepEqual([!!water(370, 815), !!water(370, 825), !!water(385, 815)], [false, true, true], "the test map has the stair");
  const corner = new FloatEntity(385, 825, CONFIG.float || {}, 10, fixedRng, null, null, null, CONFIG);
  corner.getVelocity().set(-600, -400);
  corner.update(bounds, 16, {}, water, {}, 0, null);
  assert.ok(water(corner.getPosition().x, corner.getPosition().y), "a diagonal step past a stair's corner stays on the water");
  const rng = new SeededRng("tk363:drift");
  let offWater = 0;
  for (let index = 0; index < 400; index += 1) {
    let x, y;
    do { x = rng.range(0, 500); y = rng.range(800, 960); } while (!water(x, y));
    const entity = new FloatEntity(x, y, CONFIG.float || {}, 10, fixedRng, null, null, null, CONFIG);
    for (let frame = 0; frame < 200; frame += 1) {
      const angle = rng.range(0, Math.PI * 2), speed = rng.range(50, 900);
      entity.getVelocity().set(Math.cos(angle) * speed, Math.sin(angle) * speed);
      entity.update(bounds, 16, {}, water, {}, 0, null);
      if (!water(entity.getPosition().x, entity.getPosition().y)) offWater += 1;
    }
  }
  assert.equal(offWater, 0, "tackle drifting at random near the mask's stairs never leaves the water");
  const fight = new FloatEntity(385, 825, CONFIG.float || {}, 10, fixedRng, null, null, null, CONFIG);
  fight.applyHookedFightMovement({ boundsRect: bounds, dt: 16, environment: {}, checkWater: water,
    targetVelocity: { x: -600, y: -400 } });
  assert.ok(water(fight.getPosition().x, fight.getPosition().y), "a fish's diagonal pull past the corner stays on the water");
  // A tackle already on land (any other path) is reeled back.
  const stranded = new FloatEntity(370, 815, CONFIG.float || {}, 10, fixedRng, null, null, null, CONFIG);
  for (let frame = 0; frame < 60; frame += 1) {
    stranded.getVelocity().set(120, 120);
    stranded.update(bounds, 16, {}, water, {}, 0, null);
  }
  assert.ok(water(stranded.getPosition().x, stranded.getPosition().y), "a tackle on land comes back when pulled toward the rod");
}
// TK-364 (owner): in God mode (infiniteCasting) a fish hooked far beyond the tackle's line jumped to the line's limit on
// the first fight frame. The fight's line keeps the fish where it is: a reel's spool holds the reserve; a pole's line
// beyond its own length is virtual — the fish takes it while the player does not pull, the pull winds it back (virtual
// reel, config speed, slower under tension) down to the pole's own line, never shorter. Without God mode — as before.
{
  const { LineSystem } = load("src/game/domain/fishing/line_system.js");
  const { FightSessionFactory } = load("src/game/application/fishing/fight_session_factory.js");
  const godLine = JSON.parse(JSON.stringify(CONFIG.debug.godMode.infiniteCastingLine));
  const ppm = 50;
  const calculator = new CastDistanceCalculator({ physics: { simulation: { pixelsPerMeter: ppm } } });
  const rod = { getLengthMeters: () => 4 };
  const lineStats = { effectiveStats: { lengthMeters: 20, maxLoadKg: 8 } };
  const rodTip = { x: 0, y: 0 };
  const at = (meters) => ({ x: 0, y: -meters * ppm });
  const step = (line, meters) => {
    const position = at(meters);
    line.updateDistance(position, rodTip);
    line.releaseForDistance({ dragRatio: 0.5, shouldSlip: false, slipReleaseRatio: 0, creepReleaseRatio: 0 });
    line.constrainPosition(position, { x: 0, y: 0 }, rodTip);
    line.updateDistance(position, rodTip);
    return -position.y / ppm;
  };
  const reel = { hasReel: () => true };
  const normalReel = new LineSystem({ rod, reel, config: {}, lineStats, castDistanceCalculator: calculator });
  assert.ok(Math.abs(step(normalReel, 60) - 20) < 0.01, "without God mode a reel's fight is held by its 20 m line (as before)");
  const godReel = new LineSystem({ rod, reel, config: {}, lineStats, castDistanceCalculator: calculator, godModeLine: godLine });
  assert.ok(Math.abs(step(godReel, 60) - 60) < 0.01, "God mode: a reel's fish hooked at 60 m stays at 60 m");
  assert.ok(godReel.getState().totalLineMeters >= godLine.reserveMeters, "and the spool holds the reserve");

  const pole = { hasReel: () => false };
  const polePole = new LineSystem({ rod, reel: pole, config: {}, lineStats, castDistanceCalculator: calculator });
  assert.ok(Math.abs(step(polePole, 60) - 20) < 0.01, "without God mode a pole's fight is held by its line (as before)");
  const godPole = new LineSystem({ rod, reel: pole, config: {}, lineStats, castDistanceCalculator: calculator, godModeLine: godLine });
  assert.ok(Math.abs(step(godPole, 60) - 60) < 0.01, "God mode: a pole's fish hooked at 60 m stays at 60 m");
  assert.ok(Math.abs(godPole.getState().virtualLineMeters - 40) < 0.01, "40 m of it is the pole's virtual line");
  assert.ok(Math.abs(step(godPole, 65) - 65) < 0.01, "the fish takes more virtual line while the player does not pull");
  godPole.setVirtualReelHolding(true);
  assert.ok(Math.abs(step(godPole, 70) - 65) < 0.01, "while the player pulls the fish takes no line");
  const wound = godPole.recoverVirtualLine({ dtSec: 1, tensionKg: 0 });
  assert.ok(Math.abs(wound - godLine.poleRetrieveSpeedMetersPerSec) < 1e-9, "the pull winds the virtual reel at its speed");
  const slow = godPole.recoverVirtualLine({ dtSec: 1, tensionKg: 8 });
  assert.ok(Math.abs(slow - godLine.poleRetrieveSpeedMetersPerSec * godLine.poleMinEfficiency) < 1e-9,
    "under full tension it winds at its minimum share");
  const fishAfter = step(godPole, 65);
  assert.ok(fishAfter < 65 - wound, "the shorter line brings the fish in");
  for (let frame = 0; frame < 2000; frame += 1) godPole.recoverVirtualLine({ dtSec: 0.05, tensionKg: 0 });
  assert.equal(godPole.getState().virtualLineMeters, 0, "the virtual line is wound back completely");
  assert.ok(Math.abs(step(godPole, 30) - 20) < 0.01, "then the pole's own line holds the fish, never shorter");
  godPole.setVirtualReelHolding(false);

  // FightSessionFactory hands the God mode line only while infiniteCasting is on.
  const physicsConfig = Object.fromEntries(["getReelDragConfig", "getRodPullConfig", "getRodHoldConfig", "getReelConfig",
    "getTensionConfig", "getLineSystemConfig"].map((name) => [name, () => ({})]));
  const equipment = { rod: { variant: "pole", effectiveStats: { hasReel: false, lengthMeters: 4 } },
    line: { effectiveStats: { lengthMeters: 20, maxLoadKg: 8 } }, hooks: [] };
  const lineFor = (enabled) => new FightSessionFactory({ config: { fightPhysicsConfig: physicsConfig, physics: { simulation: { pixelsPerMeter: ppm } } },
    rng: null, castDistanceCalculator: calculator, runtimeConfig: CONFIG,
    devFlags: { isEnabled: (flag) => enabled && flag === "infiniteCasting" } }).createEquipment(equipment).lineSystem;
  assert.ok(Math.abs(step(lineFor(true), 60) - 60) < 0.01, "the fight factory gives the God mode line with infiniteCasting");
  assert.ok(Math.abs(step(lineFor(false), 60) - 20) < 0.01, "and the tackle's own line without it");
}
console.log("Tackle line limit passed: waiting/biting, fixed/sliding floats, feeder/spinning, off-centre rod, uniform/profiled metres and inward retrieval; empty tackle in the landing zone stays until a double click (TK-263); the tackle never steps over a mask stair onto land (TK-362.1); God mode fight line keeps a far fish in place, pole virtual reel (TK-364).");
