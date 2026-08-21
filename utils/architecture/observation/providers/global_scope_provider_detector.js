class GlobalScopeProviderDetector {
  detect(_syntaxTree, scopeAnalysis) {
    const providers = [];
    for (const variable of scopeAnalysis.globalScope.variables) {
      for (const definition of variable.defs) {
        const mechanism = this.#resolveMechanism(definition);
        if (!mechanism) continue;
        providers.push({
          symbol: variable.name,
          mechanism,
          availability: "program-init",
        });
      }
    }
    return { providers, issues: [] };
  }

  #resolveMechanism(definition) {
    if (definition.type === "ClassName") return "global-lexical";
    if (definition.type === "FunctionName") return "global-function";
    if (definition.type !== "Variable") return null;
    return definition.parent?.kind === "var"
      ? "global-var"
      : "global-lexical";
  }
}

module.exports = { GlobalScopeProviderDetector };
