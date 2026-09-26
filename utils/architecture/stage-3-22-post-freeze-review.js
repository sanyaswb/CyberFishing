"use strict";

// Stage 3.22 post-freeze graph review.
//   node utils/architecture/stage-3-22-post-freeze-review.js --write --commit <sha>
//     builds the review from the current workspace and writes architecture/migration/stage_3_22/;
//   node utils/architecture/stage-3-22-post-freeze-review.js
//     replays the review at its recorded checkpoint and fails unless every artifact is
//     byte-identical. After the v0.24.59 release the release before-images restore the checkpoint.
const fs = require("node:fs");
const path = require("node:path");
const { PostFreezeWorkspace } = require("./post_freeze/post_freeze_workspace");
const { PostFreezeReview } = require("./post_freeze/post_freeze_review");
const { PostFreezeReleaseImages } = require("./post_freeze/post_freeze_release_images");
const { ARTIFACTS, DIRECTORY } = require("./post_freeze/post_freeze_paths");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const REVIEW_ARTIFACTS = Object.freeze([ARTIFACTS.baseline, ARTIFACTS.domainAudit, ARTIFACTS.graphReview,
  ARTIFACTS.prerequisiteBacklog, ARTIFACTS.candidateBatches, ARTIFACTS.reviewEvidence, ARTIFACTS.approvedPrefix]);

function checkpointWorkspace(root = PROJECT_ROOT) {
  const images = PostFreezeReleaseImages.load(root);
  return new PostFreezeWorkspace(root, { beforeImage: images ? images.beforeImage : null });
}

function replay({ root = PROJECT_ROOT, review = new PostFreezeReview(), workspace = checkpointWorkspace(root) } = {}) {
  const baseline = JSON.parse(fs.readFileSync(path.join(root, ARTIFACTS.baseline), "utf8"));
  const result = review.build({ workspace, commit: baseline.commit });
  const mismatches = REVIEW_ARTIFACTS.filter(file => {
    const absolute = path.join(root, file);
    return !fs.existsSync(absolute) || !fs.readFileSync(absolute).equals(result.artifacts.get(file));
  });
  return { result, mismatches };
}

function write({ root = PROJECT_ROOT, commit }) {
  if (fs.existsSync(path.join(root, ARTIFACTS.releaseTransition))) {
    throw new Error("Stage 3.22 artifacts are released; regenerate them only through a new reviewed stage");
  }
  const result = new PostFreezeReview().build({ workspace: new PostFreezeWorkspace(root), commit });
  fs.mkdirSync(path.join(root, DIRECTORY), { recursive: true });
  for (const file of REVIEW_ARTIFACTS) fs.writeFileSync(path.join(root, file), result.artifacts.get(file));
  return result;
}

function main(argv, root = PROJECT_ROOT) {
  if (argv.includes("--write")) {
    const commit = argv[argv.indexOf("--commit") + 1];
    if (!argv.includes("--commit") || !commit) throw new Error("--write requires --commit <baseline sha>");
    const result = write({ commit });
    console.log(JSON.stringify(result.summary, null, 2));
    console.log(`Stage 3.22 post-freeze review written: ${REVIEW_ARTIFACTS.length} artifacts.`);
    return;
  }
  const { result, mismatches } = replay({ root });
  if (mismatches.length > 0) {
    console.error(`Stage 3.22 post-freeze review replay differs:\n- ${mismatches.join("\n- ")}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Stage 3.22 post-freeze review replay OK: ${REVIEW_ARTIFACTS.length} artifacts byte-identical ` +
    `(${result.summary.approvedPrefix.frozenBatchCount} frozen batches, ` +
    `${result.summary.approvedPrefix.reviewQueueBatchCount} requiring evidence).`);
}

if (require.main === module) {
  if (process.argv.includes("--write")) main(process.argv.slice(2));
  else {
    const { Batch022HistoricalWorkspace } = require("./domain_batches/stage_three_batch_022_historical_workspace");
    new Batch022HistoricalWorkspace().run(PROJECT_ROOT, prior => main(process.argv.slice(2), prior))
      .catch(error => { console.error(error.stack); process.exitCode = 1; });
  }
}

module.exports = { REVIEW_ARTIFACTS, checkpointWorkspace, replay, write };
