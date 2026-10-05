const fs = require("node:fs");
const path = require("node:path");

// Reads the ordered legacy scripts of index.html. Every classic script occupies one logical legacy
// slot (legacyLoadOrder) unless it is a member of a split slot: the members of one historical slot
// all carry data-legacy-slot="N" and share slot N in their physical document order, so extracting a
// declaration into its own classic file never renumbers the other logical slots. Documents without
// the attribute keep their historical one-script-per-slot interpretation.
class LegacyScriptOrderReader {
  constructor(indexPath, { scriptAliases = new Map() } = {}) {
    this.indexPath = indexPath;
    this.scriptAliases = new Map(scriptAliases);
  }

  // The reviewed legacy document is policy-owned; an absent selection never falls back to production.
  static sourcePath(projectRoot, policy = null) {
    const definition = policy ?? JSON.parse(fs.readFileSync(
      path.join(projectRoot, "architecture/module_architecture.json"), "utf8"));
    const source = definition.migrationManifest?.legacyLoadOrder?.source;
    if (source !== "index.html" && source !== "dev.html") {
      throw new Error(`Unreviewed legacy load-order source: ${source}`);
    }
    const sourcePath = path.join(projectRoot, source);
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
      throw new Error(`Selected legacy load-order source is missing: ${source}`);
    }
    return sourcePath;
  }

  // Number of logical classic slots of read scripts (members of a split slot count once).
  static logicalSlotCount(scripts) {
    return new Set(scripts.filter(script => script.type === "classic").map(script => script.legacyLoadOrder)).size;
  }

  // Paths of the classic scripts at one logical slot, in physical order (several for a split slot).
  static pathsAtSlot(scripts, slot) {
    return scripts.filter(script => script.type === "classic" && script.legacyLoadOrder === slot)
      .map(script => script.currentPath);
  }

  read() {
    const html = fs.readFileSync(this.indexPath, "utf8");
    return this.parse(html);
  }

  parse(html) {
    // Harmless approved tombstones preserve historical slot identities after deleting obsolete files.
    const scriptPattern = /<!-- retired-legacy-slot ([1-9][0-9]*): (src\/[a-z0-9_/.]+\.js) -->|<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi;
    const scripts = [];
    const closedSlots = new Set();
    let legacyLoadOrder = 1;
    let openSlot = null;
    let memberIndex = 0;
    let match = scriptPattern.exec(html);
    while (match) {
      if (match[1]) {
        if (openSlot !== null) { closedSlots.add(openSlot); openSlot = null; legacyLoadOrder += 1; }
        if (Number(match[1]) !== legacyLoadOrder) throw new Error("Retired legacy slot is not at its historical position");
        legacyLoadOrder += 1; match = scriptPattern.exec(html); continue;
      }
      const attributes = `${match[3]} ${match[5]}`;
      const type = /\btype\s*=\s*["']module["']/i.test(attributes)
        ? "module"
        : "classic";
      const source = match[4];
      const normalizedSource = this.#normalizeSourcePath(source);
      if (
        this.scriptAliases.has(normalizedSource) &&
        this.scriptAliases.get(normalizedSource) === null
      ) {
        match = scriptPattern.exec(html);
        continue;
      }
      const slot = this.#splitSlot(attributes, source, type);
      if (openSlot !== null && slot !== openSlot) {
        closedSlots.add(openSlot);
        openSlot = null;
        legacyLoadOrder += 1;
      }
      if (slot !== null && openSlot === null) {
        if (closedSlots.has(slot)) throw new Error(`Split legacy slot ${slot} members are not contiguous: ${source}`);
        if (slot !== legacyLoadOrder) {
          throw new Error(`Split legacy slot ${slot} starts at logical slot ${legacyLoadOrder}: ${source}`);
        }
        openSlot = slot;
        memberIndex = 0;
      }
      scripts.push({
        documentOrder: scripts.length + 1,
        currentPath: this.scriptAliases.get(normalizedSource) || normalizedSource,
        source,
        type,
        legacyLoadOrder: type === "classic" ? legacyLoadOrder : null,
        ...(slot === null ? {} : { slotMember: { slot, index: memberIndex } }),
      });
      if (slot !== null) memberIndex += 1;
      else if (type === "classic") legacyLoadOrder += 1;
      match = scriptPattern.exec(html);
    }
    return scripts;
  }

  // The split slot a classic script belongs to, or null.
  #splitSlot(attributes, source, type) {
    const declared = attributes.match(/\bdata-legacy-slot\s*=\s*["']([^"']*)["']/i);
    if (!declared) return null;
    if (type !== "classic") throw new Error(`Only classic scripts can share a legacy slot: ${source}`);
    if (!/^[1-9]\d*$/u.test(declared[1])) throw new Error(`Invalid data-legacy-slot on ${source}: ${declared[1]}`);
    return Number(declared[1]);
  }

  #normalizeSourcePath(source) {
    const withoutQuery = source.split(/[?#]/, 1)[0].replaceAll("\\", "/");
    return withoutQuery.startsWith("./")
      ? withoutQuery.slice(2)
      : withoutQuery;
  }
}

module.exports = { LegacyScriptOrderReader };
