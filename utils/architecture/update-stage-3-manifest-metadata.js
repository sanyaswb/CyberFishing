"use strict";

const path = require("node:path");
const {
  MigrationManifestRepository,
} = require("./migration/migration_manifest_repository");
const {
  StageThreeManifestMetadataProjector,
} = require("./migration/stage_three_manifest_metadata_projector");

const projectRoot = path.resolve(__dirname, "../..");
const readJson = (relativePath) => require(path.join(projectRoot, relativePath));
const repository = new MigrationManifestRepository(path.join(
  projectRoot,
  "architecture/migration/module_migration_manifest.json",
));
const manifest = new StageThreeManifestMetadataProjector().project({
  manifest: repository.read(),
  approvedPlan: readJson(
    "architecture/migration/stage_3_approved_batches.json",
  ),
  executionState: readJson(
    "architecture/migration/stage_3_execution_state.json",
  ),
});
repository.write(manifest);
console.log("Stage 3 selected-batch manifest metadata updated.");
