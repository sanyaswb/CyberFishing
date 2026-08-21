class InMemoryDependencyGraphBuilder {
  constructor(resolutionContract) {
    this.contract = resolutionContract;
  }

  build(sourceResults) {
    const nodes = sourceResults
      .map((source) => source.currentPath)
      .sort((left, right) => this.#compareText(left, right));
    const edgeMap = new Map();

    for (const source of sourceResults) {
      for (const resolution of source.confirmed) {
        if (!this.contract.shouldCreateDependencyEdge({
          source: source.currentPath,
          target: resolution.target,
          resolution: resolution.resolution,
        })) continue;
        const key = `${source.currentPath}\u0000${resolution.target}`;
        const edge = edgeMap.get(key) || {
          source: source.currentPath,
          target: resolution.target,
          symbols: new Set(),
        };
        edge.symbols.add(resolution.symbol);
        edgeMap.set(key, edge);
      }
    }

    const edges = [...edgeMap.values()]
      .map((edge) => ({
        source: edge.source,
        target: edge.target,
        symbols: [...edge.symbols].sort((left, right) =>
          this.#compareText(left, right),
        ),
      }))
      .sort((left, right) =>
        this.#compareText(left.source, right.source) ||
        this.#compareText(left.target, right.target),
      );
    return { nodes, edges };
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { InMemoryDependencyGraphBuilder };
