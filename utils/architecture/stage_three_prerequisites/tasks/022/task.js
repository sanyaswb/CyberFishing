"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");
const { StageThreeHotLoopSourceReview } = require("../../../review_queue/hot_loop_source_review");

const RUNTIME = "dist/stage-3-compat-runtime/compat_runtime.iife.js";
const SAMPLER = "src/core/fishing/fish_direction_intent_sampler.js";
const SPECIES = Object.freeze([
  "src/config/databases/fish/presets/fish_profile_presets.js",
  "src/config/databases/fish/species/peaceful_fish.js",
  "src/config/databases/fish/species/predator_fish.js",
]);
const FISH = "src/entities/fish.js";
const FISHING = "src/app/fishing.js";
const BOOTSTRAP = "src/app/bootstrap.js";
const CLASSES = Object.freeze(["Fish", "FishBehavior"]);
const DEBUFFS = "{ swimPullMult: 0.75, dashMaxTimeMult: 0.75, idleMaxTimeMult: 1.5, dashPullMult: 0.75, restWeightAdd: 25, restMaxTimeMult: 1.5 }";

const edit = (file, replacements) => Object.freeze({ path: file,
  replacements: Object.freeze(replacements.map(pair => Object.freeze(pair))) });

// Fight scenarios over every catalog species: behaviour frames with varying deltaTime, mastery reset,
// random debuffs and their removal, and a forced unknown behaviour state. `create(level, weight, physics,
// rng)` builds a Fish and `behavior(physics, rng)` a FishBehavior the way each world composes them.
const SCENARIOS = `((create, behavior) => {
  const facts = [];
  const record = (label, value) => facts.push([label, JSON.stringify(value, (key, item) =>
    typeof item === "number" && !Number.isFinite(item) ? String(item) : item)]);
  const seeded = seed => ({ next: () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646 });
  const species = [...PEACEFUL_FISH, ...PREDATOR_FISH,
    ...Object.entries(FISH_PROFILE_PRESETS).map(([id, physics]) => ({ id, physics }))];
  species.forEach((entry, index) => {
    for (const level of [1, 3, 6]) {
      const fish = create(level, 1.5 + index, entry.physics, seeded(11 + index * 7 + level));
      for (const dt of [16, 33, 7, 250, 1000, 16]) record(entry.id + ":frame", fish.getBehavior(dt));
      fish.setMasteryMultiplier(0.6);
      fish.clearMasteryDebuff();
      fish.clearMasteryDebuff();
      for (let round = 0; round < 4; round += 1) {
        fish.applyRandomDebuff(${DEBUFFS});
        record(entry.id + ":debuff", [fish.activeDebuffName, fish.hasActiveDebuff, fish.getBehavior(40)]);
        fish.clearDebuff();
      }
      fish.clearDebuff();
      record(entry.id + ":power", [fish.getPower(), fish.getMasteryMultiplier()]);
    }
    const single = behavior(new Fish(1, 1, entry.physics).getPhysicsConfig(), seeded(5 + index));
    single.forceState("missingState");
    single.update(16);
    record(entry.id + ":forced", single.getStateData());
  });
  return JSON.stringify(facts);
})`;

