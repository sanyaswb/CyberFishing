"use strict";

// Stage 4 milestone release (owner decision 0.3 step 4): node utils/architecture/stage-4-release.js --release NNN
// --step plan|apply|tag. The record architecture/migration/stage_4/releases/NNN_slug.json holds the hand input;
// apply rewrites the version files exactly and writes `output`; tag creates the local annotated tag after commit.
const fs = require("node:fs");
const path = require("node:path");
const { releaseDirectory, StageFourRelease } = require("./stage_four/release_path");

const ROOT = path.resolve(__dirname, "../..");
const option = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : null;
};
const id = option("release");
const step = option("step");
const stage = Number(option("stage") || 4);
const directory = releaseDirectory(stage);
if (!/^\d{3}$/u.test(id || "") || !["plan", "apply", "tag"].includes(step)) {
  console.error("Usage: node utils/architecture/stage-4-release.js [--stage 4|5|6] --release NNN --step plan|apply|tag");
  process.exit(2);
}
const name = fs.readdirSync(path.join(ROOT, directory)).find((file) => file.startsWith(`${id}_`));
if (!name) throw new Error(`Stage ${stage} release record ${id} not found`);
const recordFile = `${directory}/${name}`;
const release = new StageFourRelease(ROOT,stage);
const report = (files, metrics) => {
  for (const file of files) console.log(`${file.path}: ${file.edits.length} edit(s) ${file.before.slice(0, 12)} -> ${file.after.slice(0, 12)}`);
  console.log(JSON.stringify(metrics, null, 2));
};

if (step === "plan") {
  const { files, metrics } = release.plan({ ...JSON.parse(fs.readFileSync(path.join(ROOT, recordFile), "utf8")), file: recordFile });
  report(files, metrics);
  console.log(`Stage ${stage} release ${id} plan OK`);
} else if (step === "apply") {
  const output = release.apply(recordFile);
  report(output.files, output.metrics);
  console.log(`Stage ${stage} release ${id} applied; commit, then --step tag`);
} else {
  console.log(`Stage ${stage} release ${id} tagged ${release.tag(recordFile)} (local, not pushed)`);
}
