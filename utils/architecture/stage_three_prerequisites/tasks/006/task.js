"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");

const CORE = "src/core/core.js";
const VECTOR2 = "src/core/math/vector2.js";
const INDEX = "index.html";
const BASELINE = "architecture/guards/global_provider_baseline.json";
const SPLITS = "architecture/migration/legacy_slot_splits.json";
const RECORD = "architecture/migration/stage_3_prerequisites/006_vector2-classic-extraction.json";
const SLOT = 41;
// The exact Vector2 declaration of core.js (with its CRLF line endings and comments); it moves
// byte-for-byte into its own classic file.
const DECLARATION = "class Vector2 {\r\n  constructor(x = 0, y = 0) {\r\n    this.x = x;\r\n    this.y = y;\r\n  }\r\n\r\n  // ДОДАНО: Потрібен для скидання або встановлення значень без створення нового об'єкта\r\n  set(x, y) {\r\n    this.x = x;\r\n    this.y = y;\r\n    return this;\r\n  }\r\n\r\n  // ДОДАНО: Копіювання значень з іншого вектора (дуже корисно для оптимізації)\r\n  copy(v) {\r\n    this.x = v.x;\r\n    this.y = v.y;\r\n    return this;\r\n  }\r\n\r\n  add(v) {\r\n    this.x += v.x;\r\n    this.y += v.y;\r\n    return this;\r\n  }\r\n\r\n  // ДОДАНО: Віднімання (часто потрібне у фізиці)\r\n  sub(v) {\r\n    this.x -= v.x;\r\n    this.y -= v.y;\r\n    return this;\r\n  }\r\n\r\n  multiplyScalar(s) {\r\n    this.x *= s;\r\n    this.y *= s;\r\n    return this;\r\n  }\r\n\r\n  normalize() {\r\n    const length = Math.hypot(this.x, this.y);\r\n    if (length > 0) {\r\n      this.x /= length;\r\n      this.y /= length;\r\n    }\r\n    return this;\r\n  }\r\n\r\n  length() {\r\n    return Math.hypot(this.x, this.y);\r\n  }\r\n\r\n  clone() {\r\n    return new Vector2(this.x, this.y);\r\n  }\r\n}\r\n";
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

// Vector2 scenarios: construction, every method, chaining, zero-length normalization, negative
// coordinates, argument immutability, clone independence and the current coercion behavior.
const SCENARIOS = `(() => {
  const facts = [];
  const record = (label, value) => facts.push([label, value instanceof Vector2 ? { x: value.x, y: value.y,
    own: Object.keys(value) } : value]);
  record("default", new Vector2());
  record("explicit", new Vector2(3, -4));
  record("partial", new Vector2(2));
  record("strings", new Vector2("1", "2"));
  record("nullish", new Vector2(null, undefined));
  const v = new Vector2(1, 2);
  record("set-chain", v.set(5, -6) === v);
  record("set", v);
  const source = new Vector2(7, 8);
  record("copy-chain", v.copy(source) === v);
  record("copy", v);
  record("copy-source-unchanged", source);
  const other = new Vector2(-1.5, 2.25);
  record("add-chain", v.add(other) === v);
  record("add", v);
  record("sub-chain", v.sub(other) === v);
  record("sub", v);
  record("argument-unchanged", other);
  record("scale-chain", v.multiplyScalar(-0.5) === v);
  record("scale", v);
  record("length", v.length());
  record("normalize-chain", v.normalize() === v);
  record("normalize", v);
  record("normalized-length", v.length());
  record("zero-normalize", new Vector2(0, 0).normalize());
  record("negative-length", new Vector2(-3, -4).length());
  record("negative-normalize", new Vector2(-3, -4).normalize());
  const original = new Vector2(9, -9);
  const copy = original.clone();
  record("clone-type", copy instanceof Vector2);
  record("clone-distinct", copy !== original);
  copy.set(0, 0);
  record("clone-independent", original);
  record("string-add", new Vector2("1", 2).add(new Vector2(3, "4")));
  record("nan-normalize", new Vector2(NaN, 1).normalize());
  record("infinite-length", new Vector2(Infinity, 1).length());
  record("methods", Object.getOwnPropertyNames(Vector2.prototype).sort());
  return JSON.stringify(facts);
})()`;

