const DEV_TOOLS_PARAMETER_ALIAS_SCHEMA = Object.freeze([
  Object.freeze({
    id: "fish_anomaly_chance_override",
    canonicalPath: Object.freeze([
      "CONFIG",
      "debug",
      "godMode",
      "forceAnomalyChance",
    ]),
    aliases: Object.freeze([
      Object.freeze([
        "CONFIG",
        "debug",
        "fixedCatch",
        "hasAnomaly",
      ]),
    ]),
  }),
]);

class DevToolsParameterAliasRegistry {
  #canonicalByPath = new Map();
  #canonicalPaths = new Set();
  #aliasesByParentPath = new Map();

  constructor(schema = DEV_TOOLS_PARAMETER_ALIAS_SCHEMA) {
    for (const group of Array.isArray(schema) ? schema : []) {
      this.#registerGroup(group);
    }
  }

  resolveCanonicalPath(path) {
    const normalizedPath = this.#normalizePath(path);
    return this.#canonicalByPath.get(normalizedPath)?.slice() ||
      this.#toPath(path);
  }

  getAliasesForParent(path) {
    const aliases = this.#aliasesByParentPath.get(this.#normalizePath(path));
    return aliases ? aliases.slice() : [];
  }

  normalizeConfigOverrides(overrides = {}) {
    const entries = Object.entries(overrides || {});
    const normalized = {};
    for (const [path, value] of entries) {
      if (this.#isCanonicalConfigPath(path)) continue;
      this.#writeNormalizedOverride(normalized, path, value);
    }
    for (const [path, value] of entries) {
      if (!this.#isCanonicalConfigPath(path)) continue;
      this.#writeNormalizedOverride(normalized, path, value);
    }
    return normalized;
  }

  #registerGroup(group) {
    const canonicalPath = this.#toPath(group?.canonicalPath);
    if (canonicalPath.length < 2) return;

    const canonicalKey = this.#normalizePath(canonicalPath);
    this.#canonicalByPath.set(canonicalKey, canonicalPath);
    this.#canonicalPaths.add(canonicalKey);

    for (const aliasPathSource of group?.aliases || []) {
      const aliasPath = this.#toPath(aliasPathSource);
      if (aliasPath.length < 2) continue;

      const aliasKey = this.#normalizePath(aliasPath);
      const parentKey = this.#normalizePath(aliasPath.slice(0, -1));
      this.#canonicalByPath.set(aliasKey, canonicalPath);

      const aliases = this.#aliasesByParentPath.get(parentKey) || [];
      aliases.push(Object.freeze({
        key: aliasPath.at(-1),
        displayPath: Object.freeze(aliasPath),
        canonicalPath: Object.freeze(canonicalPath.slice()),
        groupId: String(group?.id || canonicalKey),
      }));
      this.#aliasesByParentPath.set(parentKey, aliases);
    }
  }

  #toPath(path) {
    if (Array.isArray(path)) return path.map(String);
    return String(path || "").split(".").filter(Boolean);
  }

  #isCanonicalConfigPath(path) {
    return this.#canonicalPaths.has(
      this.#normalizePath(this.#withConfigRoot(path)),
    );
  }

  #writeNormalizedOverride(target, path, value) {
    const canonicalPath = this.resolveCanonicalPath(this.#withConfigRoot(path));
    const runtimePath = canonicalPath[0] === "CONFIG"
      ? canonicalPath.slice(1)
      : canonicalPath;
    target[runtimePath.join(".")] = value;
  }

  #withConfigRoot(path) {
    const parts = this.#toPath(path);
    return parts[0] === "CONFIG" ? parts : ["CONFIG", ...parts];
  }

  #normalizePath(path) {
    return this.#toPath(path).join(".");
  }
}

window.DEV_TOOLS_PARAMETER_ALIAS_SCHEMA = DEV_TOOLS_PARAMETER_ALIAS_SCHEMA;
window.DevToolsParameterAliasRegistry = DevToolsParameterAliasRegistry;
