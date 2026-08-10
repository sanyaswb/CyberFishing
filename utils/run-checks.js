const path = require("node:path");
const {
  CheckCatalog,
  CheckCatalogFileValidator,
} = require("./testing/core/check_catalog");
const {
  CheckProcessExecutor,
  CheckSuiteRunner,
} = require("./testing/core/check_runner");
const { CHECK_DEFINITIONS } = require("./testing/suites/check_manifest");

const PROJECT_ROOT = path.resolve(__dirname, "..");

class CheckCommandArguments {
  constructor(argv) {
    this.argv = argv;
  }

  parse() {
    if (this.argv.includes("--list")) return { mode: "list" };
    const checkId = this.#readValue("--check");
    if (checkId) return { mode: "check", value: checkId };
    return { mode: "suite", value: this.#readValue("--suite") || "all" };
  }

  #readValue(option) {
    const index = this.argv.indexOf(option);
    if (index < 0) return null;
    const value = this.argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${option} requires a value`);
    }
    return value;
  }
}

class CheckCommand {
  constructor({ catalog, runner }) {
    this.catalog = catalog;
    this.runner = runner;
  }

  run(argv) {
    const selection = new CheckCommandArguments(argv).parse();
    if (selection.mode === "list") {
      this.#printCatalog();
      return;
    }
    const checks = selection.mode === "check"
      ? [this.catalog.findById(selection.value)]
      : this.catalog.findBySuite(selection.value);
    this.runner.run(checks);
  }

  #printCatalog() {
    console.log(`Suites: all, ${this.catalog.listSuites().join(", ")}`);
    for (const check of this.catalog.list()) {
      console.log(`${check.id.padEnd(30)} ${check.title}`);
    }
  }
}

const catalog = new CheckCatalog(CHECK_DEFINITIONS);
new CheckCatalogFileValidator({ projectRoot: PROJECT_ROOT }).assertValid(catalog);
const executor = new CheckProcessExecutor({ projectRoot: PROJECT_ROOT });
new CheckCommand({
  catalog,
  runner: new CheckSuiteRunner({ executor }),
}).run(process.argv.slice(2));
