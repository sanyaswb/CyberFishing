const fs = require("node:fs");

class LegacyScriptOrderReader {
  constructor(indexPath, { scriptAliases = new Map() } = {}) {
    this.indexPath = indexPath;
    this.scriptAliases = new Map(scriptAliases);
  }

  read() {
    const html = fs.readFileSync(this.indexPath, "utf8");
    const scriptPattern = /<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi;
    const scripts = [];
    let legacyLoadOrder = 1;
    let match = scriptPattern.exec(html);
    while (match) {
      const attributes = `${match[1]} ${match[3]}`;
      const type = /\btype\s*=\s*["']module["']/i.test(attributes)
        ? "module"
        : "classic";
      const source = match[2];
      const normalizedSource = this.#normalizeSourcePath(source);
      if (
        this.scriptAliases.has(normalizedSource) &&
        this.scriptAliases.get(normalizedSource) === null
      ) {
        match = scriptPattern.exec(html);
        continue;
      }
      scripts.push({
        documentOrder: scripts.length + 1,
        currentPath: this.scriptAliases.get(normalizedSource) || normalizedSource,
        source,
        type,
        legacyLoadOrder: type === "classic" ? legacyLoadOrder : null,
      });
      if (type === "classic") legacyLoadOrder += 1;
      match = scriptPattern.exec(html);
    }
    return scripts;
  }

  #normalizeSourcePath(source) {
    const withoutQuery = source.split(/[?#]/, 1)[0].replaceAll("\\", "/");
    return withoutQuery.startsWith("./")
      ? withoutQuery.slice(2)
      : withoutQuery;
  }
}

module.exports = { LegacyScriptOrderReader };
