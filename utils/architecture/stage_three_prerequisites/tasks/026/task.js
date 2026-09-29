"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const WORLD = "src/world/world.js";
const PROJECTOR = "src/world/viewport_projector.js";
const VECTOR2 = "src/core/math/vector2.js";
const BOOTSTRAP = "src/app/bootstrap.js";
const INDEX = "index.html";
const BASELINE = "architecture/guards/global_provider_baseline.json";
const SPLITS = "architecture/migration/legacy_slot_splits.json";
const RECORD = "architecture/migration/stage_3_prerequisites/026_viewport-projector-split.json";
const MAP_DB = "src/config/databases/map_db.js";
const SLOT = 204;
// The location config as CONFIG.locations shapes it for the projector (config.js), over the catalog maps
// plus variants for every initial alignment, a narrowed safe zone and a missing perspective.
const LOCATIONS = `(() => {
  const map = { ...MAP_DB };
  const [first] = Object.values(MAP_DB);
  for (const [x, y] of [["left", "top"], ["right", "bottom"], ["center", "safeZone"], ["center", "center"]]) {
    map[\`variant_\${x}_\${y}\`] = { ...first, initialAlignment: { x, y }, safeZone: { top: 200, bottom: 1300 } };
  }
  map.noPerspective = { ...first, perspective: undefined };
  return { baseResolution: { width: 2560, height: 1440 }, cameraFocusY: 0.7, map };
})()`;
const MIXED = "mixed-responsibility-requires-decomposition";
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
// The exact ViewportProjector declaration that ends world.js, frozen beside this task with LF line breaks
// (independent of checkout conversion); in world.js it is CRLF, and it moves byte-for-byte.
const DECLARATION_LF = fs.readFileSync(path.join(__dirname, "viewport_projector_declaration.txt"), "utf8")
  .replaceAll("\r\n", "\n");
const DECLARATION = DECLARATION_LF.replaceAll("\n", "\r\n");

// Viewport scenarios: canvas sizes, panning, focus with varying deltaTime, perspective across the map
// and both projections with and without an output vector, for every configured location.
const SCENARIOS = `((locationsConfig) => {
  const facts = [];
  const round = value => (typeof value === "number" ? Math.round(value * 1e9) / 1e9 : value);
  const state = projector => [projector.getScale(), projector.getCanvasWidth(), projector.getCanvasHeight(),
    projector.getMaxScrollX()].map(round);
  for (const locationId of Object.keys(locationsConfig.map)) {
    const projector = new ViewportProjector(locationsConfig, locationId);
    for (const [width, height] of [[800, 600], [1920, 1080], [390, 844], [1280, 720]]) {
      projector.update(width, height);
      facts.push([locationId, "update", width, height, state(projector)]);
      for (const [dx, dy] of [[40, 0], [-500, 30], [10000, -10000], [0, 0]]) {
        projector.pan(dx, dy);
        facts.push([locationId, "pan", state(projector), projector.screenToVirtual(100, 200), projector.virtualToScreen(300, 400)]);
      }
      for (const [vy, dt] of [[100, 16], [900, 33], [2000, 250], [400, 1000]]) {
        projector.focusOnVirtualPos(vy, dt);
        facts.push([locationId, "focus", projector.screenToVirtual(0, 0)]);
      }
      const out = new Vector2(0, 0);
      facts.push([locationId, "out", projector.screenToVirtual(5, 7, out) === out, out.x, out.y]);
    }
    for (const vy of [-100, 0, 150, 400, 700, 1000, 5000]) facts.push([locationId, "perspective", vy, projector.getPerspective(vy)]);
  }
  facts.push(["methods", Object.getOwnPropertyNames(ViewportProjector.prototype).sort()]);
  return JSON.stringify(facts, (key, value) => (typeof value === "number" ? round(value) : value));
})`;

