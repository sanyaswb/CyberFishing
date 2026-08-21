class PersistedDependencyGraph {
  constructor(manifest) {
    this.nodePaths = this.#readNodes(manifest);
    this.edgeRecords = this.#readEdges(manifest, new Set(this.nodePaths));
  }

  nodes() {
    return [...this.nodePaths];
  }

  edges() {
    return this.#clone(this.edgeRecords);
  }

  #readNodes(manifest) {
    if (!Array.isArray(manifest?.modules)) {
      throw new Error("Persisted dependency graph requires manifest modules");
    }
    const paths = manifest.modules.map((entry) => entry?.currentPath);
    if (paths.some((currentPath) =>
      typeof currentPath !== "string" || currentPath.length === 0
    )) {
      throw new Error("Persisted dependency graph requires valid currentPath nodes");
    }
    this.#requireSortedUnique(paths, "Manifest graph nodes");
    return paths;
  }

  #readEdges(manifest, nodeSet) {
    const edges = [];
    for (const entry of manifest.modules) {
      this.#assertReverseConsumersAreNotPersisted(entry);
      const items = entry.analysis?.dependencies?.items;
      if (!Array.isArray(items)) {
        throw new Error(`${entry.currentPath}: dependency items must be an array`);
      }
      const targets = [];
      for (const item of items) {
        if (item?.resolution !== "confirmed") {
          throw new Error(
            `${entry.currentPath}: graph edge must be confirmed: ${item?.target}`,
          );
        }
        if (!nodeSet.has(item.target)) {
          throw new Error(
            `${entry.currentPath}: graph edge targets unknown source: ${item.target}`,
          );
        }
        if (item.target === entry.currentPath) {
          throw new Error(
            `${entry.currentPath}: self-resolution must not create a graph edge`,
          );
        }
        this.#requireSymbols(item.symbols, entry.currentPath, item.target);
        targets.push(item.target);
        edges.push({
          source: entry.currentPath,
          target: item.target,
          symbols: [...item.symbols],
        });
      }
      this.#requireSortedUnique(
        targets,
        `${entry.currentPath}: dependency targets`,
      );
    }
    const edgeKeys = edges.map((edge) =>
      `${edge.source}\u0000${edge.target}`
    );
    this.#requireSortedUnique(edgeKeys, "Persisted dependency graph edges");
    return edges;
  }

  #assertReverseConsumersAreNotPersisted(entry) {
    if (
      entry.consumers !== undefined ||
      entry.analysis?.consumers !== undefined ||
      entry.analysis?.reverseConsumers !== undefined ||
      entry.analysis?.dependencies?.consumers !== undefined
    ) {
      throw new Error(
        `${entry.currentPath}: reverse consumers must remain derived-only`,
      );
    }
  }

  #requireSymbols(symbols, source, target) {
    if (!Array.isArray(symbols) || symbols.length === 0) {
      throw new Error(`${source} → ${target}: edge requires symbols`);
    }
    if (symbols.some((symbol) =>
      typeof symbol !== "string" || symbol.length === 0
    )) {
      throw new Error(`${source} → ${target}: edge contains invalid symbol`);
    }
    this.#requireSortedUnique(symbols, `${source} → ${target}: edge symbols`);
  }

  #requireSortedUnique(values, label) {
    const sorted = [...new Set(values)].sort((left, right) =>
      this.#compareText(left, right),
    );
    if (
      sorted.length !== values.length ||
      values.some((value, index) => value !== sorted[index])
    ) {
      throw new Error(`${label} must be sorted and unique`);
    }
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

module.exports = { PersistedDependencyGraph };