// Stage 3.22 backlog task stage-3.22.prerequisite.entities-world-rules-decomposition, transition 5 (owner
// decision 2026-09-29, round 4 point 2): the fish.js mastery, debuff and behaviour-error texts stay
// developer diagnostics, but Fish and FishBehavior no longer name the console: composition injects the
// platform ConsoleLogger (bootstrap -> FightSessionFactory -> Fish -> FishBehavior). Without an injected
// logger nothing is written (as ItemCatalogBaselineRegistry since 014). activeDebuffName is kept.
module.exports = Object.freeze({
  sequence: 22,
  slug: "fish-diagnostics-logger-injection",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.entities-world-rules-decomposition",
  intent: "Entities decomposition 5: Fish and FishBehavior write their developer diagnostics through an injected logger (the platform ConsoleLogger composed by bootstrap and passed through FightSessionFactory) instead of the console; identical fish behaviour and output.",
  sourceEdits: Object.freeze([
    edit(FISH, [
      ["  #rng;\n\n  constructor(level, weight, fishConfig, rng = null) {\n",
        "  #rng;\n  #logger;\n\n  // Composition injects the diagnostics logger (a platform adapter in production).\n  constructor(level, weight, fishConfig, rng = null, logger = null) {\n"],
      ["    this.#powerDebuff = 0;\n    this.#behavior = new FishBehavior(this.#fishConfig, this.#rng);\n",
        "    this.#logger = logger;\n    this.#powerDebuff = 0;\n    this.#behavior = new FishBehavior(this.#fishConfig, this.#rng, this.#logger);\n"],
      ["toRuntimeConfig(physics);\n      this.#behavior = new FishBehavior(this.#fishConfig, this.#rng);\n",
        "toRuntimeConfig(physics);\n      this.#behavior = new FishBehavior(this.#fishConfig, this.#rng, this.#logger);\n"],
      ["      console.log(\n        `[MASTERY]", "      this.#logger?.log?.(\n        `[MASTERY]"],
      ["    console.log(`[DEBUFF] Фаза 2", "    this.#logger?.log?.(`[DEBUFF] Фаза 2"],
      ["    console.log(`[DEBUFF] Стаміна 100%", "    this.#logger?.log?.(`[DEBUFF] Стаміна 100%"],
      ["  #rng;\n\n  constructor(fishConfig, rng = null) {\n",
        "  #rng;\n  #logger;\n\n  constructor(fishConfig, rng = null, logger = null) {\n"],
      ["    this.#rng = rng || { next: () => Math.random() };\n    this.#directionIntentSampler =\n",
        "    this.#rng = rng || { next: () => Math.random() };\n    this.#logger = logger;\n    this.#directionIntentSampler =\n"],
      ["      console.error(`[BEHAVIOR ERROR]", "      this.#logger?.error?.(`[BEHAVIOR ERROR]"],
    ]),
    edit(FISHING, [
      ["  constructor({ config, rng, castDistanceCalculator = null, devFlags = null, runtimeConfig = null }) {\n    this.config = config;\n    this.runtimeConfig = runtimeConfig;\n",
        "  // logger receives the fish's developer diagnostics (the platform ConsoleLogger in production).\n  constructor({ config, rng, castDistanceCalculator = null, devFlags = null, runtimeConfig = null, logger = null }) {\n    this.config = config;\n    this.runtimeConfig = runtimeConfig;\n    this.logger = logger;\n"],
      ["      fishData.physics,\n      this.rng,\n    );\n", "      fishData.physics,\n      this.rng,\n      this.logger,\n    );\n"],
    ]),
    edit(BOOTSTRAP, [
      ["        runtimeConfig,\n        castDistanceCalculator: runtime.castDistanceCalculator,\n      }),\n",
        "        runtimeConfig,\n        castDistanceCalculator: runtime.castDistanceCalculator,\n        logger: new ConsoleLogger(),\n      }),\n"],
    ]),
  ]),
  manifestUpdates: Object.freeze([
    Object.freeze({ currentPath: FISH, removedBlockers: Object.freeze([Object.freeze({ blocker: "browser-api-coupling",
      reason: "Fish and FishBehavior no longer name the console: composition injects the diagnostics logger (bootstrap passes the platform ConsoleLogger through FightSessionFactory); fish.js reads no browser global." })]) }),
  ]),
  resolvedDebtIds: Object.freeze(["debt-browser-capability-a130156639cb"]),
  expectedEdges: Object.freeze({ removed: Object.freeze([]), added: Object.freeze([]) }),
  // Focused parity. Static (034 hot-loop review): every Fish and FishBehavior member except the constructors
  // keeps its allocation sites; the only new members are the two #logger fields; neither class names the
  // console or gains a free identifier. Runtime: every catalog species at three levels through behaviour
  // frames with varying deltaTime, mastery reset, random debuffs and a forced unknown state gives identical
  // results and identical diagnostics (console before, the injected logger after); no logger writes nothing.
  parity({ read, before, after }) {
    const review = new StageThreeHotLoopSourceReview();
    const counts = allocations => Object.values(allocations || {}).reduce((total, value) => total + value, 0);
    const staticFacts = CLASSES.map(className => {
      const old = review.review({ source: before(FISH), currentPath: FISH, className });
      const next = review.review({ source: after(FISH), currentPath: FISH, className });
      const oldMembers = new Map(old.members.map(member => [`${member.kind}\0${member.name}`, member]));
      const added = [];
      for (const member of next.members) {
        const previous = oldMembers.get(`${member.kind}\0${member.name}`);
        if (!previous) {
          added.push(`${member.kind}:${member.name}`);
          continue;
        }
        if (member.kind === "constructor") continue;
        assert.equal(counts(member.allocations), counts(previous.allocations),
          `allocation sites changed: ${className}.${member.name}`);
      }
      assert.equal(added.length, 1, `${className} gains exactly one member: ${added.join(", ")}`);
      assert.match(added[0], /^field:#?logger$/u, `${className} gains only the logger field`);
      assert.equal(next.members.length, old.members.length + 1, `members removed from ${className}`);
      const names = new Set(next.freeIdentifiers.map(item => item.name));
      assert(!names.has("console"), `${className} still names the console`);
      const oldNames = new Set(old.freeIdentifiers.map(item => item.name));
      assert([...names].every(name => oldNames.has(name)), `${className} gains a free identifier`);
      assert.deepEqual(next.wallClockReads, [], `${className} reads a wall clock`);
      return [className, next.members.map(member => [member.name, member.bodySha256])];
    });
    assert(!/\bconsole\b/u.test(after(FISH)), "fish.js still names the console");
    const world = fish => {
      const output = [];
      const console = Object.fromEntries(["log", "warn", "error"].map(level => [level, (...args) => output.push([level, args])]));
      const context = vm.createContext({ console, window: {} });
      vm.runInContext(read(RUNTIME), context, { filename: RUNTIME });
      for (const file of [SAMPLER, ...SPECIES]) vm.runInContext(read(file), context, { filename: file });
      vm.runInContext(fish, context, { filename: FISH });
      return { context, output };
    };
    const oldWorld = world(before(FISH));
    const newWorld = world(after(FISH));
    const baseline = vm.runInContext(`${SCENARIOS}((level, weight, physics, rng) => new Fish(level, weight, physics, rng),
      (physics, rng) => new FishBehavior(physics, rng))`, oldWorld.context);
    const injected = vm.runInContext(`${SCENARIOS}((level, weight, physics, rng) => new Fish(level, weight, physics, rng, console),
      (physics, rng) => new FishBehavior(physics, rng, console))`, newWorld.context);
    assert.equal(injected, baseline, "fish behaviour changed");
    assert.deepEqual(newWorld.output, oldWorld.output, "fish diagnostics changed");
    const levels = new Set(oldWorld.output.map(([level, args]) => `${level}:${String(args[0]).slice(0, 10)}`));
    assert(["log:[MASTERY]", "log:[DEBUFF] ", "error:[BEHAVIOR"].every(prefix => [...levels].some(item => item.startsWith(prefix))),
      "every diagnostic is exercised");
    const silent = world(after(FISH));
    const quiet = vm.runInContext(`${SCENARIOS}((level, weight, physics, rng) => new Fish(level, weight, physics, rng),
      (physics, rng) => new FishBehavior(physics, rng))`, silent.context);
    assert.equal(quiet, baseline, "fish behaviour without a logger changed");
    assert.deepEqual(silent.output, [], "a fish without a logger writes diagnostics");
    assert(/this\.rng,\s*this\.logger,\s*\)/u.test(after(FISHING)), "FightSessionFactory passes its logger to the fish");
    assert(/castDistanceCalculator: runtime\.castDistanceCalculator,\s*logger: new ConsoleLogger\(\),/u.test(after(BOOTSTRAP)),
      "bootstrap composes FightSessionFactory with the platform ConsoleLogger");
    const facts = `${JSON.stringify(staticFacts)}${baseline}${JSON.stringify(oldWorld.output)}`;
    return { cases: JSON.parse(baseline).length + oldWorld.output.length + CLASSES.length,
      factsSha256: crypto.createHash("sha256").update(facts).digest("hex") };
  },
});
