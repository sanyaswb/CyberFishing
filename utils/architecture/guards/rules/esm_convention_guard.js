class EsmConventionGuard {
  run(snapshot, classifier) {
    const modules = new Map(snapshot.manifest.modules.map((item) => [item.currentPath, item]));
    const bridgeGlobals = new Set(snapshot.bridgeRegistry.bridges.flatMap((bridge) => bridge.globalProviders.map((provider) => `${bridge.bridge}\u0000${provider.symbol}\u0000${provider.mechanism}`)));
    const allowedSideEffects = new Set(snapshot.policy.moduleConventions.sideEffectImports.allowedBoundaries);
    const diagnostics = [];
    for (const source of snapshot.sources) {
      if (!source.esm.hasEsmSyntax) continue;
      const module = modules.get(source.currentPath);
      if (!module) continue;
      if (!snapshot.policy.moduleConventions.appliesToStatuses.includes(module.architecture.migrationStatus)) diagnostics.push(this.#classify(classifier, "esm-status-mismatch", source.currentPath, module.architecture.migrationStatus, null, "ESM syntax requires migrating/esm/verified status"));
      for (const observation of source.esm.observations) {
        if (observation.specifierKind === "relative" && !observation.hasExplicitJsExtension) diagnostics.push(this.#classify(classifier, "module-convention/explicit-js", source.currentPath, observation.specifier, observation.location, "Relative ESM specifier requires explicit .js", "module-convention", observation.specifier));
        if (observation.mechanism === "side-effect-import" && !allowedSideEffects.has(module.architecture.targetBoundary)) diagnostics.push(this.#classify(classifier, "module-convention/side-effect-import", source.currentPath, observation.specifier, observation.location, "Side-effect import is restricted to bootstrap/entrypoint boundaries", "side-effect-import", observation.specifier));
        if (observation.mechanism === "dynamic-import" && observation.resolutionStatus === "dynamic-unresolved") diagnostics.push(this.#classify(classifier, "module-convention/dynamic-import", source.currentPath, observation.specifier, observation.location, "Dynamic import target is not statically resolvable", "dynamic-import", observation.specifier));
      }
      for (const exported of source.esm.exports) {
        if (exported.kind === "default") diagnostics.push(this.#classify(classifier, "module-convention/default-export", source.currentPath, "default-export", exported.location, "Named exports are the default convention", "module-convention", "default-export"));
        if (exported.kind === "barrel") diagnostics.push(this.#classify(classifier, "module-convention/barrel-export", source.currentPath, "export-star", exported.location, "Barrel exports require an exact controlled-public-boundary exception", "module-convention", "barrel-export"));
      }
      for (const global of source.esm.globalAssignments) {
        const key = `${source.currentPath}\u0000${global.symbol}\u0000${global.mechanism}`;
        if (!bridgeGlobals.has(key)) diagnostics.push(this.#classify(classifier, "module-convention/esm-global-export", source.currentPath, `${global.mechanism}:${global.symbol}`, global.location, "ESM cannot export through window/globalThis without an active exact bridge", "compatibility-bridge", `${global.mechanism}:${global.symbol}`));
      }
    }
    return diagnostics;
  }
  #classify(classifier, rule, source, target, location, message, exceptionRule = null, subject = null) {
    return classifier.classify({ rule, source, target, location, message, identity: { rule, source, target, line: location?.line || null, column: location?.column || null } }, { debtEligible: false, exceptionRule, exceptionSubject: subject });
  }
}

module.exports = { EsmConventionGuard };
