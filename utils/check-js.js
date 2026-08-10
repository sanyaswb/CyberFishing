const fs = require("fs");
const path = require("path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const IGNORED_DIRS = new Set([
  ".git",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);

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
    try {
      new vm.Script(fs.readFileSync(filePath, "utf8"), { filename: filePath });
      return null;
    } catch (error) {
      const moduleFallback = spawnSync(this.nodePath, ["--check", filePath], {
        encoding: "utf8",
        stdio: "pipe",
      });
      if (moduleFallback.status === 0) return null;
      return {
        stack: moduleFallback.stderr || moduleFallback.stdout || error.stack,
      };
    }
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
      const error = this.#checker.check(filePath);
      if (error) {
        failed = true;
        process.stderr.write(`${error.stack || error.message}\n`);
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
