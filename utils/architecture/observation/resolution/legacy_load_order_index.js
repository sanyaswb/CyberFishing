class LegacyLoadOrderIndex {
  constructor(legacyScripts) {
    this.orderByPath = new Map();
    for (const script of legacyScripts) this.#register(script);
  }

  get(currentPath) {
    return this.orderByPath.has(currentPath)
      ? this.orderByPath.get(currentPath)
      : null;
  }

  #register(script) {
    const currentPath = script?.currentPath;
    if (typeof currentPath !== "string" || currentPath.length === 0) {
      throw new Error("Legacy script requires currentPath");
    }
    if (this.orderByPath.has(currentPath)) {
      throw new Error(`Duplicate legacy script path: ${currentPath}`);
    }
    this.orderByPath.set(currentPath, script.legacyLoadOrder ?? null);
  }
}

module.exports = { LegacyLoadOrderIndex };
