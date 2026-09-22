"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {Batch009CandidateWorkspace}=require("./stage_three_batch_009_candidate_workspace");
const {Batch009CutoverHistory,CUTOVER}=require("./stage_three_batch_009_cutover_history");

// Replay old checks on exact old files, rather than giving their scanners planned
// or mixed inputs. Real current-source enforcement remains in the live guards.
class Batch009HistoricalWorkspace {
  async run(root,action,{copyTools=false}={}) {
    const history=new Batch009CutoverHistory(root);
    if(!history.active()) return action(root);
    const artifact=history.artifact(),w=new Batch009CandidateWorkspace();
    try {
      const copy=relative=>{
        for(const e of fs.readdirSync(path.join(root,relative),{withFileTypes:true})) {
          assert(!e.isSymbolicLink());const f=`${relative}/${e.name}`;
          if(e.isDirectory()) copy(f);else w.write(f,fs.readFileSync(path.join(root,f)));
        }
      };
      for(const dir of ["src","architecture","dist/stage-3-compat-runtime",...(copyTools?["utils"]:[])])copy(dir);
      for(const file of ["index.html","package.json","package-lock.json","CHANGELOG.md","refactor_Task.txt"]) w.write(file,fs.readFileSync(path.join(root,file)));
      for(const r of artifact.writes) {
        let bytes = fs.readFileSync(path.join(root,r.path));
        if (r.path === "architecture/migration/module_migration_manifest.json") {
          bytes = require("./stage_three_batch_009_observation_transition").beforeBatch009Observations(bytes, root);
        }
        assert.equal(require("./stage_three_batch_009_cutover_history").hash(bytes),r.afterSha256,`Live cutover drift: ${r.path}`);
        if(r.beforeBase64===null) fs.unlinkSync(path.join(w.root,r.path));
        else w.write(r.path,Buffer.from(r.beforeBase64,"base64"));
      }
      fs.unlinkSync(path.join(w.root,CUTOVER));
      // Observation evidence has no meaning in a restored pre-cutover workspace.
      const observation = path.join(w.root, require("./stage_three_batch_009_observation_transition").OUTPUT);
      if (fs.existsSync(observation)) fs.unlinkSync(observation);
      if(copyTools) {
        // Junction is dependency resolution only; generated artifacts stay in w.root.
        fs.symlinkSync(path.join(root,"node_modules"),path.join(w.root,"node_modules"),"junction");
      }
      return await action(w.root);
    } finally {
      const junction=path.join(w.root,"node_modules");
      if(fs.existsSync(junction)) fs.unlinkSync(junction);
      w.cleanup();
    }
  }
}
async function runHistoricalScript(root,relative,action) {
  if(!new Batch009CutoverHistory(root).active())return action();
  console.log(`Historical batch replay in isolated workspace: ${relative}`);
  return new Batch009HistoricalWorkspace().run(root,temporary=>{
    const result=require("node:child_process").spawnSync(process.execPath,[path.join(temporary,relative),...process.argv.slice(2)],{cwd:temporary,encoding:"utf8",maxBuffer:32*1024*1024});
    if(result.stdout)process.stdout.write(result.stdout);
    assert.equal(result.status,0,result.stderr||result.error?.message||"Historical check failed");
  },{copyTools:true});
}
module.exports={Batch009HistoricalWorkspace,runHistoricalScript};
