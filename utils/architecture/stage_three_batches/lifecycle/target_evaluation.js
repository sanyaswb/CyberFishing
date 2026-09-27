"use strict";

// The reviewed evaluation effect of one ESM target (private static literal Sets), recorded by the
// batch's side-effect review; null for effect-free targets. Every projection of the target passes it,
// so the representation re-verifies the exact reviewed effect.
function reviewedTargetEvaluation(definition, readJson, targetPath) {
  const review = readJson(definition.profile.sideEffectEvidence.path);
  return (review.targetEvaluations || []).find(item => item.module === targetPath) || null;
}

module.exports = { reviewedTargetEvaluation };
