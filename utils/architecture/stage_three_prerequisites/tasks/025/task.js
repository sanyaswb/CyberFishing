"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const FISH = "src/entities/fish.js";
const TACKLE = "src/entities/tackle.js";
const MIXED = "mixed-responsibility-requires-decomposition";

// Stage 3.22 backlog task stage-3.22.prerequisite.entities-world-rules-decomposition, transition 8 (owner
// decision framework 2026-09-29, questions 5, 7 and 9): after 018-022 the fish and tackle entities hold no
// forbidden edge, player-facing text, raw config read, DEV dependency or browser access. What remains in
// each file is one cohesive domain (fish: physics profile, entity, per-frame behaviour, condition and point
// calculators; tackle: tackle items and per-frame water entities with their factory), so both are
// reclassified without a split and without a source edit (hot-loop classes are not split; a large file is
// not split for size). The remaining literals are developer diagnostics: fish.js logs through the injected
// logger (022) and its activeDebuffName DEV label moves to the overlay in Stage 6; tackle.js reports
// bite-sequence rolls through its injected debug-event port.
module.exports = Object.freeze({
  sequence: 25,
  slug: "fish-tackle-reviewed-reclassification",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.entities-world-rules-decomposition",
  intent: "Entities decomposition 8: evidence-backed removal of the mixed-responsibility blocker from the unchanged fish.js and tackle.js, cohesive fish and tackle domains whose DEV, config, console and text couplings were removed by 018-022; hot-loop classes are not split.",
  sourceEdits: Object.freeze([]),
  reviewedWithoutEdit: Object.freeze([FISH, TACKLE]),
  manifestUpdates: Object.freeze([
    Object.freeze({ currentPath: FISH, removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "One cohesive fish domain: physics profile, fish entity, per-frame behaviour state machine, condition and point calculators. Since 022 it names no console (diagnostics go through the injected logger); no config global, DEV module, browser API or known debt; its only dependency is the game-domain direction sampler (recorded evidence). The per-frame FishBehavior is not split (hot loop). Remaining literals are developer diagnostics; the activeDebuffName DEV label moves to the overlay in Stage 6." })]) }),
    Object.freeze({ currentPath: TACKLE, removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "One cohesive tackle domain: rod, reel, hook and net items and the per-frame water entities with their factory. Since 018 no GodMode dependency (DevFlagsProvider hook), since 020 no raw config read (live runtime config injected); no browser API or known debt; dependencies are game-domain rules and the engine Vector2 (recorded evidence). The per-frame water entities are not split (hot loop). The one literal is a developer diagnostic sent through the injected debug-event port." })]) }),
  ]),
  resolvedDebtIds: Object.freeze([]),
  expectedEdges: Object.freeze({ removed: Object.freeze([]), added: Object.freeze([]) }),
  // No behaviour can change: both reviewed sources are outside the write set and pinned. The facts behind
  // the reasons are asserted on the pinned bytes: no console, CONFIG, GodMode or DOM name; fish.js logs only
  // through its logger; tackle.js's one literal goes to the debug-event port.
  parity({ read }) {
    const facts = [FISH, TACKLE].map(file => {
      const source = read(file);
      for (const name of ["console", "CONFIG", "GodMode", "document", "window", "localStorage"]) {
        assert(!new RegExp(`\\b${name}\\b`, "u").test(source), `${file} names ${name}`);
      }
      return [file, crypto.createHash("sha256").update(source).digest("hex")];
    });
    const fish = read(FISH);
    assert.equal((fish.match(/this\.#logger\?\.(?:log|error)\?\.\(/gu) || []).length, 4, "fish diagnostics use the logger");
    const tackle = read(TACKLE);
    assert(/debugIterations\.push\(\{\s+index: i \+ 1,\s+result: "успішно",/u.test(tackle), "the tackle diagnostic literal moved");
    assert(/_emitDebugEvent\(type, detail\) \{\s+if \(!this\._debugEvents/u.test(tackle), "tackle diagnostics use the debug-event port");
    const text = JSON.stringify(facts);
    return { cases: facts.length, factsSha256: crypto.createHash("sha256").update(text).digest("hex") };
  },
});
