"use strict";
const path=require("node:path");
const {Batch009LiveValidation}=require("./domain_batches/stage_three_batch_009_live_validation");
if(require.main===module)new Batch009LiveValidation(path.resolve(__dirname,"../..")).run({persist:true})
  .then(a=>console.log(`Stage 3.9.6 PASS: ${a.evaluation.length} measured module identities; ${a.activation.activationTiming.length} exact exposures; zero post-activation transport reads.`))
  .catch(e=>{console.error(e.stack);process.exitCode=1;});
