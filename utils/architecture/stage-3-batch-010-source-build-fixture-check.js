"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch010SourceBuild } = require("./domain_batches/stage_three_batch_010_source_build");
const { Batch010CandidateWorkspace } = require("./domain_batches/stage_three_batch_010_candidate_workspace");
const { Batch010CutoverProjection, Batch010AtomicCutover } = require("./domain_batches/stage_three_batch_010_cutover");
const { RepresentationOnlyNamedEsmTarget } = require("./domain_batches/stage_three_representation_target");
const { Batch010HistoricalWorkspace } = require("./domain_batches/stage_three_batch_010_historical_workspace");

class Batch010SourceBuildFixtures {
  async run(root = path.resolve(__dirname, "../..")) {
    const builder = new Batch010SourceBuild(root);
    let negatives = 0;
    for (const projection of builder.projections()) {
      for (const mutate of [
        source => `${source}\nwindow.foo = 1;`,
        source => source.replace("export class", "export default class"),
        source => `${source}\nconst state = {};`,
        source => `import { CONFIG } from '../config.js';\n${source}`,
      ]) {
        assert.throws(() => new RepresentationOnlyNamedEsmTarget().validate({
          source: mutate(projection.targetSource), classicSource: builder.app.read(projection.currentPath),
          currentPath: projection.currentPath, targetPath: projection.targetPath,
          exportName: projection.exportName,
        }));
        negatives++;
      }
    }
    for (const failure of ["loader", "output"]) {
      await assert.rejects(builder.candidate({ failure }), /injected candidate/u);
      negatives++;
    }
    for (const mutateOutput of [
      output => ({ ...output, report: { ...output.report, activationOutputs: output.report.activationOutputs.slice(1) } }),
      output => ({ ...output, readOutput: file => output.readOutput(file) +
        (file.endsWith(".iife.js") ? "\nglobalThis.unapproved = 1;" : "") }),
      output => ({ ...output, readOutput: file => output.readOutput(file) +
        (file.includes("/activations/") ? "\n// changed shim" : "") }),
    ]) {
      await assert.rejects(builder.candidate({ mutateOutput }));
      negatives++;
    }
    const workspace = new Batch010CandidateWorkspace();
    try {
      for (const bad of ["../escape.js", "src/../escape.js", "src\\escape.js", "D:/escape.js"]) {
        assert.throws(() => workspace.write(bad, "invalid"));
        negatives++;
      }
      const expected = workspace.root;
      workspace.root = workspace.parent;
      assert.throws(() => workspace.cleanup());
      negatives++;
      workspace.root = expected;
    } finally { workspace.cleanup(); }
    const prepared = await new Batch010CutoverProjection().prepare(root);
    for (const [phase, count] of [["after-staging", 0], ["after-replacement", 1],
      ["after-replacement", 5], ["after-final-validation", prepared.writes.length]]) {
      const sandbox = new Batch010CandidateWorkspace();
      try {
        const originals = new Map();
        for (const write of prepared.writes) {
          const existing = path.join(root, write.relativePath);
          const before = fs.existsSync(existing) ? fs.readFileSync(existing) : null;
          originals.set(write.relativePath, before);
          if (before !== null) sandbox.write(write.relativePath, before);
          else fs.mkdirSync(path.dirname(path.join(sandbox.root, write.relativePath)), { recursive: true });
        }
        let injected = false;
        assert.throws(() => new Batch010AtomicCutover(sandbox.root).commit(prepared, {
          failureInjector: event => {
            if (event.phase === phase && event.count === count) {
              injected = true;
              throw new Error("injected transaction fault");
            }
          },
        }), /injected transaction fault/u);
        assert(injected);
        for (const [file, before] of originals) {
          const current = path.join(sandbox.root, file);
          if (before === null) assert(!fs.existsSync(current), `rollback retained ${file}`);
          else assert.deepEqual(fs.readFileSync(current), before, `rollback changed ${file}`);
        }
        negatives++;
      } finally { sandbox.cleanup(); }
    }
    builder.prebuild.validateOpen();
    console.log(`Stage 3.10.4–3.10.5 fixtures PASS: ${negatives} rejected source, output, path and atomic-publication mutations.`);
    return { negatives };
  }
}

if (require.main === module) {
  new Batch010HistoricalWorkspace().run(path.resolve(__dirname, "../.."),
    root => new Batch010SourceBuildFixtures().run(root), { keepPrebuild: true })
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch010SourceBuildFixtures };
