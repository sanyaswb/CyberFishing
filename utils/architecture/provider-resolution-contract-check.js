const assert = require("node:assert/strict");
const architecture = require("../../architecture/module_architecture.json");
const {
  ProviderResolutionContract,
} = require("./observation/resolution/provider_resolution_contract");

const model = architecture.migrationManifest.observationContract.resolutionModel;
const contract = new ProviderResolutionContract(model);

const eager = {
  symbol: "Fish",
  mechanism: "identifier",
  accessRequirement: "required",
  executionPhase: "eager",
};
const deferred = { ...eager, executionPhase: "deferred" };
const guarded = { ...eager, accessRequirement: "guarded" };

assert.notEqual(contract.consumerKey(eager), contract.consumerKey(deferred));
assert.notEqual(contract.consumerKey(eager), contract.consumerKey(guarded));
assert.equal(
  contract.providerCandidateIdentity({ currentPath: "src/provider.js" }),
  "src/provider.js",
);
assert.equal(
  contract.providerCandidateIdentity({
    currentPath: "src/provider.js",
    mechanism: "window-property",
  }),
  "src/provider.js",
);

assert.equal(contract.isMechanismCompatible("global-lexical", "identifier"), true);
assert.equal(
  contract.isMechanismCompatible("global-lexical", "window-property"),
  false,
);
for (const providerMechanism of [
  "global-var",
  "global-function",
  "window-property",
  "global-this-property",
  "implicit-global",
]) {
  for (const consumerMechanism of [
    "identifier",
    "window-property",
    "global-this-property",
  ]) {
    assert.equal(
      contract.isMechanismCompatible(providerMechanism, consumerMechanism),
      true,
      `${providerMechanism} → ${consumerMechanism}`,
    );
  }
}

assert.equal(contract.isAvailabilityTrustworthy("program-init"), true);
assert.equal(contract.isAvailabilityTrustworthy("conditional"), false);
assert.equal(contract.isAvailabilityTrustworthy("deferred"), false);
assert.equal(contract.guardedConsumerRelaxesProviderProof(), false);
assert.equal(contract.guardedConsumerPreservesSemantics(), true);

assert.equal(
  contract.assessLoadOrder({
    providerPath: "src/provider.js",
    providerLoadOrder: 40,
    consumerPath: "src/consumer.js",
    consumerLoadOrder: 70,
    executionPhase: "eager",
  }),
  "eligible",
);
assert.equal(
  contract.assessLoadOrder({
    providerPath: "src/provider.js",
    providerLoadOrder: 80,
    consumerPath: "src/consumer.js",
    consumerLoadOrder: 70,
    executionPhase: "conditional",
  }),
  "ineligible",
);
assert.equal(
  contract.assessLoadOrder({
    providerPath: "src/provider.js",
    providerLoadOrder: 80,
    consumerPath: "src/consumer.js",
    consumerLoadOrder: 70,
    executionPhase: "deferred",
  }),
  "eligible",
);
assert.equal(
  contract.assessLoadOrder({
    providerPath: "src/provider.js",
    providerLoadOrder: null,
    consumerPath: "src/consumer.js",
    consumerLoadOrder: 70,
    executionPhase: "eager",
  }),
  "partial",
);
assert.equal(
  contract.assessLoadOrder({
    providerPath: "src/self.js",
    providerLoadOrder: 10,
    consumerPath: "src/self.js",
    consumerLoadOrder: 10,
    executionPhase: "eager",
  }),
  "eligible-self-resolution",
);
assert.throws(
  () => contract.assessLoadOrder({
    providerPath: "src/provider.js",
    providerLoadOrder: 10,
    consumerPath: "src/consumer.js",
    consumerLoadOrder: 20,
    executionPhase: "unknown",
  }),
  /Unsupported consumer execution phase/,
);

assert.equal(contract.classifyTrustworthyProviderCount(0), "unresolved");
assert.equal(contract.classifyTrustworthyProviderCount(1), "confirmed");
assert.equal(contract.classifyTrustworthyProviderCount(2), "ambiguous");
assert.equal(contract.classifyTrustworthyProviderCount(7), "ambiguous");
assert.equal(
  contract.shouldCreateDependencyEdge({
    source: "src/consumer.js",
    target: "src/provider.js",
    resolution: "confirmed",
  }),
  true,
);
assert.equal(
  contract.shouldCreateDependencyEdge({
    source: "src/self.js",
    target: "src/self.js",
    resolution: "confirmed",
  }),
  false,
);
assert.equal(
  contract.shouldCreateDependencyEdge({
    source: "src/consumer.js",
    target: "src/provider.js",
    resolution: "ambiguous",
  }),
  false,
);

assert.equal(model.candidateModel.environmentParticipation, "excluded");
assert.equal(model.filenameHeuristics, "forbidden");
assert.equal(model.pathHeuristics, "forbidden");
assert.equal(model.graphModel.lifecycle, "in-memory-only");
assert.equal(model.graphModel.observationMutation, "forbidden");
assert.equal(model.graphModel.architectureClassification, "forbidden");

console.log(
  "Provider resolution contract passed: consumer keys, source grouping, compatibility, availability, load order, self resolution, and confirmed-only edges verified.",
);
