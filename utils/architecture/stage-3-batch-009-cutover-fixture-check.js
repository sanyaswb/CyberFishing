"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {Batch009CutoverProjection,Batch009AtomicCutover,Batch009PublicationGate}=require("./domain_batches/stage_three_batch_009_cutover");
const {Batch009CandidateWorkspace}=require("./domain_batches/stage_three_batch_009_candidate_workspace");
const {Batch009HistoricalWorkspace}=require("./domain_batches/stage_three_batch_009_historical_workspace");
const {Batch009LiveValidation}=require("./domain_batches/stage_three_batch_009_live_validation");
const {Batch009CutoverHistory}=require("./domain_batches/stage_three_batch_009_cutover_history");
const {EagerClassModuleEvaluationProbe}=require("./domain_batches/eager_class_module_evaluation_probe");
const ROOT=path.resolve(__dirname,"../..");
async function run(root=ROOT) {
  const prepared=await new Batch009HistoricalWorkspace().run(root,r=>new Batch009CutoverProjection().prepare(r));
  const boundary=[["after-staging",0],...prepared.writes.map((_,i)=>["after-replacement",i+1]),["after-final-validation",prepared.writes.length]];
  for(const [phase,count] of boundary) {
    const w=new Batch009CandidateWorkspace();
    try {
      for(const f of prepared.protectedFiles)w.write(f.path,fs.readFileSync(path.join(root,f.path)));
      for(const r of prepared.artifact.writes)if(r.beforeBase64!==null)w.write(r.path,Buffer.from(r.beforeBase64,"base64"));
      // Existing target parent is intentionally absent before the batch.
      let fired=false;
      assert.throws(()=>new Batch009AtomicCutover(w.root).commit(prepared,{failureInjector:e=>{
        if(e.phase===phase&&e.count===count){fired=true;throw new Error("injected cutover failure");}
      }}),/injected cutover failure/u);
      assert(fired);
      for(const r of prepared.artifact.writes) {
        const file=path.join(w.root,r.path);
        if(r.beforeBase64===null)assert(!fs.existsSync(file));else assert.deepEqual(fs.readFileSync(file),Buffer.from(r.beforeBase64,"base64"));
      }
      assert(!fs.existsSync(path.join(w.root,"src/game/domain/fish")));
    } finally {w.cleanup();}
  }
  let entered=false;
  await new Batch009PublicationGate({port:0}).run(async address=>{await assert.rejects(new Batch009PublicationGate({port:address.port}).run(()=>{entered=true;}));});
  assert(!entered,"Concurrent publication entered critical section");
  const history=new Batch009CutoverHistory(root);
  let negatives=0;
  if(history.active()) {
    const app=new Batch009LiveValidation(root);app.verifyPublished();
    for(const record of prepared.artifact.writes) {
      assert.throws(()=>new Batch009LiveValidation(root,{read:f=>f===record.path?Buffer.concat([fs.readFileSync(path.join(root,f)),Buffer.from(" ")]):fs.readFileSync(path.join(root,f))}).verifyPublished());negatives++;
    }
    const artifact=history.artifact(),source=JSON.parse(fs.readFileSync(path.join(root,artifact.evidence.sourceBuild.path))),runtime=JSON.parse(fs.readFileSync(path.join(root,"architecture/migration/stage_3_compatibility_runtime.json")));
    assert.throws(()=>new EagerClassModuleEvaluationProbe().run(fs.readFileSync(path.join(root,runtime.output.directory+runtime.output.runtimeFile),"utf8"),runtime.transport.symbol,source.sources,{executions:2}));negatives++;
  }
  console.log(`Stage 3.9.5–3.9.6 fixtures PASS: ${boundary.length} transaction failure boundaries, occupied publication gate, ${negatives} live-byte/evaluation mutations.`);
}
if(require.main===module)require("./domain_batches/stage_three_batch_009_release_history")
  .runPreReleaseScript(ROOT,"utils/architecture/stage-3-batch-009-cutover-fixture-check.js",run)
  .catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={run};
