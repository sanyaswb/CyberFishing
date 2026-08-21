class ManifestDependencyProjector {
  project(sourceResult, graphEdges) {
    const items = graphEdges
      .filter((edge) => edge.source === sourceResult.currentPath)
      .map((edge) => ({
        target: edge.target,
        symbols: [...edge.symbols],
        resolution: "confirmed",
      }))
      .sort((left, right) => this.#compareText(left.target, right.target));
    return {
      status: sourceResult.status,
      confirmed: this.#clone(sourceResult.confirmed),
      items,
      unresolved: this.#clone(sourceResult.unresolved),
      ambiguous: this.#clone(sourceResult.ambiguous),
      issues: this.#clone(sourceResult.issues),
    };
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { ManifestDependencyProjector };