// Stage 3.22 backlog task stage-3.22.prerequisite.entities-world-rules-decomposition, transition 9 (owner
// decision framework 2026-09-29, questions 1, 3, 8 and 9; LocationMap revision decided by the owner).
// world.js held two responsibilities: the location world model (GridCell, DynamicZone, LocationMap) and
// the viewport/camera (ViewportProjector: canvas size, scale, scroll, screen <-> virtual mapping, plus the
// config-derived perspective that the chum rules read). ViewportProjector moves byte-for-byte into its own
// file, a reviewed split member of legacy slot 204 (its provider moves, no new global), classified
// game-application: application gameplay (chum perspective), input mapping (application, cast power) and
// presentation (render builders, allowed to read application) read it, so a presentation classification
// would make application depend on presentation. Splitting the perspective from the camera changes its
// API and is deferred (Stage 5). LocationMap keeps getDebugRevision: it is the revision of the map's
// source data, owned by the map (owner decision), read by a DEV overlay (DEV -> production is allowed);
// with the DEV-named config flags injected like the rest of the location config, world.js has no DEV
// dependency.
module.exports = Object.freeze({
  sequence: 26,
  slug: "viewport-projector-split",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.entities-world-rules-decomposition",
  intent: "Entities decomposition 9: ViewportProjector moves byte-for-byte from world.js into src/world/viewport_projector.js (reviewed split member of legacy slot 204, provider moved, no new global, classified game-application); world.js keeps the cohesive location world model and loses the mixed and dev-production-coupling blockers (LocationMap's revision is map-owned data).",
  sourceEdits: Object.freeze([
    Object.freeze({ path: WORLD, replacements: Object.freeze([Object.freeze([`}\n\n${DECLARATION_LF}`, "}\n"])]) }),
    Object.freeze({ path: INDEX, replacements: Object.freeze([Object.freeze([
      `    <script src="${WORLD}"></script>\n`,
      `    <script src="${WORLD}" data-legacy-slot="${SLOT}"></script>\n` +
        `    <script src="${PROJECTOR}" data-legacy-slot="${SLOT}"></script>\n`,
    ])]) }),
  ]),
  createdFiles: Object.freeze([Object.freeze({ path: PROJECTOR, bytes({ read }) {
    assert(read(WORLD).endsWith(`}\r\n\r\n${DECLARATION}`), "world.js no longer ends with the reviewed ViewportProjector");
    return DECLARATION;
  } })]),
  manifestEntries: Object.freeze([Object.freeze({ currentPath: PROJECTOR, currentArea: "world", legacyLoadOrder: SLOT,
    architecture: Object.freeze({ migrationStatus: "classified", roles: Object.freeze(["application-service"]),
      targetBoundary: "game-application", targetPath: "src/game/application/viewport/viewport_projector.js", migrationWave: 4 }),
    blockers: Object.freeze({ status: "verified", items: Object.freeze(["legacy-global-contract"]) }) })]),
  manifestUpdates: Object.freeze([
    Object.freeze({ currentPath: WORLD, removedBlockers: Object.freeze([
      Object.freeze({ blocker: MIXED,
        reason: "The viewport/camera (ViewportProjector) moved byte-for-byte to its own game-application file; world.js keeps one cohesive location world model (grid cells, dynamic zones, location map) with no dependency at all, no text, DEV module, browser API or known debt (recorded evidence)." }),
      Object.freeze({ blocker: "dev-production-coupling",
        reason: "No DEV dependency: getDebugRevision is the revision of the map's source data (bumped on zone recalculation and resource application), owned by LocationMap and read by a DEV overlay (DEV -> production is allowed; owner decision 2026-09-29); the DEV-named flags are injected location config. Renaming it and the per-frame debug-state string are deferred (Stage 6/7)." }),
    ]) }),
  ]),
  // The ViewportProjector provider moves with its declaration (same symbol and mechanism); slot 204 splits.
  metadataWrites({ read }) {
    const baseline = JSON.parse(read(BASELINE));
    const moved = baseline.providers.filter(provider => provider.currentPath === WORLD && provider.symbol === "ViewportProjector");
    assert.equal(moved.length, 1, "exactly one ViewportProjector provider moves");
    const providers = baseline.providers.map(provider => (provider === moved[0] ? { ...provider, currentPath: PROJECTOR } : provider))
      .sort((left, right) => compare(left.currentPath, right.currentPath) || compare(left.symbol, right.symbol) ||
        compare(left.mechanism, right.mechanism));
    const registry = JSON.parse(read(SPLITS));
    assert(!registry.splits.some(split => split.slot === SLOT), "slot 204 is not split yet");
    const splits = [...registry.splits, { slot: SLOT, members: [WORLD, PROJECTOR], transition: RECORD }]
      .sort((left, right) => left.slot - right.slot);
    return new Map([
      [BASELINE, `${JSON.stringify({ ...baseline, providers }, null, 2)}\n`],
      [SPLITS, `${JSON.stringify({ ...registry, splits }, null, 2)}\n`],
    ]);
  },
  resolvedDebtIds: Object.freeze([]),
  // bootstrap's one edge to world.js (both classes) becomes one edge per file; Vector2 moves with the projector.
  expectedEdges: Object.freeze({
    removed: Object.freeze([
      [BOOTSTRAP, WORLD, "LocationMap,ViewportProjector"].join("\u0000"),
      [WORLD, VECTOR2, "Vector2"].join("\u0000"),
    ]),
    added: Object.freeze([
      [BOOTSTRAP, PROJECTOR, "ViewportProjector"].join("\u0000"),
      [BOOTSTRAP, WORLD, "LocationMap"].join("\u0000"),
      [PROJECTOR, VECTOR2, "Vector2"].join("\u0000"),
    ]),
  }),
  // Focused parity: the extracted class is textually identical to the old declaration and behaves
  // identically for every configured location; world.js is otherwise unchanged and still exposes the
  // map revision.
  parity({ read, before, after }) {
    const oldWorld = before(WORLD);
    assert.equal(after(PROJECTOR), DECLARATION, "the extracted declaration differs");
    assert.equal(after(WORLD), oldWorld.slice(0, oldWorld.length - DECLARATION.length - 2),
      "world.js changed beyond the extraction");
    assert(!/\bclass ViewportProjector\b/u.test(after(WORLD)), "world.js still declares ViewportProjector");
    assert(/getDebugRevision\(\) \{\r\n    return this\.#debugRevision;/u.test(after(WORLD)), "the map revision changed");
    const facts = source => {
      const context = vm.createContext({});
      vm.runInContext(read(VECTOR2), context, { filename: VECTOR2 });
      vm.runInContext(read(MAP_DB), context, { filename: MAP_DB });
      vm.runInContext(source, context, { filename: "projector" });
      return vm.runInContext(`${SCENARIOS}(${LOCATIONS})`, context);
    };
    const baseline = facts(oldWorld);
    assert.equal(facts(after(PROJECTOR)), baseline, "ViewportProjector behaviour changed");
    return { cases: JSON.parse(baseline).length, factsSha256: crypto.createHash("sha256").update(baseline).digest("hex") };
  },
});
