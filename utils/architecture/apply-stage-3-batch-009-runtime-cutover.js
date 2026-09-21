"use strict";
const path=require("node:path");
const {Batch009AtomicCutover}=require("./domain_batches/stage_three_batch_009_cutover");
if(require.main===module)new Batch009AtomicCutover(path.resolve(__dirname,"../..")).run()
  .then(a=>console.log(`Stage 3.9.5 PASS: ${a.topology.counts.modules}/${a.topology.counts.activations}/${a.topology.counts.bridges}; release ${a.releaseVersion}; batch remains active.`))
  .catch(e=>{console.error(e.stack);process.exitCode=1;});
