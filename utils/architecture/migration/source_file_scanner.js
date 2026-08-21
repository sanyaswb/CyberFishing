const fs = require("node:fs");
const path = require("node:path");

class SourceFileScanner {
  constructor({ projectRoot, sourceRoot }) {
    this.projectRoot = projectRoot;
    this.sourceRoot = sourceRoot;
  }

  scan() {
    const files = [];
    this.#walk(this.sourceRoot, files);
    return files
      .map((absolutePath) => ({
        absolutePath,
        currentPath: this.#relative(absolutePath),
      }))
      .sort((left, right) =>
        this.#comparePaths(left.currentPath, right.currentPath),
      );
  }

  #walk(directory, files) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        this.#walk(fullPath, files);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        files.push(fullPath);
      }
    }
  }

  #relative(absolutePath) {
    return path
      .relative(this.projectRoot, absolutePath)
      .replaceAll("\\", "/");
  }

  #comparePaths(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { SourceFileScanner };
