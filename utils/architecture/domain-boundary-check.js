"use strict";

// Live Domain boundary guard (after the Stage 3 closure, owner spec §7): the closure gates recomputed on
// every run without pinned counts, so Stage 4+ changes (bridge removal, application/platform migration)
// keep them: every Domain target has one classic source that is an activation shim or an inert placeholder,
// Domain imports only Domain and Engine, reads no browser/DEV/raw-config/transport global and no free
// identifier other than a language built-in, every availability check names a bound identifier, and every
// remaining activation and bridge has a removal stage and reason. The pinned closure snapshot itself is
// architecture/migration/stage_3_closure.json (check archived at tag stage3-closed).
const { build } = require("./stage-3-closure-check");

const facts = build();
console.log(`Domain boundary passed: ${facts.domain.moduleCount} Domain modules, ${facts.domain.importsChecked} imports ` +
  `inside Domain/Engine, 0 forbidden or free globals, ${facts.domain.availabilityChecks} bound availability checks, ` +
  `${facts.runtime.activeActivations} activations and ${facts.runtime.bridges} bridges with removal stages.`);
