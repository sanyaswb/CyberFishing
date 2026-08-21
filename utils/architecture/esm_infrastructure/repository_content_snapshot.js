const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

class RepositoryContentSnapshot {
  constructor(projectRoot) { this.projectRoot = path.resolve(projectRoot); }

  capture() {
    const records = new Map();
    for (const filePath of this.#walk(this.projectRoot)) {
      const relative = path.relative(this.projectRoot, filePath).replaceAll("\\", "/");
      records.set(relative, crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"));
    }
    return records;
  }

  assertEqual(before, after) {
    const beforeKeys = [...before.keys()].sort();
    const afterKeys = [...after.keys()].sort();
    if (JSON.stringify(beforeKeys) !== JSON.stringify(afterKeys)) throw new Error("Vite fixture build changed repository file membership");
    for (const filePath of beforeKeys) if (before.get(filePath) !== after.get(filePath)) throw new Error(`Vite fixture build changed repository content: ${filePath}`);
  }

  #walk(directory) {
    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && [".git", "node_modules", "dist"].includes(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) files.push(...this.#walk(absolute));
      else if (entry.isFile()) files.push(absolute);
    }
    return files;
  }
}

module.exports = { RepositoryContentSnapshot };
