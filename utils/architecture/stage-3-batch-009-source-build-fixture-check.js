"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch009Prebuild } = require("./domain_batches/stage_three_batch_009_prebuild");
const { Batch009PrebuildHistory, STATE, PREBUILD } = require("./domain_batches/stage_three_batch_009_prebuild_history");
const { Batch009SourceBuild } = require("./domain_batches/stage_three_batch_009_source_build");
const { Batch009CandidateWorkspace } = require("./domain_batches/stage_three_batch_009_candidate_workspace");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { RepresentationOnlyNamedEsmTarget } = require("./domain_batches/stage_three_representation_target");
const { sha, serialize } = require("./domain_batches/stage_three_batch_009_planning");
const { RepositoryContentSnapshot } = require("./esm_infrastructure/repository_content_snapshot");

class Batch009SourceBuildFixtures {
  async run(root = path.resolve(__dirname, "../..")) {
    const snapshot = new RepositoryContentSnapshot(root), before = snapshot.capture();
    const prebuild = new Batch009Prebuild(root), artifact = prebuild.validate(), history = new Batch009PrebuildHistory(root);
    let negatives = 0;
    try {
      for (const mutate of [r => { r.path = "index.html"; }, r => { r.beforeSha256 = "0".repeat(64); },
        r => { r.afterSha256 = "0".repeat(64); }, r => { r.afterBase64 = r.beforeBase64; }]) {
        const r = structuredClone(artifact.stateTransition); mutate(r);
        assert.throws(() => history.validate(r)); negatives++;
      }
      for (const mutate of [s => { s.releaseVersion = "0.24.46"; }, s => { s.activeBatchId = null; },
        s => { s.activeBatchPhase = "runtime-active"; }, s => { s.completedBatchIds.pop(); },
        s => { s.nextBatchId = "arbitrary"; }]) {
        const r = structuredClone(artifact.stateTransition), state = JSON.parse(Buffer.from(r.afterBase64, "base64"));
        mutate(state); const bytes = serialize(state); r.afterBase64 = bytes.toString("base64"); r.afterSha256 = sha(bytes);
        assert.throws(() => history.validate(r)); negatives++;
      }
      for (const [phase, count] of [["after-staging", 0], ["after-replacement", 1], ["after-replacement", 2], ["after-final-validation", 2]]) {
        const w = new Batch009CandidateWorkspace();
        try {
          const prior = Buffer.from(artifact.stateTransition.beforeBase64, "base64");
          w.write(STATE, prior);
          let injected = false;
          assert.throws(() => new ControlledMetadataTransaction({ projectRoot: w.root, failureInjector: e => {
            if (e.phase === phase && e.count === count) { injected = true; throw new Error("injected transaction fault"); }
          } }).commit([{ relativePath: PREBUILD, bytes: serialize(artifact) },
            { relativePath: STATE, bytes: Buffer.from(artifact.stateTransition.afterBase64, "base64") }], () => {}), /injected transaction fault/u);
          assert(injected); assert.deepEqual(fs.readFileSync(path.join(w.root, STATE)), prior);
          assert(!fs.existsSync(path.join(w.root, PREBUILD)));
          assert.deepEqual(fs.readdirSync(path.join(w.root, "architecture/migration")), ["stage_3_execution_state.json"]);
          negatives++;
        } finally { w.cleanup(); }
      }
      const build = new Batch009SourceBuild(root);
      for (const projection of build.projections()) for (const mutate of [s => s + "\nwindow.foo = 1;", s => s.replace("export class", "export default class"),
        s => s + "\nconst state = {};", s => "import { CONFIG } from '../config.js';\n" + s]) {
        assert.throws(() => new RepresentationOnlyNamedEsmTarget().validate({ source: mutate(projection.targetSource),
          classicSource: build.app.read(projection.currentPath), currentPath: projection.currentPath,
          targetPath: projection.targetPath, exportName: projection.exportName })); negatives++;
      }
      for (const failure of ["loader", "output"]) {
        await assert.rejects(build.candidate({ failure }), /injected candidate/u); negatives++;
      }
      const mutations = [
        output => ({ ...output, report: { ...output.report, activationOutputs: output.report.activationOutputs.slice(1) } }),
        output => ({ ...output, readOutput: p => output.readOutput(p) + (p.endsWith(".iife.js") ? "\nglobalThis.unapproved = 1;" : "") }),
        output => ({ ...output, readOutput: p => output.readOutput(p) + (p.includes("/activations/") ? "\n// changed shim" : "") }),
      ];
      for (const mutateOutput of mutations) { await assert.rejects(build.candidate({ mutateOutput })); negatives++; }
      const w = new Batch009CandidateWorkspace();
      try {
        for (const bad of ["../escape.js", "src/../escape.js", "src\\escape.js", "D:/escape.js"]) {
          assert.throws(() => w.write(bad, "invalid")); negatives++;
        }
        const expected = w.root; w.root = w.parent;
        assert.throws(() => w.cleanup()); negatives++;
        w.root = expected;
      } finally { w.cleanup(); }
      prebuild.validate();
      console.log(`Stage 3.9.3–3.9.4 fixtures PASS: ${negatives} rejected state/source/output/transaction/path mutations; previous output and live files preserved.`);
      return { negatives };
    } finally { snapshot.assertEqual(before, snapshot.capture()); }
  }
}
if (require.main === module) new (require("./domain_batches/stage_three_batch_009_historical_workspace").Batch009HistoricalWorkspace)()
  .run(path.resolve(__dirname,"../.."), root => new Batch009SourceBuildFixtures().run(root)).catch(error => { console.error(error.stack); process.exitCode = 1; });
module.exports = { Batch009SourceBuildFixtures };
