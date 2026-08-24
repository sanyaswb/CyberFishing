"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { immutableRecord } = require("../guards/core/guard_models");
const { DomainStateOwnershipObserver } = require("./domain_state_ownership_observer");
const { DomainConfigurationInputObserver } = require("./domain_configuration_input_observer");
const { DomainPerformanceRiskObserver } = require("./domain_performance_risk_observer");
const { DomainScopeSelector } = require("./domain_scope_selector");

class DomainSemanticAuditPipeline {
  constructor({
    projectRoot,
    stateObserver = new DomainStateOwnershipObserver(),
    configurationObserver = new DomainConfigurationInputObserver(),
    performanceObserver = new DomainPerformanceRiskObserver(),
  }) {
    this.projectRoot = path.resolve(projectRoot);
    this.stateObserver = stateObserver;
    this.configurationObserver = configurationObserver;
    this.performanceObserver = performanceObserver;
    this.scopeSelector = new DomainScopeSelector();
  }

  observe({ manifest, dependencyAnalyses }) {
    const moduleByPath = new Map(
      manifest.modules.map((entry) => [entry.currentPath, entry]),
    );
    const dependencyByPath = new Map(
      dependencyAnalyses.map((record) => [record.currentPath, record.analysis]),
    );
    return immutableRecord(manifest.modules
      .filter((entry) => this.scopeSelector.includes(entry))
      .map((entry) => {
        const dependency = dependencyByPath.get(entry.currentPath);
        if (!dependency?.facts) {
          throw new Error(`Semantic audit requires dependency facts: ${entry.currentPath}`);
        }
        const source = fs.readFileSync(
          path.resolve(this.projectRoot, entry.currentPath),
          "utf8",
        );
        const browserIdentifiers = dependency.facts.capabilities.flatMap(
          (capability) => capability.identifiers,
        );
        return {
          currentPath: entry.currentPath,
          stateOwnership: this.stateObserver.observe({
            currentPath: entry.currentPath,
            source,
            environment: entry.observed.environment,
            dependencySymbols: entry.analysis.dependencies.confirmed.map(
              (dependency) => dependency.symbol,
            ),
          }),
          configurationInput: this.configurationObserver.observe({
            entry,
            moduleByPath,
          }),
          performanceRisk: this.performanceObserver.observe({
            currentPath: entry.currentPath,
            source,
            browserIdentifiers,
          }),
        };
      })
      .sort((left, right) => this.#compareText(left.currentPath, right.currentPath)));
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { DomainSemanticAuditPipeline };
