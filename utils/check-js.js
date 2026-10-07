const fs = require("fs");
const path = require("path");
const vm = require("node:vm");
const acorn = require("acorn");

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

// A file passes when it parses as a classic script or as an ES module. `node --check` is not used:
// with module detection it exits 0 for a `.js` file whose ES module syntax is invalid.
class JavaScriptSyntaxChecker {
  check(filePath) {
    const source = fs.readFileSync(filePath, "utf8");
    try {
      new vm.Script(source, { filename: filePath });
      return null;
    } catch (scriptError) {
      try {
        acorn.parse(source, { ecmaVersion: "latest", sourceType: "module" });
        return null;
      } catch (moduleError) {
        return { stack: `${filePath}: ${moduleError.message}\n(as a script: ${scriptError.message})` };
      }
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
