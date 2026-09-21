"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { Batch009SourceBuild, OUTPUT: SOURCE_BUILD } = require("./stage_three_batch_009_source_build");
const { Batch009Prebuild } = require("./stage_three_batch_009_prebuild");
const { PROFILE, PATHS, sha, serialize } = require("./stage_three_batch_009_planning");
const { PREBUILD } = require("./stage_three_batch_009_prebuild_history");
const { CUTOVER, STATE, BATCH } = require("./stage_three_batch_009_cutover_history");
const { PendingTargetManifestTransition } = require("./stage_three_pending_target_manifest");
const { ControlledMetadataTransaction } = require("./controlled_metadata_transaction");
const { ActivationShimRenderer } = require("../../build/compat_runtime/activation_shim");
const { MigrationBridgeRegistryValidator } = require("../guards/contracts/guard_artifact_repository");
const { CumulativeRuntimeContractValidator } = require("../../build/compat_runtime/cumulative_runtime_contract");
const { Batch009CandidateWorkspace } = require("./stage_three_batch_009_candidate_workspace");

class Batch009CutoverProjection {
  async prepare(root) {
    const prebuild = new Batch009Prebuild(root).validate(), builder = new Batch009SourceBuild(root), app = builder.app;
    const generated = new Map();
    const candidate = await builder.candidate({ captureOutput: ({ contract, report, readOutput }) => {
      for (const p of [contract.output.directory + contract.output.runtimeFile, ...report.activationOutputs.map(a => a.path)]) generated.set(p, Buffer.from(readOutput(p)));
    } });
    const approvedBuild = app.json(SOURCE_BUILD);
    for (const key of ["report", "validation", "effects", "sources", "candidateMetadata"]) assert.deepEqual(candidate[key], approvedBuild[key], `Candidate drift: ${key}`);
    const runtime = app.json(PATHS.runtimeContract);
    const future = { ...runtime, activationPositions: [...runtime.activationPositions, ...prebuild.preliminaryMetadata.plannedActivationPositions].sort((a,b) => a.id.localeCompare(b.id)) };
    new CumulativeRuntimeContractValidator().validate(future);
    const registry = { ...app.json(PATHS.bridgeRegistry), bridges: [...app.json(PATHS.bridgeRegistry).bridges,
      ...prebuild.preliminaryMetadata.plannedBridges].sort((a,b) => a.id.localeCompare(b.id)) };
    new MigrationBridgeRegistryValidator().validate(registry);
    const pending = new PendingTargetManifestTransition({ policy: app.json("architecture/module_architecture.json"), prebuild,
      approvedBatch: app.json(PATHS.approvedPlan).batches.find(b => b.id === BATCH) });
    const manifest = JSON.parse(pending.add(app.bytes(PATHS.manifest))), writes = [];
    for (const source of builder.projections()) writes.push({ relativePath: source.targetPath, bytes: Buffer.from(source.targetSource) });
    const relocation = new Batch009CandidateWorkspace();
    let index;
    try { index = relocation.relocate(app.read("index.html"), future, prebuild.runtimeRelocation.afterLogicalPosition); }
    finally { relocation.cleanup(); }
    // Candidate relocation leaves the removed tag's indentation on an empty line.
    // Publication removes only that whitespace; script topology is unchanged.
    index = index.replace(/^ {4}(?=\r?$)/gmu, "");
    for (const a of prebuild.preliminaryMetadata.plannedActivationPositions) {
      const source = manifest.modules.find(m => m.currentPath === a.sourceProvider), target = manifest.modules.find(m => m.currentPath === a.targetModule);
      source.architecture.roles = ["compatibility-bridge"];
      source.observed = { ...structuredClone(target.observed), legacyLoadOrder: source.observed.legacyLoadOrder };
      source.analysis.dependencies = structuredClone(target.analysis.dependencies);
      writes.push({ relativePath: a.sourceProvider, bytes: Buffer.from(new ActivationShimRenderer().render(a, runtime.transport.symbol)) });
      const marker = `src="${a.sourceProvider}"`;
      assert.equal(index.split(marker).length - 1, 1);
      index = index.replace(marker, `src="${runtime.output.directory}${a.shimFile}"`);
      // Existing generated activation tags use LF in the mixed-EOL legacy HTML.
      // Normalize only the newly replaced tag, preserving all unrelated bytes.
      const tag = `<script src="${runtime.output.directory}${a.shimFile}"></script>`;
      index = index.replace(`${tag}\r\n`, `${tag}\n`);
    }
    for (const [relativePath, bytes] of generated) writes.push({ relativePath, bytes });
    const packageContract = app.json("architecture/build/package_contract.json");
    packageContract.stage.current = "3.9";
    packageContract.stage.cumulativeRuntimeBuild.runtimeInputs = prebuild.plannedTopology.counts.modules;
    packageContract.stage.cumulativeRuntimeBuild.activationInputs = prebuild.plannedTopology.counts.activations;
    writes.push(...[
      [PATHS.manifest, serialize(manifest)], [PATHS.runtimeContract, serialize(future)], [PATHS.bridgeRegistry, serialize(registry)],
      ["index.html", Buffer.from(index)], ["architecture/build/package_contract.json", serialize(packageContract)],
      [STATE, serialize({ ...JSON.parse(fs.readFileSync(path.join(root, STATE))), activeBatchPhase: "runtime-active" })],
    ].map(([relativePath,bytes]) => ({ relativePath,bytes })));
    const changed = writes.filter(w => !fs.existsSync(path.join(root,w.relativePath)) || !fs.readFileSync(path.join(root,w.relativePath)).equals(w.bytes));
    assert.equal(new Set(changed.map(w => w.relativePath)).size, changed.length);
    const records = changed.map(w => {
      const before = fs.existsSync(path.join(root,w.relativePath)) ? fs.readFileSync(path.join(root,w.relativePath)) : null;
      return { path:w.relativePath,beforeSha256:before ? sha(before) : null,afterSha256:sha(w.bytes),
        beforeBase64:before?.toString("base64") ?? null,afterBase64:w.bytes.toString("base64") };
    });
    const artifact = { schemaVersion:3,kind:"cyber-fishing-stage-3-runtime-cutover",batchId:BATCH,status:"runtime-active-verified",releaseVersion:"0.24.45",
      evidence:{prebuild:{path:PREBUILD,sha256:sha(app.bytes(PREBUILD))},sourceBuild:{path:SOURCE_BUILD,sha256:sha(app.bytes(SOURCE_BUILD))}},
      lifecycle:{completedBatchIds:prebuild.lifecycle.completedBatchIds,activeBatchId:BATCH,activeBatchPhase:"runtime-active",batchCompleted:false},
      topology:prebuild.plannedTopology,build:candidate.report,scriptTopology:app.json(PROFILE.executionPlanPath).scriptTopology.after,
      manifestTransition:{observations:"pending",pendingPaths:[...prebuild.plannedDelta.projectModules,...prebuild.preliminaryMetadata.targets.map(t=>t.currentPath)].sort(),finalReconciliationStage:"3.9.7"},
      writes:records,rollback:{scope:"batch-009-only",restorePhase:"prebuild",restoreTopology:prebuild.activeTopology.counts,preserveCompletedBatchIds:prebuild.lifecycle.completedBatchIds},
      nextGate:"stage-3.9.6-live-validation" };
    return { artifact,writes:changed.concat({relativePath:CUTOVER,bytes:serialize(artifact)}),protectedFiles:prebuild.protectedFiles };
  }
}

