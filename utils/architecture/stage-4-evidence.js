"use strict";

// Stage 4 tier A/B evidence (working rule 4): node utils/architecture/stage-4-evidence.js --cluster NNN
// --kind hot-loop|save-round-trip|api-parity --classes A,B --scenarios utils/x-check.js,utils/y-check.js [--capture] [--static-methods].
// --capture (before apply) writes architecture/migration/stage_4/evidence/NNN_<kind>.json; without it the command
// compares the current tree with that baseline. The cluster record names the compare form in `evidenceCommands`.
const path = require("node:path");
const { recordFileFor, StageFourWorkspace } = require("./stage_four/cluster_path");
const { StageFourTierAEvidence } = require("./stage_four/tier_a_evidence");

const ROOT = path.resolve(__dirname, "../..");
const option = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : null;
};
const list = (name) => (option(name) || "").split(",").filter(Boolean);
const id = option("cluster");
// --stage 5 selects the Stage 5 ledger (same mechanism, stage-qualified records); Stage 4 is the default.
const stage = Number(option("stage") || 4);
if (!/^\d{3}$/u.test(id || "") || !option("kind") || !option("classes") || !option("scenarios")) {
  console.error("Usage: node utils/architecture/stage-4-evidence.js --cluster NNN --kind hot-loop|save-round-trip|api-parity " +
    "--classes A,B --scenarios utils/x-check.js[,...] [--capture] [--static-methods] [--stage 4|5]");
  process.exit(2);
}
const record = new StageFourWorkspace(ROOT).json(recordFileFor(ROOT, id, stage));
const evidence = new StageFourTierAEvidence({ root: ROOT, record, kind: option("kind"), classes: list("classes"),
  scenarios: list("scenarios"), staticMethods: process.argv.includes("--static-methods") });
if (process.argv.includes("--capture")) {
  const result = evidence.capture();
  console.log(`Stage 4 tier A evidence captured: ${evidence.file} (${Object.keys(result.classes).length} classes, ` +
    `${result.scenarios.length} scenarios)`);
} else {
  const result = evidence.compare();
  for (const [name, scenarios] of Object.entries(result.traces)) {
    for (const [scenario, trace] of Object.entries(scenarios)) {
      const calls = Object.values(trace.calls).reduce((sum, value) => sum + value, 0);
      console.log(`${name} ${scenario} calls=${calls} trace=${trace.sha256}`);
    }
  }
  console.log(`Stage 4 tier A evidence identical: ${result.file}`);
}
