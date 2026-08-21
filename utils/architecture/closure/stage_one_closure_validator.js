const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageTwoExecutionStateValidator,
} = require("../../build/legacy_bridge_build_config");

class StageTwoSemanticClosureTransition {
  constructor({ projectRoot, closure, state }) {
    this.projectRoot = projectRoot;
    this.closure = closure;
    this.state = state;
    this.releasedPaths = new Set([
      "architecture/build/package_contract.json",
      "index.html",
      "package-lock.json",
      "package.json",
    ]);
  }

  validateCurrent() {
    const packageJson = this.#readJson("package.json");
    const packageLock = this.#readJson("package-lock.json");
    const packageContract = this.#readJson(
      "architecture/build/package_contract.json",
    );
    const indexHtml = this.#readText("index.html");
    if (packageJson.version !== this.state.releaseVersion) {
      throw new Error("Stage 2 package version differs from execution state");
    }
    if (
      packageJson.scripts?.["build:legacy-bridges"] !==
      "node utils/build/build_legacy_bridges.js"
    ) {
      throw new Error("Stage 2 package requires the exact legacy bridge build script");
    }
    if (
      packageLock.version !== this.state.releaseVersion ||
      packageLock.packages?.[""]?.version !== this.state.releaseVersion
    ) {
      throw new Error("Stage 2 lockfile version differs from execution state");
    }
    const expectedVersionScript =
      `src/config/project_version.js?v=${this.state.releaseVersion}`;
    if (!indexHtml.includes(expectedVersionScript)) {
      throw new Error("Stage 2 index version query differs from execution state");
    }
    const expectedBridgeBuild = {
      status: "foundation-verified",
      registry: "architecture/guards/migration_bridge_registry.json",
      inputs: "approved-active-wrappers-only",
      output: "dist/legacy-bridges/",
      runtimeInputs: 0,
    };
    if (
      packageContract.stage?.current !== "2.0" ||
      packageContract.stage?.vite !==
        "fixture-and-approved-bridge-build-infrastructure" ||
      JSON.stringify(packageContract.stage?.bridgeBuild) !==
        JSON.stringify(expectedBridgeBuild)
    ) {
      throw new Error("Stage 2 package contract semantic delta is invalid");
    }
  }

  isReleasedPath(relativePath) {
    return this.releasedPaths.has(relativePath);
  }

  normalizedSha256(relativePath, sourceText = null) {
    const text = sourceText ?? this.#readText(relativePath);
    let normalized;
    if (relativePath === "package.json") {
      JSON.parse(text);
      normalized = this.#replaceExact(
        text,
        `  "version": "${this.state.releaseVersion}",`,
        `  "version": "${this.closure.version}",`,
        "package version",
      );
      normalized = this.#removeExactLine(
        normalized,
        '    "build:legacy-bridges": "node utils/build/build_legacy_bridges.js",',
        "legacy bridge build script",
      );
      // The Stage 1 closure was captured from the Windows working tree. The
      // insertion split the pre-existing CRLF after `dev`; reverse that exact
      // approved formatting delta before hashing the historical evidence.
      normalized = normalized.replace(
        '    "dev": "node utils/dev-server.js",\n',
        '    "dev": "node utils/dev-server.js",\r\n',
      );
    } else if (relativePath === "package-lock.json") {
      JSON.parse(text);
      normalized = this.#replaceExactLine(
        text,
        `  "version": "${this.state.releaseVersion}",`,
        `  "version": "${this.closure.version}",`,
        "lockfile top-level version",
      );
      normalized = this.#replaceExactLine(
        normalized,
        `      "version": "${this.state.releaseVersion}",`,
        `      "version": "${this.closure.version}",`,
        "lockfile root package version",
      );
    } else if (relativePath === "architecture/build/package_contract.json") {
      const value = JSON.parse(text);
      value.stage.current = "1.8.2";
      value.stage.vite = "fixture-infrastructure-only";
      delete value.stage.bridgeBuild;
      normalized = `${JSON.stringify(value, null, 2)}\n`;
    } else if (relativePath === "index.html") {
      const current =
        `src/config/project_version.js?v=${this.state.releaseVersion}`;
      const baseline = `src/config/project_version.js?v=${this.closure.version}`;
      const occurrences = text.split(current).length - 1;
      if (occurrences !== 1) {
        throw new Error("Stage 2 index semantic delta must change one version query");
      }
      normalized = text.replace(current, baseline);
    } else {
      throw new Error(`Path is not a semantic closure delta: ${relativePath}`);
    }
    return crypto.createHash("sha256").update(normalized).digest("hex");
  }

  #replaceExact(text, current, baseline, subject) {
    const occurrences = text.split(current).length - 1;
    if (occurrences !== 1) {
      throw new Error(`Stage 2 semantic delta requires one ${subject}`);
    }
    return text.replace(current, baseline);
  }

  #removeExactLine(text, line, subject) {
    const linePattern = `${line}\n`;
    const occurrences = text.split(linePattern).length - 1;
    if (occurrences !== 1) {
      throw new Error(`Stage 2 semantic delta requires one ${subject}`);
    }
    return text.replace(linePattern, "");
  }

  #replaceExactLine(text, current, baseline, subject) {
    const escaped = current.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`^${escaped}(?=\\r?$)`, "gm");
    const matches = text.match(pattern) || [];
    if (matches.length !== 1) {
      throw new Error(`Stage 2 semantic delta requires one ${subject}`);
    }
    return text.replace(pattern, baseline);
  }

  #readJson(relativePath) {
    return JSON.parse(this.#readText(relativePath));
  }

  #readText(relativePath) {
    return fs.readFileSync(path.join(this.projectRoot, relativePath), "utf8");
  }
}

