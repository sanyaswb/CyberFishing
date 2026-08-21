const estraverse = require("estraverse");

class ExternalIdentifierCandidateDetector {
  constructor({ contextIndex, accessRequirementResolver, executionPhaseResolver }) {
    this.contextIndex = contextIndex;
    this.accessRequirementResolver = accessRequirementResolver;
    this.executionPhaseResolver = executionPhaseResolver;
  }

  detect(syntaxTree, scopeAnalysis) {
    const candidates = [];
    estraverse.traverse(syntaxTree, {
      fallback: "iteration",
      enter: (node) => {
        if (node.type !== "Identifier") return;
        const reference = scopeAnalysis.findReference(node);
        if (!reference || reference.resolved || !reference.isRead()) return;
        if (this.#isInsideWithBody(node)) return;
        const candidate = {
          symbol: node.name,
          mechanism: "identifier",
          node,
        };
        candidates.push({
          ...candidate,
          accessRequirement: this.accessRequirementResolver.resolve(
            candidate,
            scopeAnalysis,
          ),
          executionPhase: this.executionPhaseResolver.resolve(node),
        });
      },
    });
    return { candidates, issues: [], dynamicConstructs: [] };
  }

  #isInsideWithBody(node) {
    return this.contextIndex.ancestors(node).some(
      ({ parent, key }) => parent.type === "WithStatement" && key === "body",
    );
  }
}

module.exports = { ExternalIdentifierCandidateDetector };
