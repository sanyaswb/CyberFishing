const estraverse = require("estraverse");

class ImplicitGlobalProviderDetector {
  constructor({
    assignmentTargetReader,
    availabilityResolver,
    contextIndex,
    environmentSymbols,
  }) {
    this.assignmentTargetReader = assignmentTargetReader;
    this.availabilityResolver = availabilityResolver;
    this.contextIndex = contextIndex;
    this.environmentSymbols = new Set(environmentSymbols);
  }

  detect(syntaxTree, scopeAnalysis) {
    const providers = [];
    estraverse.traverse(syntaxTree, {
      fallback: "iteration",
      enter: (node) => {
        if (node.type === "AssignmentExpression" && node.operator === "=") {
          this.#inspectTargets(node.left, scopeAnalysis, providers);
        } else if (
          (node.type === "ForInStatement" || node.type === "ForOfStatement") &&
          node.left.type !== "VariableDeclaration"
        ) {
          this.#inspectTargets(node.left, scopeAnalysis, providers);
        }
      },
    });
    return { providers, issues: [] };
  }

  #inspectTargets(targetRoot, scopeAnalysis, providers) {
    for (const target of this.assignmentTargetReader.read(targetRoot)) {
      if (target.type !== "Identifier") continue;
      if (this.environmentSymbols.has(target.name)) continue;
      if (this.contextIndex.hasAncestorType(target, "WithStatement")) continue;
      const reference = scopeAnalysis.findReference(target);
      if (!reference || reference.resolved || reference.from.isStrict) continue;
      providers.push({
        symbol: target.name,
        mechanism: "implicit-global",
        availability: this.availabilityResolver.resolve(target),
      });
    }
  }
}

module.exports = { ImplicitGlobalProviderDetector };
