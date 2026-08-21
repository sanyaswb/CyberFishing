const eslintScope = require("eslint-scope");

class ScopeAnalysis {
  constructor(scopeManager) {
    this.scopeManager = scopeManager;
    this.referencesByIdentifier = this.#indexReferences(scopeManager.scopes);
  }

  get globalScope() {
    return this.scopeManager.globalScope;
  }

  findReference(identifier) {
    return this.referencesByIdentifier.get(identifier) || null;
  }

  isUnshadowedGlobalReference(identifier, expectedName) {
    if (identifier?.type !== "Identifier" || identifier.name !== expectedName) {
      return false;
    }
    const reference = this.findReference(identifier);
    return !!reference && reference.resolved === null;
  }

  #indexReferences(scopes) {
    const references = new Map();
    for (const scope of scopes) {
      for (const reference of scope.references) {
        references.set(reference.identifier, reference);
      }
    }
    return references;
  }
}

class EslintScopeAnalyzer {
  analyze(syntaxTree) {
    return new ScopeAnalysis(
      eslintScope.analyze(syntaxTree, {
        ecmaVersion: 2026,
        sourceType: "script",
        optimistic: true,
        ignoreEval: false,
        nodejsScope: false,
      }),
    );
  }
}

module.exports = { EslintScopeAnalyzer, ScopeAnalysis };
