const { GuardOutcomeClassifier } = require("./core/guard_outcome_classifier");
const { GuardReport } = require("./core/guard_models");
const { BoundaryGuard } = require("./rules/boundary_guard");
const { PhysicalTargetPathGuard } = require("./rules/physical_target_path_guard");
const { SccCycleGuard } = require("./rules/scc_cycle_guard");
const { GlobalNamespaceGuard } = require("./rules/global_namespace_guard");
const { BrowserCapabilityGuard } = require("./rules/browser_capability_guard");
const { DevLeakageGuard } = require("./rules/dev_leakage_guard");
const { EsmConventionGuard } = require("./rules/esm_convention_guard");
const { BridgeRegistryGuard } = require("./rules/bridge_registry_guard");

class ArchitectureGuardEngine {
  constructor({ projectRoot, rules = null }) {
    this.rules = rules || [new BridgeRegistryGuard(), new BoundaryGuard(), new PhysicalTargetPathGuard(projectRoot), new SccCycleGuard(), new GlobalNamespaceGuard(), new BrowserCapabilityGuard(), new DevLeakageGuard(), new EsmConventionGuard()];
  }
  run(snapshot, { includeStaleMetadata = true } = {}) {
    const classifier = new GuardOutcomeClassifier({ debts: snapshot.debtRegistry.debts, exceptions: snapshot.policy.exceptions.entries });
    const diagnostics = this.rules.flatMap((rule) => rule.run(snapshot, classifier));
    if (includeStaleMetadata) diagnostics.push(...classifier.staleMetadataDiagnostics(snapshot.bridgeRegistry.bridges));
    const passCount = diagnostics.filter((item) => item.status === "PASS").length + snapshot.graph.edges.length;
    return new GuardReport(diagnostics, passCount);
  }
}

module.exports = { ArchitectureGuardEngine };
