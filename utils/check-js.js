const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const IGNORED_DIRS = new Set([".git", "node_modules"]);

class JavaScriptFileFinder {
  constructor(rootDir) {
    this.rootDir = rootDir;
  }

  findAll() {
    const files = [];
    this.#walk(this.rootDir, files);
    return files.sort();
  }

  #walk(directory, files) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        this.#walk(fullPath, files);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        files.push(fullPath);
      }
    }
  }
}

class JavaScriptSyntaxChecker {
  constructor(nodePath = process.execPath) {
    this.nodePath = nodePath;
  }

  check(filePath) {
    return spawnSync(this.nodePath, ["--check", filePath], {
      encoding: "utf8",
      stdio: "pipe",
    });
  }
}

class CheckJsCommand {
  #finder;
  #checker;

  constructor({
    finder = new JavaScriptFileFinder(ROOT_DIR),
    checker = new JavaScriptSyntaxChecker(),
  } = {}) {
    this.#finder = finder;
    this.#checker = checker;
  }

  run() {
    const files = this.#finder.findAll();
    let failed = false;

    for (const filePath of files) {
      const result = this.#checker.check(filePath);
      if (result.status !== 0) {
        failed = true;
        process.stderr.write(result.stderr || result.stdout);
      }
    }

    if (failed) {
      process.exitCode = 1;
      return;
    }

    console.log(`Checked ${files.length} JavaScript files. No syntax errors.`);
  }
}

new CheckJsCommand().run();
