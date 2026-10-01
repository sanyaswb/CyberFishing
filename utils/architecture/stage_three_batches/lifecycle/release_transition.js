"use strict";

const { StageThreePatchReleaseTransition, STATE, RELEASE_PATHS: SHARED_RELEASE_PATHS } =
  require("../../domain_batches/stage_three_patch_release_transition");
const { INFORMATIONAL_DOCUMENTS } = require("../../informational_documents");

// Continuation batches release exactly these metadata files (informational documents excluded).
const RELEASE_PATHS = Object.freeze(SHARED_RELEASE_PATHS.filter(file => !INFORMATIONAL_DOCUMENTS.includes(file)));

function releaseProfile(definition) {
  const context = definition.context;
  return Object.freeze({
    batchNumber: context.number,
    batchId: definition.id,
    fromRelease: context.fromRelease,
    toRelease: context.toRelease,
    completedBefore: context.completedBefore,
    title: definition.release.title,
    transitionPath: context.paths.releaseTransition,
    informationalDocumentsExcluded: true,
    // Owner decision 2026-10-01: a release may drop the oldest changelog entries from one version on.
    ...(definition.release.changelogTrimFrom ? { changelogTrimFrom: definition.release.changelogTrimFrom } : {}),
  });
}

class StageThreeBatchReleaseTransition extends StageThreePatchReleaseTransition {
  constructor(root, definition) { super(root, releaseProfile(definition)); }
}

module.exports = { StageThreeBatchReleaseTransition, releaseProfile, RELEASE_PATHS, STATE };
