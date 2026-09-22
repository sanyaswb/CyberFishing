"use strict";
const path=require("node:path");
const {RepositoryContentSnapshot}=require("./esm_infrastructure/repository_content_snapshot");
const {Batch009LiveValidation}=require("./domain_batches/stage_three_batch_009_live_validation");
async function run(){const root=path.resolve(__dirname,"../.."),snapshot=new RepositoryContentSnapshot(root),before=snapshot.capture();
  try{const a=await new Batch009LiveValidation(root).run();console.log(`Stage 3.9.5–3.9.6 LIVE PASS: ${a.topology.modules}/${a.topology.activations}/${a.topology.bridges}; exact publication replay, class/state/allocation parity, real script timing; observation acceptance is checked separately by 3.9.7; release unchanged.`);}
  finally{snapshot.assertEqual(before,snapshot.capture());}}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={run};
