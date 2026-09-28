const path = require("node:path");
const {
  CheckCatalog,
  CheckCatalogFileValidator,
} = require("./testing/core/check_catalog");
const {
  CheckSuiteRunner,
  SealingCheckExecutor,
} = require("./testing/core/check_runner");
const { CheckRunReport } = require("./testing/core/check_report");
const { CHECK_DEFINITIONS } = require("./testing/suites/check_manifest");
const { applyCheckPolicies } = require("./testing/suites/check_policies");

const PROJECT_ROOT = path.resolve(__dirname, "..");

class CheckCommandArguments {
  constructor(argv) {
    this.argv = argv;
  }

  parse() {
    if (this.argv.includes("--list")) return { mode: "list" };
    const acceptance = this.argv.includes("--acceptance");
    const releaseGate = this.argv.includes("--release-gate");
    const checkId = this.#readValue("--check");
    const suite = this.#readValue("--suite");
    const noSeal = this.argv.includes("--no-seal");
    const reseal = this.argv.includes("--reseal");
    const report = this.#readValue("--report");
    const jobsValue = this.#readValue("--jobs");
    const jobs = jobsValue === null ? 4 : Number(jobsValue);
    if (!Number.isInteger(jobs) || jobs < 1) throw new Error("--jobs requires a positive integer");
    if (noSeal && reseal) throw new Error("--no-seal and --reseal are exclusive");
    if (report !== null) this.#assertReportPath(report);
    if (acceptance && releaseGate) throw new Error("--acceptance and --release-gate are exclusive");
    const gate = acceptance ? "--acceptance" : releaseGate ? "--release-gate" : null;
    if (gate) {
      if (checkId || suite) throw new Error(`${gate} always runs the complete catalog: remove --check/--suite`);
      if (noSeal || reseal) throw new Error(`${gate} decides seal use itself: remove --no-seal/--reseal`);
      if (report === null) throw new Error(`${gate} requires --report <absolute-report-path>`);
    }
    return {
      mode: acceptance ? "acceptance" : releaseGate ? "release-gate" : checkId ? "check" : "suite",
      value: checkId || suite || "all",
      sealMode: acceptance || reseal ? "reseal" : noSeal ? "none" : "use",
      report,
      jobs,
    };
  }

  // Reports live outside the source snapshot: outside the project or in the runner cache.
  #assertReportPath(report) {
    if (!path.isAbsolute(report)) throw new Error("--report requires an absolute path");
    const relative = path.relative(PROJECT_ROOT, report).replaceAll("\\", "/");
    const inside = !relative.startsWith("..") && !path.isAbsolute(relative);
    if (inside && !relative.startsWith("node_modules/.cache/")) {
      throw new Error("--report must be outside the project or under node_modules/.cache/");
    }
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
  constructor({ catalog }) {
    this.catalog = catalog;
  }

  async run(argv) {
    const selection = new CheckCommandArguments(argv).parse();
    if (selection.mode === "list") {
      this.#printCatalog();
      return;
    }
    const checks = selection.mode === "check"
      ? [this.catalog.findById(selection.value)]
      : ["acceptance", "release-gate"].includes(selection.mode) ? this.catalog.list() : this.catalog.findBySuite(selection.value);
    const executor = new SealingCheckExecutor({ projectRoot: PROJECT_ROOT, mode: selection.sealMode });
    const report = selection.report === null ? null : new CheckRunReport({ projectRoot: PROJECT_ROOT,
      mode: ["acceptance", "release-gate"].includes(selection.mode) ? selection.mode : "development", argv, jobs: selection.jobs,
      catalog: this.catalog.list(), file: selection.report });
    await new CheckSuiteRunner({ executor, jobs: selection.jobs, report }).run(checks);
  }

  #printCatalog() {
    console.log(`Suites: all, ${this.catalog.listSuites().join(", ")}`);
    for (const check of this.catalog.list()) {
      console.log(`${check.id.padEnd(30)} ${check.title}`);
    }
  }
}

const catalog = new CheckCatalog(applyCheckPolicies(CHECK_DEFINITIONS));
new CheckCatalogFileValidator({ projectRoot: PROJECT_ROOT }).assertValid(catalog);
// Every check executes under the input tracer. A check with a reviewed "snapshot" cache policy
// whose seal still holds is reported as cached instead of re-executed; everything else executes.
// --no-seal: execute without using or creating seals. --reseal: execute everything, seal the
// eligible. --acceptance --report <abs>: execute the complete catalog (never cached) and write the
// acceptance report. --release-gate --report <abs>: the complete catalog where only history replays
// may reuse a proven PASS. --jobs N (default 4): read-only checks run in parallel, all others alone.
new CheckCommand({ catalog }).run(process.argv.slice(2)).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
