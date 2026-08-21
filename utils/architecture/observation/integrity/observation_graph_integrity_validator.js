class ObservationGraphIntegrityValidator {
  constructor(resolutionModel) {
    this.resolutionModel = resolutionModel;
  }

  validate({ manifest, graph, reverseConsumerIndex }) {
    const nodes = new Set(graph.nodes());
    const expectedEdges = new Map();
    const summary = {
      modules: manifest.modules.length,
      consumers: 0,
      confirmed: 0,
      selfConfirmed: 0,
      unresolved: 0,
      ambiguous: 0,
      edges: 0,
      reverseLinks: 0,
      targetsWithConsumers: 0,
    };

    for (const entry of manifest.modules) {
      this.#assertObservationIsPersisted(entry);
      this.#validateEntry(entry, nodes, expectedEdges, summary);
    }
    const expected = this.#materializeEdges(expectedEdges);
    const actual = graph.edges();
    this.#assertEqualGraph(
      actual,
      expected,
      "Persisted dependency edges do not match fact-level confirmed provenance",
    );
    this.#validateReverseRoundTrip(
      reverseConsumerIndex,
      graph,
      summary,
    );
    summary.edges = actual.length;
    return summary;
  }

  #validateEntry(entry, nodes, expectedEdges, summary) {
    const consumers = entry.observed.consumers.items;
    const consumerKeys = consumers.map((record) => this.#consumerKey(record));
    this.#requireSortedUnique(
      consumerKeys,
      `${entry.currentPath}: observed consumers`,
    );
    summary.consumers += consumers.length;

    const dependencies = entry.analysis.dependencies;
    const resolvedKeys = [];
    const confirmedKeys = [];
    for (const record of dependencies.confirmed) {
      this.#assertResolution(record, "confirmed", entry.currentPath);
      if (!nodes.has(record.target)) {
        throw new Error(
          `${entry.currentPath}: confirmed resolution targets unknown source: ${record.target}`,
        );
      }
      const consumerKey = this.#consumerKey(record);
      confirmedKeys.push(consumerKey);
      resolvedKeys.push(consumerKey);
      summary.confirmed += 1;
      if (record.target === entry.currentPath) {
        summary.selfConfirmed += 1;
      } else {
        this.#registerExpectedEdge(
          expectedEdges,
          entry.currentPath,
          record.target,
          record.symbol,
        );
      }
    }
    this.#requireSortedUnique(
      confirmedKeys,
      `${entry.currentPath}: confirmed resolutions`,
    );
    const unresolvedKeys = [];
    for (const record of dependencies.unresolved) {
      this.#assertResolution(record, "unresolved", entry.currentPath);
      const consumerKey = this.#consumerKey(record);
      unresolvedKeys.push(consumerKey);
      resolvedKeys.push(consumerKey);
      summary.unresolved += 1;
    }
    this.#requireSortedUnique(
      unresolvedKeys,
      `${entry.currentPath}: unresolved resolutions`,
    );
    const ambiguousKeys = [];
    for (const record of dependencies.ambiguous) {
      this.#assertResolution(record, "ambiguous", entry.currentPath);
      const consumerKey = this.#consumerKey(record);
      ambiguousKeys.push(consumerKey);
      resolvedKeys.push(consumerKey);
      summary.ambiguous += 1;
    }
    this.#requireSortedUnique(
      ambiguousKeys,
      `${entry.currentPath}: ambiguous resolutions`,
    );
    this.#requireSortedUnique(
      [...resolvedKeys].sort((left, right) => this.#compareText(left, right)),
      `${entry.currentPath}: resolution outcomes`,
    );
    const sortedConsumerKeys = [...consumerKeys].sort((left, right) =>
      this.#compareText(left, right),
    );
    const sortedResolvedKeys = [...resolvedKeys].sort((left, right) =>
      this.#compareText(left, right),
    );
    if (JSON.stringify(sortedConsumerKeys) !== JSON.stringify(sortedResolvedKeys)) {
      throw new Error(
        `${entry.currentPath}: every observed consumer requires exactly one resolution outcome`,
      );
    }
  }

  #assertObservationIsPersisted(entry) {
    for (const [label, status] of [
      ["providers", entry.observed?.providers?.status],
      ["consumers", entry.observed?.consumers?.status],
      ["environment", entry.observed?.environment?.status],
      ["dependencies", entry.analysis?.dependencies?.status],
    ]) {
      if (status === "pending" || status === undefined) {
        throw new Error(
          `${entry.currentPath}: ${label} observation is not persisted`,
        );
      }
    }
  }

  #assertResolution(record, kind, currentPath) {
    if (record?.resolution !== kind) {
      throw new Error(
        `${currentPath}: invalid ${kind} resolution for ${record?.symbol}`,
      );
    }
  }

  #registerExpectedEdge(edgeMap, source, target, symbol) {
    const key = `${source}\u0000${target}`;
    const edge = edgeMap.get(key) || { source, target, symbols: new Set() };
    edge.symbols.add(symbol);
    edgeMap.set(key, edge);
  }

  #materializeEdges(edgeMap) {
    return [...edgeMap.values()]
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
  }

  #validateReverseRoundTrip(reverseConsumerIndex, graph, summary) {
    const reverseEntries = reverseConsumerIndex.entries();
    const entryPaths = reverseEntries.map((entry) => entry.currentPath);
    if (JSON.stringify(entryPaths) !== JSON.stringify(graph.nodes())) {
      throw new Error("Derived reverse index must contain every graph node");
    }
    const roundTrip = [];
    for (const entry of reverseEntries) {
      const sourceKeys = entry.consumers.map((consumer) => consumer.source);
      this.#requireSortedUnique(
        sourceKeys,
        `${entry.currentPath}: reverse consumers`,
      );
      if (entry.consumers.length > 0) summary.targetsWithConsumers += 1;
      for (const consumer of entry.consumers) {
        summary.reverseLinks += 1;
        roundTrip.push({
          source: consumer.source,
          target: entry.currentPath,
          symbols: [...consumer.symbols],
        });
      }
    }
    roundTrip.sort((left, right) =>
      this.#compareText(left.source, right.source) ||
      this.#compareText(left.target, right.target),
    );
    this.#assertEqualGraph(
      roundTrip,
      graph.edges(),
      "Derived reverse consumers do not round-trip to authoritative edges",
    );
  }

  #assertEqualGraph(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(message);
    }
  }

  #consumerKey(record) {
    return this.resolutionModel.resolutionUnit.keyFields
      .map((field) => record?.[field])
      .join("\u0000");
  }

  #requireSortedUnique(values, label) {
    if (new Set(values).size !== values.length) {
      throw new Error(`${label} must not contain duplicates`);
    }
    const sorted = [...values].sort((left, right) =>
      this.#compareText(left, right),
    );
    if (values.some((value, index) => value !== sorted[index])) {
      throw new Error(`${label} must use deterministic ascending order`);
    }
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { ObservationGraphIntegrityValidator };