// Reserve the configured loopback dev port during the synchronous publication.
// An already running server is a blocker, not a process to kill automatically.
class Batch009PublicationGate {
  constructor({port=Number(process.env.PORT || 4173),host=process.env.HOST || "127.0.0.1"}={}){this.port=port;this.host=host;}
  async run(action) {
    const server=net.createServer(socket=>socket.destroy());
    const {port,host}=this;
    await new Promise((resolve,reject)=>{ server.once("error",reject);server.listen({port,host,exclusive:true},resolve); });
    try { return await action(server.address()); } finally { await new Promise(resolve=>server.close(resolve)); }
  }
}
class Batch009AtomicCutover {
  constructor(root) { this.root=path.resolve(root); }
  commit(prepared,{failureInjector=null}={}) {
    const newDirectories=[];
    try {
      for (const w of prepared.writes) {
        const parent=path.dirname(path.join(this.root,w.relativePath));
        if (!fs.existsSync(parent)) { assert.equal(path.relative(this.root,parent).replaceAll("\\","/"),"src/game/domain/fish");fs.mkdirSync(parent);newDirectories.push(parent); }
      }
      new ControlledMetadataTransaction({projectRoot:this.root,failureInjector}).commit(prepared.writes,()=>{
        for (const w of prepared.writes) assert.deepEqual(fs.readFileSync(path.join(this.root,w.relativePath)),w.bytes);
        for (const f of prepared.protectedFiles) if (!prepared.writes.some(w=>w.relativePath===f.path)) assert.equal(sha(fs.readFileSync(path.join(this.root,f.path))),f.sha256);
      });
    } catch(error) {
      for (const dir of newDirectories.reverse()) if(fs.existsSync(dir)&&fs.readdirSync(dir).length===0) fs.rmdirSync(dir);
      throw error;
    }
  }
  async run() {
    assert(!fs.existsSync(path.join(this.root,CUTOVER)),"Cutover writer is single-use");
    const prepared=await new Batch009CutoverProjection().prepare(this.root);
    return new Batch009PublicationGate().run(()=>{
      new Batch009Prebuild(this.root).validate();
      this.commit(prepared);return prepared.artifact;
    });
  }
}
module.exports={Batch009CutoverProjection,Batch009AtomicCutover,Batch009PublicationGate};