class StageOneClosureValidator {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }

  validate(closure) {
    const errors = [];
    this.#require(closure?.schemaVersion === 1, "schemaVersion must be 1", errors);
    this.#require(
      closure?.kind === "cyber-fishing-stage-1-closure",
      "kind must identify the Stage 1 closure",
      errors,
    );
    this.#require(closure?.status === "closed", "status must be closed", errors);
    this.#require(
      closure?.strictUntil === "first-stage-2-batch-activation",
      "strictUntil must identify the first Stage 2 activation boundary",
      errors,
    );

    const packageJson = this.#readJson("package.json");
    const packageLock = this.#readJson("package-lock.json");
    const manifest = this.#readJson(
      "architecture/migration/module_migration_manifest.json",
    );
    const knownDebt = this.#readJson(
      "architecture/guards/known_debt_registry.json",
    );
    const globalBaseline = this.#readJson(
      "architecture/guards/global_provider_baseline.json",
    );
    const bridgeRegistry = this.#readJson(
      "architecture/guards/migration_bridge_registry.json",
    );
    const approvedPlan = this.#readJson(
      "architecture/migration/stage_2_approved_batches.json",
    );
    const executionStatePath = path.join(
      this.projectRoot,
      "architecture/migration/stage_2_execution_state.json",
    );
    const executionState = fs.existsSync(executionStatePath)
      ? JSON.parse(fs.readFileSync(executionStatePath, "utf8"))
      : null;
    const fixturePackage = this.#readJson(
      "utils/architecture/esm-fixtures/package.json",
    );
    const indexHtml = this.#readText("index.html");
    const projectVersionSource = this.#readText(
      "src/config/project_version.js",
    );
    const changelog = this.#readText("CHANGELOG.md");

    const runtimeFacts = this.#runtimeFacts(indexHtml);
    let transition = null;
    if (executionState) {
      new StageTwoExecutionStateValidator().validate({
        state: executionState,
        approvedPlan,
        bridgeRegistry,
        runtimeFacts,
      });
      transition = new StageTwoSemanticClosureTransition({
        projectRoot: this.projectRoot,
        closure,
        state: executionState,
      });
      transition.validateCurrent();
    }
    this.#validateVersion({
      closure,
      executionState,
      packageJson,
      packageLock,
      projectVersionSource,
      changelog,
      errors,
    });
    this.#validateRuntime({ closure, indexHtml, errors });
    this.#validateArchitecture({
      closure,
      manifest,
      knownDebt,
      globalBaseline,
      bridgeRegistry,
      errors,
    });
    this.#validateBuild({
      closure,
      packageJson,
      fixturePackage,
      errors,
    });
    this.#validateApprovedMigration({ closure, approvedPlan, errors });
    this.#validateEvidence(closure?.immutableEvidence, transition, errors);
    this.#validateRequiredChecks(closure, errors);
    this.#validateNoTemporaryArtifacts(errors);

    if (errors.length > 0) {
      throw new Error(`Stage 1 closure failed:\n- ${errors.join("\n- ")}`);
    }

    return Object.freeze({
      version: closure.version,
      mode: transition ? "historical" : "strict",
      currentVersion: executionState?.releaseVersion || closure.version,
      moduleCount: manifest.modules.length,
      edgeCount: this.#confirmedEdgeCount(manifest.modules),
      knownDebtCount: knownDebt.debts.length,
      approvedBatchCount: approvedPlan.batches.length,
      approvedModuleCount: approvedPlan.batches.reduce(
        (count, batch) => count + batch.modules.length,
        0,
      ),
    });
  }

  #validateVersion({
    closure,
    executionState,
    packageJson,
    packageLock,
    projectVersionSource,
    changelog,
    errors,
  }) {
    const sourceVersion = projectVersionSource.match(
      /CURRENT_PROJECT_VERSION\s*=\s*"([^"]+)"/,
    )?.[1];
    const expectedCurrentVersion = executionState?.releaseVersion || closure.version;
    this.#require(
      expectedCurrentVersion === packageJson.version &&
        expectedCurrentVersion === packageLock.version &&
        expectedCurrentVersion === packageLock.packages?.[""]?.version &&
        expectedCurrentVersion === sourceVersion,
      "package, lockfile, execution state and project source versions must match",
      errors,
    );
    this.#require(
      changelog.includes(`## v${closure?.version} - Modular Architecture Foundation`),
      "changelog must contain the Stage 1 closure version",
      errors,
    );
    if (executionState) {
      this.#require(
        changelog.includes(
          `## v${executionState.releaseVersion} - Classic Bridge Build Foundation`,
        ),
        "changelog must contain the Stage 2 foundation version",
        errors,
      );
    }
  }

  #validateRuntime({ closure, indexHtml, errors }) {
    const baseline = closure?.runtimeBaseline || {};
    const sourceFiles = this.#collectJavaScriptFiles(
      path.join(this.projectRoot, "src"),
    );
    const scriptCount = (indexHtml.match(/<script\b[^>]*\bsrc\s*=/gi) || [])
      .length;
    const moduleScriptCount = (
      indexHtml.match(/<script\b[^>]*\btype\s*=\s*["']module["']/gi) || []
    ).length;
    this.#require(
      baseline.entrypoint === "index.html",
      "Stage 1 runtime entrypoint must remain index.html",
      errors,
    );
    this.#require(
      sourceFiles.length === baseline.sourceModuleCount,
      "runtime source module count changed",
      errors,
    );
    this.#require(
      scriptCount === baseline.classicScriptCount,
      "classic script count changed",
      errors,
    );
    this.#require(
      moduleScriptCount === baseline.moduleScriptCount,
      "production module script count changed",
      errors,
    );
    this.#require(
      baseline.productionViteEntrypoint === null,
      "Stage 1 must not define a production Vite entrypoint",
      errors,
    );
    this.#require(
      baseline.gameplayChanges === 0 && baseline.saveFormatChanges === 0,
      "Stage 1 closure must declare zero gameplay and save-format changes",
      errors,
    );
  }

  #validateArchitecture({
    closure,
    manifest,
    knownDebt,
    globalBaseline,
    bridgeRegistry,
    errors,
  }) {
    const baseline = closure?.architectureBaseline || {};
    const classifiedCount = manifest.modules.filter(
      (module) => module.architecture?.migrationStatus === "classified",
    ).length;
    const debtByRule = {};
    for (const debt of knownDebt.debts) {
      debtByRule[debt.rule] = (debtByRule[debt.rule] || 0) + 1;
    }
    this.#require(
      manifest.schemaVersion === baseline.manifestSchemaVersion,
      "manifest schema version changed",
      errors,
    );
    this.#require(
      classifiedCount === baseline.classifiedModuleCount &&
        classifiedCount === manifest.modules.length,
      "not every Stage 1 module is classified",
      errors,
    );
    this.#require(
      this.#confirmedEdgeCount(manifest.modules) ===
        baseline.confirmedInterFileEdges,
      "confirmed dependency edge count changed",
      errors,
    );
    this.#require(
      globalBaseline.providers.length === baseline.globalIdentityCount,
      "global identity baseline changed",
      errors,
    );
    this.#require(
      knownDebt.debts.length === baseline.knownDebtCount,
      "known architecture debt count changed",
      errors,
    );
    this.#require(
      JSON.stringify(debtByRule) === JSON.stringify(baseline.knownDebtByRule),
      "known architecture debt rule distribution changed",
      errors,
    );
    this.#require(
      bridgeRegistry.bridges.length === baseline.activeBridgeCount &&
        bridgeRegistry.bridges.length === 0,
      "migration bridges were activated before Stage 2",
      errors,
    );
    this.#require(
      baseline.guardFailureCount === 0,
      "Stage 1 cannot close with guard failures",
      errors,
    );
  }

  #validateBuild({ closure, packageJson, fixturePackage, errors }) {
    const baseline = closure?.buildBaseline || {};
    this.#require(
      packageJson.packageManager === baseline.packageManager,
      "package manager changed",
      errors,
    );
    this.#require(
      packageJson.devDependencies?.vite === baseline.viteVersion,
      "exact Vite version changed",
      errors,
    );
    this.#require(
      packageJson.type === undefined && baseline.toolingModuleSystem === "commonjs",
      "root tooling must remain CommonJS",
      errors,
    );
    this.#require(
      fixturePackage.type === "module" &&
        baseline.fixtureModuleSystem === "isolated-esm",
      "ESM fixture boundary changed",
      errors,
    );
    this.#require(
      baseline.legacyGameBuildInput === false,
      "Stage 1 Vite infrastructure must not include the game graph",
      errors,
    );
  }

  #validateApprovedMigration({ closure, approvedPlan, errors }) {
    const approved = closure?.approvedMigration || {};
    const moduleCount = approvedPlan.batches.reduce(
      (count, batch) => count + batch.modules.length,
      0,
    );
    const bridgeCount = approvedPlan.batches.reduce(
      (count, batch) => count + batch.bridgeStrategy.bridges.length,
      0,
    );
    this.#require(
      approvedPlan.status === "approved-frozen" &&
        approvedPlan.approvedAtVersion === closure.version,
      "approved plan is not frozen at the closure version",
      errors,
    );
    this.#require(
      approved.prerequisiteCount === 1 &&
        approvedPlan.prerequisite.id === approved.firstStep,
      "approved Stage 2 prerequisite changed",
      errors,
    );
    this.#require(
      approvedPlan.batches.length === approved.batchCount &&
        moduleCount === approved.moduleCount &&
        bridgeCount === approved.plannedBridgeCount,
      "approved Stage 2 batch anchors changed",
      errors,
    );
  }

  #validateEvidence(evidence, transition, errors) {
    this.#require(
      Array.isArray(evidence) && evidence.length > 0,
      "immutableEvidence must not be empty",
      errors,
    );
    const paths = new Set();
    for (const item of evidence || []) {
      this.#require(
        typeof item?.path === "string" && !item.path.includes("*") &&
          /^[a-f0-9]{64}$/.test(item?.sha256 || ""),
        "immutable evidence requires exact path and SHA-256",
        errors,
      );
      this.#require(!paths.has(item?.path), `duplicate evidence path ${item?.path}`, errors);
      paths.add(item?.path);
      const absolutePath = path.join(this.projectRoot, item?.path || "");
      const actualHash = transition?.isReleasedPath(item.path)
        ? transition.normalizedSha256(item.path)
        : fs.existsSync(absolutePath)
          ? this.#sha256(absolutePath)
          : null;
      this.#require(
        fs.existsSync(absolutePath) && actualHash === item?.sha256,
        `immutable evidence changed: ${item?.path}`,
        errors,
      );
    }
  }

  #validateRequiredChecks(closure, errors) {
    const requiredChecks = closure?.requiredChecks || [];
    const requiredSuites = closure?.requiredSuites || [];
    for (const id of [
      "architecture-guard-corpus",
      "root-package-contract",
      "approved-stage-2-batch-freeze",
      "stage-1-closure",
    ]) {
      this.#require(requiredChecks.includes(id), `missing required check ${id}`, errors);
    }
    for (const suite of [
      "architecture",
      "quick",
      "all",
      "browser-smoke",
      "fresh-npm-ci",
    ]) {
      this.#require(requiredSuites.includes(suite), `missing required suite ${suite}`, errors);
    }
  }

  #validateNoTemporaryArtifacts(errors) {
    const stale = [];
    this.#walk(this.projectRoot, (filePath, entry) => {
      const relative = path.relative(this.projectRoot, filePath).replaceAll("\\", "/");
      if (
        relative === ".git" ||
        relative.startsWith(".git/") ||
        relative === "node_modules" ||
        relative.startsWith("node_modules/")
      ) {
        return "skip";
      }
      if (
        relative === "dist" ||
        relative.startsWith("dist/") ||
        relative === "utils/tmp" ||
        relative.startsWith("utils/tmp/") ||
        (!entry.isDirectory() && /(?:\.tmp|\.bak|\.orig|\.rej|~)$/i.test(entry.name))
      ) {
        stale.push(relative);
      }
      return null;
    });
    this.#require(
      stale.length === 0,
      `temporary or stale artifacts remain: ${stale.sort().join(", ")}`,
      errors,
    );
  }

  #confirmedEdgeCount(modules) {
    return modules.reduce(
      (count, module) =>
        count +
        (module.analysis?.dependencies?.items || []).filter(
          (item) =>
            item.resolution === "confirmed" && item.target !== module.currentPath,
        ).length,
      0,
    );
  }

  #collectJavaScriptFiles(rootDirectory) {
    const files = [];
    this.#walk(rootDirectory, (filePath, entry) => {
      if (!entry.isDirectory() && entry.name.endsWith(".js")) files.push(filePath);
      return null;
    });
    return files.sort();
  }

  #runtimeFacts(indexHtml) {
    return Object.freeze({
      moduleScriptCount: (
        indexHtml.match(/<script\b[^>]*\btype\s*=\s*["']module["']/gi) || []
      ).length,
    });
  }

  #walk(directory, visitor) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      const outcome = visitor(filePath, entry);
      if (entry.isDirectory() && outcome !== "skip") this.#walk(filePath, visitor);
    }
  }

  #sha256(filePath) {
    return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
  }

  #readJson(relativePath) {
    return JSON.parse(this.#readText(relativePath));
  }

  #readText(relativePath) {
    return fs.readFileSync(path.join(this.projectRoot, relativePath), "utf8");
  }

  #require(condition, message, errors) {
    if (!condition) errors.push(message);
  }
}

module.exports = {
  StageOneClosureValidator,
  StageTwoSemanticClosureTransition,
};
