class DerivedReverseConsumerIndex {
  constructor(graph) {
    this.reverseEntries = this.#build(graph);
  }

  entries() {
    return this.#clone(this.reverseEntries);
  }

  consumersOf(currentPath) {
    const entry = this.reverseEntries.find((item) =>
      item.currentPath === currentPath
    );
    return entry ? this.#clone(entry.consumers) : [];
  }

  #build(graph) {
    const byTarget = new Map(
      graph.nodes().map((currentPath) => [currentPath, []]),
    );
    for (const edge of graph.edges()) {
      byTarget.get(edge.target).push({
        source: edge.source,
        symbols: [...edge.symbols],
      });
    }
    return [...byTarget.entries()]
      .map(([currentPath, consumers]) => ({
        currentPath,
        consumers: consumers.sort((left, right) =>
          this.#compareText(left.source, right.source),
        ),
      }))
      .sort((left, right) =>
        this.#compareText(left.currentPath, right.currentPath),
      );
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

module.exports = { DerivedReverseConsumerIndex };