// Stage 3.22 backlog task, checkpoint A of the 2026-09-28 Vector2 specification: the Vector2
// declaration moves byte-for-byte from the platform core script into its own classic file loaded
// immediately before the residual core.js. Both files share the historical logical legacy slot 41
// (split-slot membership recorded in index.html and the reviewed split registry), so no other
// logical slot is renumbered. There is still exactly one Vector2 declaration per page. The Engine ESM
// ownership (checkpoint B) is a separate transition; the backlog task stays open until then.
module.exports = Object.freeze({
  sequence: 6,
  slug: "vector2-classic-extraction",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.vector2-extraction",
  intent: "Checkpoint A: extract the exact Vector2 declaration from src/core/core.js into the classic src/core/math/vector2.js, loaded immediately before the residual core.js; both share logical legacy slot 41 as a reviewed split slot, no other slot is renumbered and InputManager, PointerAction, EventLogger and CacheManager stay in core.js.",
  sourceEdits: Object.freeze([
    Object.freeze({ path: CORE, replacements: Object.freeze([Object.freeze([`${DECLARATION}\r\n`, ""])]) }),
    Object.freeze({ path: INDEX, replacements: Object.freeze([Object.freeze([
      "    <script src=\"src/core/core.js\"></script>\n",
      `    <script src="src/core/math/vector2.js" data-legacy-slot="${SLOT}"></script>\n` +
        `    <script src="src/core/core.js" data-legacy-slot="${SLOT}"></script>\n`,
    ])]) }),
  ]),
  createdFiles: Object.freeze([
    Object.freeze({ path: VECTOR2, bytes({ read }) {
      assert(read(CORE).startsWith(DECLARATION), "core.js no longer starts with the reviewed Vector2 declaration");
      return DECLARATION;
    } }),
  ]),
  manifestEntries: Object.freeze([
    Object.freeze({ currentPath: VECTOR2, currentArea: "core/math", legacyLoadOrder: SLOT,
      architecture: Object.freeze({ migrationStatus: "classified", roles: Object.freeze(["engine-utility"]),
        targetBoundary: "engine", targetPath: "src/engine/math/vector2.js", migrationWave: 1 }),
      blockers: Object.freeze({ status: "verified", items: Object.freeze(["legacy-global-contract"]) }) }),
  ]),
  // The Vector2 global provider moves with its declaration (same symbol and mechanism), and the split
  // of slot 41 is recorded in the reviewed registry.
  metadataWrites({ read, exists }) {
    const baseline = JSON.parse(read(BASELINE));
    const moved = baseline.providers.filter(provider => provider.currentPath === CORE && provider.symbol === "Vector2");
    assert.equal(moved.length, 1, "exactly one Vector2 provider moves");
    const providers = baseline.providers.map(provider => (provider === moved[0] ? { ...provider, currentPath: VECTOR2 } : provider))
      .sort((left, right) => compare(left.currentPath, right.currentPath) || compare(left.symbol, right.symbol) ||
        compare(left.mechanism, right.mechanism));
    assert(!exists(SPLITS), "the split registry is created by this transition");
    const splits = { schemaVersion: 1, kind: "cyber-fishing-legacy-slot-splits",
      splits: [{ slot: SLOT, members: [VECTOR2, CORE], transition: RECORD }] };
    return new Map([
      [BASELINE, `${JSON.stringify({ ...baseline, providers }, null, 2)}\n`],
      [SPLITS, `${JSON.stringify(splits, null, 2)}\n`],
    ]);
  },
  // The 17 classic consumers that read only Vector2 from core.js lose their platform edge; their
  // edges to the Engine-classified provider are allowed.
  resolvedDebtIds: Object.freeze([
    "debt-boundary-dependency-5c2224a49e33",
    "debt-boundary-dependency-95e9c7a42588",
    "debt-boundary-dependency-6251ec34dff1",
    "debt-boundary-dependency-9da30fdef658",
    "debt-boundary-dependency-3a7839ec1bdf",
    "debt-boundary-dependency-6e7a6929bfbc",
    "debt-boundary-dependency-942d9754f36f",
    "debt-boundary-dependency-986e9f6183b8",
    "debt-boundary-dependency-737c6ef01a35",
    "debt-boundary-dependency-17f2b94ab3cd",
    "debt-boundary-dependency-6b8bd869e052",
    "debt-boundary-dependency-6ca6a4b77cc1",
    "debt-boundary-dependency-e3ffea016b6b",
    "debt-boundary-dependency-038f4ab26753",
    "debt-boundary-dependency-8780b8338d8c",
    "debt-boundary-dependency-d291d0c5bcf8",
    "debt-boundary-dependency-0c2b881384a5",
  ]),
  // Every Vector2 reader (19 classic consumers and the residual core.js/InputManager) now reads the
  // extracted provider; chum_system keeps its CacheManager edge to core.js.
  expectedEdges: Object.freeze({
    removed: Object.freeze([
    ["src/app/application.js", "src/core/core.js", "Vector2"].join("\u0000"),
    ["src/app/cast_power.js", "src/core/core.js", "Vector2"].join("\u0000"),
    ["src/app/fishing.js", "src/core/core.js", "Vector2"].join("\u0000"),
    ["src/app/rendering/boat_chum_render_frame_builder.js", "src/core/core.js", "Vector2"].join("\u0000"),
    ["src/app/rendering/casting_render_frame_builder.js", "src/core/core.js", "Vector2"].join("\u0000"),
    ["src/app/rendering/fight_area_render_frame_builder.js", "src/core/core.js", "Vector2"].join("\u0000"),
    ["src/app/rendering/fishing_render_frame_builder.js", "src/core/core.js", "Vector2"].join("\u0000"),
    ["src/app/rendering/landing_area_render_frame_builder.js", "src/core/core.js", "Vector2"].join("\u0000"),
    ["src/app/rendering/location_debug_render_frame_builder.js", "src/core/core.js", "Vector2"].join("\u0000"),
    ["src/app/rendering/world_render_frame_builder.js", "src/core/core.js", "Vector2"].join("\u0000"),
    ["src/app/states.js", "src/core/core.js", "Vector2"].join("\u0000"),
    ["src/app/world.js", "src/core/core.js", "Vector2"].join("\u0000"),
    ["src/core/fishing/fish_fight_direction_resolver.js", "src/core/core.js", "Vector2"].join("\u0000"),
    ["src/entities/tackle.js", "src/core/core.js", "Vector2"].join("\u0000"),
    ["src/systems/chum_system.js", "src/core/core.js", "CacheManager,Vector2"].join("\u0000"),
    ["src/systems/fight_physics_system.js", "src/core/core.js", "Vector2"].join("\u0000"),
    ["src/systems/fish_force_system.js", "src/core/core.js", "Vector2"].join("\u0000"),
    ["src/systems/player_force_system.js", "src/core/core.js", "Vector2"].join("\u0000"),
    ["src/world/world.js", "src/core/core.js", "Vector2"].join("\u0000"),
    ]),
    added: Object.freeze([
    ["src/app/application.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ["src/app/cast_power.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ["src/app/fishing.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ["src/app/rendering/boat_chum_render_frame_builder.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ["src/app/rendering/casting_render_frame_builder.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ["src/app/rendering/fight_area_render_frame_builder.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ["src/app/rendering/fishing_render_frame_builder.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ["src/app/rendering/landing_area_render_frame_builder.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ["src/app/rendering/location_debug_render_frame_builder.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ["src/app/rendering/world_render_frame_builder.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ["src/app/states.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ["src/app/world.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ["src/core/core.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ["src/core/fishing/fish_fight_direction_resolver.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ["src/entities/tackle.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ["src/systems/chum_system.js", "src/core/core.js", "CacheManager"].join("\u0000"),
    ["src/systems/chum_system.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ["src/systems/fight_physics_system.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ["src/systems/fish_force_system.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ["src/systems/player_force_system.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ["src/world/world.js", "src/core/math/vector2.js", "Vector2"].join("\u0000"),
    ]),
  }),
  // Focused parity: the extracted class is textually identical to the old declaration and produces
  // identical facts for every scenario.
  parity({ before, after }) {
    const facts = source => {
      const context = vm.createContext({});
      vm.runInContext(source, context, { filename: "vector2" });
      return vm.runInContext(SCENARIOS, context);
    };
    const oldDeclaration = before(CORE).slice(0, DECLARATION.length);
    assert.equal(after(VECTOR2), oldDeclaration, "the extracted declaration differs from the old one");
    assert(!/\bclass Vector2\b/u.test(after(CORE)), "core.js still declares Vector2");
    const baseline = facts(oldDeclaration);
    assert.equal(facts(after(VECTOR2)), baseline, "Vector2 behavior changed");
    return { cases: JSON.parse(baseline).length, factsSha256: crypto.createHash("sha256").update(baseline).digest("hex") };
  },
});
