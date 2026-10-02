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
  else {
    result = {};
    const name = value.constructor?.name;
    if (name && name !== "Object") result.$class = name;
    for (const key of Object.keys(value).sort()) result[key] = encode(value[key], seen, depth + 1);
  }
  seen.delete(value);
  return result;
};
const attempt = action => {
  try { return { value: encode(action()) }; } catch (error) { return { error: error.name }; }
};
const methods = Type => Object.getOwnPropertyNames(Type.prototype).sort();

// A deterministic fish double exposing the reads the force system performs.
const fish = (power, weight) => {
  let frame = 0;
  return {
    events: [],
    getPhysicsConfig: () => ({ forceProfile: { basePower: power }, movementProfile: { baseSpeed: 1.2, maxSpeed: 3 } }),
    getBehavior: (dtMs, debuff) => {
      frame += 1;
      const angle = frame * 0.3;
      return { name: frame % 20 < 12 ? "swim" : "dash", forceMultiplier: 1 + (frame % 5) * 0.1,
        speedMultiplier: 0.8 + (frame % 3) * 0.1, direction: { x: Math.cos(angle), y: Math.sin(angle) },
        radialIntent: 0.5, lateralIntent: Math.sin(angle), dtMs, debuff };
    },
    getWeight: () => weight,
    getInitialPower: () => power,
    getPower: () => power * 0.9,
    getPowerBeforeMastery: () => power,
    getPowerDebuff: () => 0.1,
    getLastDashDebugData: () => ({ frame }),
    evaluateLastDashTrigger(context) { this.events.push(["dash", encode(context)]); return frame % 7 === 0; },
    handleFightEvent(event) { this.events.push(["event", encode(event)]); return true; },
  };
};
const frameInput = (index, overrides = {}) => ({
  dtMs: 16, fishPosition: { x: 200 + index * 2, y: 300 - index }, fishVelocity: { x: 1, y: -0.5 },
  rodTipPosition: { x: 640, y: 700 }, fishCondition: { maxStamina: 100, currentStamina: 100 - index, phase: "stamina" },
  dragRatio: 0.4, input: { isPulling: index % 4 !== 0, pullDirection: { x: 0, y: 1 } },
  rod: { getMaxLoadKg: () => 6, getHoldTensionRatio: () => 0.9 }, reel: { getEffectiveMaxLoadKg: () => 8 },
  playerMaxLoadKg: 5, activeRodHoldKg: index % 3, lineHasReserve: index % 9 !== 0, lineTaut: index % 5 !== 0,
  env: { waterCurrent: { x: 0.1, y: 0 } }, buffs: { getTotalMultiplier: () => 1 }, fishSpeedMultiplier: 1, ...overrides,
});

const EXECUTABLE_CASES = Object.freeze({
  FishForceSystem: Object.freeze({
    "fish-force-frames-player-force-and-fight-events": ForceSystem => {
      const run = (power, weight, config) => attempt(() => {
        const subject = fish(power, weight);
        const system = new ForceSystem({ fish: subject, config });
        const trace = [];
        for (let index = 0; index < 30; index += 1) {
          trace.push(attempt(() => system.calculate(frameInput(index))));
          if (index % 10 === 5) trace.push(attempt(() => system.calculatePlayerForce(frameInput(index))));
        }
        trace.push(attempt(() => system.getDebugData()), attempt(() => system.evaluateLastDashTrigger({ stamina: 0.1 })),
          attempt(() => system.handleFightEvent({ type: "catch_zone_entered" })), subject.events.length);
        return trace;
      });
      return { methods: methods(ForceSystem), runs: [
        run(1.5, 0.8, {}),
        run(4, 3, { stamina: { mechanics: { minBasePowerRatio: 0.3, powerDebuff: { curvePower: 2, minBasePowerRatio: 0.2 },
          enduranceMovementDebuff: { enabled: true } } } }),
        run(0, 0, null)],
        invalid: attempt(() => new ForceSystem({})) };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: { FishForceSystem: ["fish-force-frames-player-force-and-fight-events"] },
  compatibilityCases: [
    "one-representation-only-named-esm-target-and-one-exact-export",
    "eight-exact-earlier-batch-completed-prefix-and-foundation-imports-bound-to-the-cumulative-instances",
    "one-esm-evaluation-per-target-without-top-level-effects",
    "one-exact-classic-activation-at-its-legacy-position-and-six-retired-activations",
    "one-exact-classic-consumer-relationship-and-eight-retired-bridges",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
