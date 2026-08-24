"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { immutableRecord } = require("../guards/core/guard_models");
const { DomainSourceEffectObserver } = require("./domain_source_effect_observer");
const { DomainCapabilityClassifier } = require("./domain_capability_classifier");
const { DomainAvailabilityAnalyzer } = require("./domain_availability_analyzer");
const {
  DomainDependencyAuditAssembler,
} = require("./domain_dependency_audit_assembler");
const { DomainScopeSelector } = require("./domain_scope_selector");

class DomainDependencyAuditPipeline {
  constructor({ projectRoot, policy, sourceObserver = new DomainSourceEffectObserver() }) {
    this.projectRoot = path.resolve(projectRoot);
    this.policy = policy;
    this.sourceObserver = sourceObserver;
    this.capabilityClassifier = new DomainCapabilityClassifier(
      policy.architectureGuards.browserCapabilities,
    );
    this.availabilityAnalyzer = new DomainAvailabilityAnalyzer(
      policy.migrationManifest.observationContract.resolutionModel,
    );
    this.assembler = new DomainDependencyAuditAssembler(policy);
    this.scopeSelector = new DomainScopeSelector();
  }

  observe({ manifest, graph, topology }) {
    const moduleByPath = new Map(
      manifest.modules.map((entry) => [entry.currentPath, entry]),
    );
    const records = manifest.modules
      .filter((entry) => this.scopeSelector.includes(entry))
      .map((entry) => {
        const source = fs.readFileSync(
          path.resolve(this.projectRoot, entry.currentPath),
          "utf8",
        );
        const sourceObservation = this.sourceObserver.observe({
          currentPath: entry.currentPath,
          source,
          environment: entry.observed.environment,
        });
        const capabilityObservation = this.capabilityClassifier.classify({
          entry,
          sourceObservation,
        });
        const availabilityConstraints = this.availabilityAnalyzer.analyze({
          entry,
          moduleByPath,
        });
        return {
          currentPath: entry.currentPath,
          analysis: this.assembler.assemble({
            entry,
            graph,
            topology,
            sourceObservation,
            capabilityObservation,
            availabilityConstraints,
          }),
        };
      })
      .sort((left, right) => this.#compareText(left.currentPath, right.currentPath));
    return immutableRecord(records);
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { DomainDependencyAuditPipeline };
