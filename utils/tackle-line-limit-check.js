"use strict";

const assert = require("node:assert/strict");
const { SourceRuntime } = require("./testing/core/source_runtime");
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

for (const State of [WaitingState, BitingState]) {
  for (const tiltDegrees of [null, 90, 45, 30]) {
    const profiled = tiltDegrees !== null;
    const metric = new WaterMetric({ pixelsPerMeter: 50, shoreY: 1000, topY: 0, centerX: 500,
      ...(profiled ? { maxMeters: 40, linearShare: .5, tiltDegrees } : {}) });
    const rules = new EquipmentRules(new CastDistanceCalculator(CONFIG), CONFIG, {});
    for (const variant of ["fixed", "sliding", "feeder", "spinning"]) for (const controlEnabled of [false, true]) {
      const eq = { rod: { variant: ["feeder", "spinning"].includes(variant) ? variant : "float", effectiveStats: { lengthMeters: 3 } },
        line: { effectiveStats: { lengthMeters: 9 } }, float: { effectiveStats: { mount: variant } } };
      const entity = new FloatEntity(500, 750, CONFIG.float || {}, 10, { next: () => .5 }, null, null, null, CONFIG);
      const rod = { x: 420, y: 1000 };
      const localConfig = { ...CONFIG, physics: { ...CONFIG.physics,
        castRodControl: { ...CONFIG.physics.castRodControl, enabled: controlEnabled } } };
      const projector = { focusOnVirtualPos() {}, virtualToScreen: (x, y, out) => out.set(x, y),
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
console.log("Tackle line limit passed: waiting/biting, fixed/sliding floats, feeder/spinning, off-centre rod, uniform/profiled and 30/45-degree tilted metres, inward retrieval.");
