"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {Batch009CutoverHistory,CUTOVER,STATE,BATCH,hash}=require("./stage_three_batch_009_cutover_history");
const {Batch009HistoricalWorkspace}=require("./stage_three_batch_009_historical_workspace");
const {Batch009CutoverProjection}=require("./stage_three_batch_009_cutover");
const {Batch009Planning,PROFILE,PATHS,serialize}=require("./stage_three_batch_009_planning");
const {Batch009CandidateValidation}=require("./stage_three_batch_009_candidate_validation");
const {CumulativeLiveActivationProbe}=require("./cumulative_live_activation_probe");
const {EagerClassModuleEvaluationProbe}=require("./eager_class_module_evaluation_probe");
const {StageThreeBatchSourceObserver}=require("./stage_three_batch_source_observer");
const {BATCH_009_EXECUTABLE_CASES:cases}=require("./stage_three_batch_009_behavior_cases");
const {RepresentationOnlyNamedEsmTarget}=require("./stage_three_representation_target");
const {ControlledMetadataTransaction}=require("./controlled_metadata_transaction");
const OUTPUT="architecture/migration/stage_3_batch_009_live_runtime_validation.json";

class Batch009LiveValidation {
  constructor(root,{read=null}={}) {this.root=path.resolve(root);this.read=read|| (f=>fs.readFileSync(path.join(this.root,f)));}
  verifyPublished() {
    const history=new Batch009CutoverHistory(this.root), artifact=history.artifact();
    const read=f=>Buffer.from(this.read(f)), json=f=>JSON.parse(read(f));
    assert(history.active(),"Batch 009 must be runtime-active");
    const pre=json(artifact.evidence.prebuild.path),proof=json(artifact.evidence.sourceBuild.path),state=json(STATE),runtime=json(PATHS.runtimeContract);
    assert.deepEqual(state,{...JSON.parse(Buffer.from(pre.stateTransition.afterBase64,"base64")),activeBatchPhase:"runtime-active"});
    assert.deepEqual(artifact.topology,pre.plannedTopology);assert.deepEqual(artifact.build,proof.report);
    for(const w of artifact.writes) {
      const bytes = w.path === PATHS.manifest
        ? require("./stage_three_batch_009_observation_transition").beforeBatch009Observations(read(w.path), this.root)
        : read(w.path);
      assert.equal(hash(bytes),w.afterSha256,`Published bytes differ: ${w.path}`);
    }
    for(const p of pre.protectedFiles) if(!artifact.writes.some(w=>w.path===p.path)) assert.equal(hash(read(p.path)),p.sha256,`Unrelated change: ${p.path}`);
    const code=read(runtime.output.directory+runtime.output.runtimeFile).toString();
    assert.equal(hash(Buffer.from(code)),proof.report.runtimeSha256);
    for(const effect of proof.effects.records) assert.equal(hash(read(effect.target)),effect.candidateSha256,`Closure source differs: ${effect.target}`);
    const app=new Batch009Planning(this.root);
    const outputValidation=new Batch009CandidateValidation().run({app,report:proof.report,contract:runtime,readOutput:f=>read(f).toString()});
    assert.deepEqual(outputValidation,proof.validation,"Published runtime differs from approved candidate behavior");
    const activation=new CumulativeLiveActivationProbe().run({code,runtime,index:read("index.html").toString(),read,projectModules:proof.report.projectModules});
    const evaluation=new EagerClassModuleEvaluationProbe().run(code,runtime.transport.symbol,proof.sources);
    const readsBefore=activation.transportReads(),shapes=[];
    for(const m of proof.sources) {
      const classic=app.read(m.currentPath),source=read(m.targetPath).toString();
      new RepresentationOnlyNamedEsmTarget().validate({...m,source,classicSource:classic});
      const before=new StageThreeBatchSourceObserver().observe(classic,m.currentPath);
      const after=new StageThreeBatchSourceObserver().observe(source.replace(`export class ${m.exportName}`,`class ${m.exportName}`),m.currentPath);
      assert.deepEqual(after,before,"Allocation/state/method shape changed");
      const Type=activation.transport.modules[m.targetPath][m.exportName];
      for(const test of Object.values(cases[m.exportName])) test(Type);
      shapes.push({source:m.targetPath,fields:after.fields,methods:after.methods,allocationTotals:after.allocationTotals});
    }
    assert.equal(activation.transportReads(),readsBefore,"Post-activation domain code reads transport");
    return {schemaVersion:1,kind:"cyber-fishing-stage-3-live-runtime-validation",batchId:BATCH,status:"verified",releaseVersion:state.releaseVersion,
      cutoverSha256:hash(read(CUTOVER)),runtimeSha256:hash(Buffer.from(code)),topology:pre.plannedTopology.counts,
      evaluation,activation:activation.evidence,outputValidation,stateAndAllocationShapes:shapes,postActivationTransportReads:0,
      performanceProof:"exact-source-allocation-sites-and-result-identity; not a frame-time benchmark",
      browserAcceptanceClaimed:false,batchCompleted:false,observationsFinal:false,nextGate:"stage-3.9.7-observation-reconciliation"};
  }
  async run({persist=false}={}) {
    const artifact=new Batch009CutoverHistory(this.root).artifact();
    const replay=await new Batch009HistoricalWorkspace().run(this.root,root=>new Batch009CutoverProjection().prepare(root));
    assert.deepEqual(replay.artifact,artifact,"Exact cutover does not reproduce from approved before-images");
    const result=this.verifyPublished(),bytes=serialize(result),target=path.join(this.root,OUTPUT);
    if(fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target),bytes,"Live evidence replay drift");
    else if(persist) new ControlledMetadataTransaction({projectRoot:this.root}).commit([{relativePath:OUTPUT,bytes}],()=>assert.deepEqual(fs.readFileSync(target),bytes));
    else throw new Error("Live evidence missing; explicit validation generator required");
    return result;
  }
}
module.exports={Batch009LiveValidation,OUTPUT};
