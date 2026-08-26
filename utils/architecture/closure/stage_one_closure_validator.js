const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageTwoExecutionStateValidator,
  ActiveBridgePlanResolver,
} = require("../../build/legacy_bridge_build_config");

class StageTwoSemanticClosureTransition {
  constructor({ projectRoot, closure, state, approvedPlan = null, manifest = null, bridgeRegistry = null, knownDebtRegistry = null }) {
    this.projectRoot = projectRoot;
    this.closure = closure;
    this.state = state;
    this.approvedPlan = approvedPlan;
    this.manifest = manifest;
    const stageTwoOwners = new Set(
      (approvedPlan?.batches || []).map((batch) => batch.id),
    );
    this.bridgeRegistry = bridgeRegistry
      ? {
          ...bridgeRegistry,
          bridges: (bridgeRegistry.bridges || []).filter((bridge) =>
            stageTwoOwners.has(bridge.owner),
          ),
        }
      : bridgeRegistry;
    this.knownDebtRegistry = knownDebtRegistry;
    const stageThreeStatePath = path.join(
      projectRoot,
      "architecture/migration/stage_3_execution_state.json",
    );
    this.stageThreeState = fs.existsSync(stageThreeStatePath)
      ? JSON.parse(fs.readFileSync(stageThreeStatePath, "utf8"))
      : null;
    this.releasedPaths = new Set([
      "architecture/build/package_contract.json",
      "index.html",
      "package-lock.json",
      "package.json",
    ]);
    if (state.esmRuntimeIntegrationStarted) {
      this.releasedPaths.add("architecture/migration/module_migration_manifest.json");
      this.releasedPaths.add("architecture/guards/migration_bridge_registry.json");
      this.releasedPaths.add("architecture/guards/known_debt_registry.json");
    }
    if (this.stageThreeState?.compatibilityRuntimeActivated === true) {
      this.releasedPaths.add("architecture/module_architecture.json");
    }
  }

  validateCurrent() {
    const packageJson = this.#readJson("package.json");
    const packageLock = this.#readJson("package-lock.json");
    const packageContract = this.#readJson(
      "architecture/build/package_contract.json",
    );
    const indexHtml = this.#readText("index.html");
    const currentReleaseVersion =
      this.stageThreeState?.releaseVersion || this.state.releaseVersion;
    if (packageJson.version !== currentReleaseVersion) {
      throw new Error("Current package version differs from execution state");
    }
    if (
      packageJson.scripts?.["build:legacy-bridges"] !==
      "node utils/build/build_legacy_bridges.js"
    ) {
      throw new Error("Stage 2 package requires the exact legacy bridge build script");
    }
    if (
      packageLock.version !== currentReleaseVersion ||
      packageLock.packages?.[""]?.version !== currentReleaseVersion
    ) {
      throw new Error("Stage 2 lockfile version differs from execution state");
    }
    const expectedVersionScript =
      `src/config/project_version.js?v=${currentReleaseVersion}`;
    if (!indexHtml.includes(expectedVersionScript)) {
      throw new Error("Stage 2 index version query differs from execution state");
    }
    const runtimeInputs = this.#activeBridges().length;
    if (this.stageThreeState?.compatibilityRuntimeActivated === true) {
      const cumulativeContract = this.#readJson(
        "architecture/migration/stage_3_compatibility_runtime.json",
      );
      const expectedBridgeBuild = {
        status: "transitioned-to-cumulative-runtime",
        registry: "architecture/guards/migration_bridge_registry.json",
        inputs: "stage-2-bridges-exposed-through-stage-3-cumulative-runtime",
        output: "dist/legacy-bridges/",
        runtimeInputs: 0,
      };
      const expectedCumulativeBuild = {
        status: "runtime-integration-active",
        contract: "architecture/migration/stage_3_compatibility_runtime.json",
        executionState: "architecture/migration/stage_3_execution_state.json",
        output: cumulativeContract.output.directory,
        runtimeInputs: new Set(
          cumulativeContract.activationPositions.map(
            (activation) => activation.targetModule,
          ),
        ).size,
        activationInputs: cumulativeContract.activationPositions.length,
      };
      const selectedStageThreeBatchCount =
        this.stageThreeState.completedBatchIds.length +
        (this.stageThreeState.activeBatchId &&
          this.stageThreeState.activeBatchPhase !== "prebuild" ? 1 : 0);
      if (
        packageContract.stage?.current !== `3.${selectedStageThreeBatchCount}` ||
        packageContract.stage?.vite !==
          "fixture-bridge-and-cumulative-runtime-infrastructure" ||
        packageContract.stage?.sourceRuntime !==
          "classic-scripts-with-cumulative-iife-runtime" ||
        JSON.stringify(packageContract.stage?.bridgeBuild) !==
          JSON.stringify(expectedBridgeBuild) ||
        JSON.stringify(packageContract.stage?.cumulativeRuntimeBuild) !==
          JSON.stringify(expectedCumulativeBuild)
      ) {
        throw new Error("Stage 3 package contract semantic delta is invalid");
      }
    } else {
      const expectedBridgeBuild = {
        status: this.state.esmRuntimeIntegrationStarted
          ? "runtime-integration-active"
          : "foundation-verified",
        registry: "architecture/guards/migration_bridge_registry.json",
        inputs: "approved-active-wrappers-only",
        output: "dist/legacy-bridges/",
        runtimeInputs,
      };
      if (
        packageContract.stage?.current !== this.#currentStage() ||
        packageContract.stage?.vite !==
          "fixture-and-approved-bridge-build-infrastructure" ||
        JSON.stringify(packageContract.stage?.bridgeBuild) !==
          JSON.stringify(expectedBridgeBuild)
      ) {
        throw new Error("Stage 2 package contract semantic delta is invalid");
      }
    }
    if (this.state.esmRuntimeIntegrationStarted) this.#validateActivatedBatch(indexHtml);
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
        `  "version": "${this.stageThreeState?.releaseVersion || this.state.releaseVersion}",`,
        `  "version": "${this.closure.version}",`,
        "package version",
      );
      normalized = this.#removeExactLine(
        normalized,
        '    "build:legacy-bridges": "node utils/build/build_legacy_bridges.js",',
        "legacy bridge build script",
      );
      if (this.stageThreeState?.compatibilityRuntimeActivated === true) {
        normalized = this.#removeExactLine(
          normalized,
          '    "build:stage-3-compat-runtime": "node utils/build/build_stage_3_compat_runtime.js",',
          "Stage 3 compatibility build script",
        );
      }
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
        `  "version": "${this.stageThreeState?.releaseVersion || this.state.releaseVersion}",`,
        `  "version": "${this.closure.version}",`,
        "lockfile top-level version",
      );
      normalized = this.#replaceExactLine(
        normalized,
        `      "version": "${this.stageThreeState?.releaseVersion || this.state.releaseVersion}",`,
        `      "version": "${this.closure.version}",`,
        "lockfile root package version",
      );
    } else if (relativePath === "architecture/build/package_contract.json") {
      const value = JSON.parse(text);
      value.stage.current = "1.8.2";
      value.stage.vite = "fixture-infrastructure-only";
      value.stage.sourceRuntime = "classic-scripts-unchanged";
      delete value.stage.bridgeBuild;
      delete value.stage.cumulativeRuntimeBuild;
      normalized = `${JSON.stringify(value, null, 2)}\n`;
    } else if (relativePath === "index.html") {
      const current =
        `src/config/project_version.js?v=${this.stageThreeState?.releaseVersion || this.state.releaseVersion}`;
      const baseline = `src/config/project_version.js?v=${this.closure.version}`;
      const occurrences = text.split(current).length - 1;
      if (occurrences !== 1) {
        throw new Error("Stage 2 index semantic delta must change one version query");
      }
      normalized = text.replace(current, baseline);
      if (this.stageThreeState?.compatibilityRuntimeActivated === true) {
        const evidence = this.closure.immutableEvidence.find(
          (item) => item.path === relativePath,
        );
        if (!evidence) {
          throw new Error(`Historical closure evidence is missing ${relativePath}`);
        }
        return evidence.sha256;
      }
      for (const bridge of this.#activeBridges()) {
        normalized = this.#replaceExact(
          normalized,
          bridge.outputPath,
          bridge.replacesScript,
          `runtime bridge script ${bridge.outputPath}`,
        );
      }
      if (this.state.esmRuntimeIntegrationStarted) {
        const evidence = this.closure.immutableEvidence.find((item) => item.path === relativePath);
        if (!evidence) throw new Error(`Historical closure evidence is missing ${relativePath}`);
        return evidence.sha256;
      }
    } else if (
      relativePath === "architecture/module_architecture.json" &&
      this.stageThreeState?.compatibilityRuntimeActivated === true
    ) {
      JSON.parse(text);
      const evidence = this.closure.immutableEvidence.find((item) => item.path === relativePath);
      if (!evidence) throw new Error(`Historical closure evidence is missing ${relativePath}`);
      return evidence.sha256;
    } else if (
      relativePath === "architecture/migration/module_migration_manifest.json" ||
      relativePath === "architecture/guards/migration_bridge_registry.json" ||
      relativePath === "architecture/guards/known_debt_registry.json"
    ) {
      JSON.parse(text);
      const evidence = this.closure.immutableEvidence.find((item) => item.path === relativePath);
      if (!evidence) throw new Error(`Historical closure evidence is missing ${relativePath}`);
      return evidence.sha256;
    } else {
      throw new Error(`Path is not a semantic closure delta: ${relativePath}`);
    }
    return crypto.createHash("sha256").update(normalized).digest("hex");
  }

  #activeBatches() {
    if (!this.approvedPlan) return [];
    const ids = new Set([
      ...(this.state.completedBatchIds || []),
      ...(this.state.activeBatchId ? [this.state.activeBatchId] : []),
    ]);
    return this.approvedPlan.batches.filter((batch) => ids.has(batch.id));
  }

  #activeBridges() {
    return this.#activeBatches().flatMap((batch) => batch.bridgeStrategy.bridges);
  }

  #currentStage() {
    const orders = this.#activeBatches().map((batch) => batch.order);
    return orders.length > 0 ? `2.${Math.max(...orders)}` : "2.0";
  }

  #validateActivatedBatch(indexHtml) {
    if (!this.approvedPlan || !this.manifest || !this.bridgeRegistry || !this.knownDebtRegistry) {
      throw new Error("Activated Stage 2 closure requires plan, manifest, bridge and debt registries");
    }
    new ActiveBridgePlanResolver().resolve({
      state: this.state,
      approvedPlan: this.approvedPlan,
      bridgeRegistry: this.bridgeRegistry,
      runtimeFacts: { moduleScriptCount: 0 },
    });
    const modules = new Map(this.manifest.modules.map((item) => [item.currentPath, item]));
    const completed = new Set(this.state.completedBatchIds || []);
    const active = new Set(this.#activeBatches().map((batch) => batch.id));
    const cumulativeRuntimeActivated =
      this.stageThreeState?.compatibilityRuntimeActivated === true;
    for (const batch of this.approvedPlan.batches) {
      for (const module of batch.modules) {
        if (active.has(batch.id)) {
          if (modules.has(module.currentPath)) throw new Error(`Migrated source remains in manifest: ${module.currentPath}`);
          const target = modules.get(module.targetPath);
          const allowedStatuses = completed.has(batch.id) ? ["esm", "verified"] : ["migrating", "esm", "verified"];
          if (!target || !allowedStatuses.includes(target.architecture?.migrationStatus)) {
            throw new Error(`Activated target has invalid lifecycle metadata: ${module.targetPath}`);
          }
        } else {
          const current = modules.get(module.currentPath);
          if (!current || current.architecture?.migrationStatus !== "classified") {
            throw new Error(`Future batch source changed before activation: ${module.currentPath}`);
          }
        }
      }
      for (const bridge of batch.bridgeStrategy.bridges) {
        const outputCount = indexHtml.split(bridge.outputPath).length - 1;
        const sourceCount = indexHtml.split(bridge.replacesScript).length - 1;
        if (active.has(batch.id)) {
          const wrapper = modules.get(bridge.wrapperPath);
          if (!wrapper || !["migrating", "esm", "verified"].includes(wrapper.architecture?.migrationStatus)) {
            throw new Error(`Activated bridge wrapper is missing from manifest: ${bridge.wrapperPath}`);
          }
          if (
            cumulativeRuntimeActivated
              ? outputCount !== 0 || sourceCount !== 0
              : outputCount !== 1 || sourceCount !== 0
          ) {
            throw new Error(`Runtime bridge did not replace exactly one classic script: ${bridge.outputPath}`);
          }
        } else if (outputCount !== 0 || sourceCount !== 1) {
          throw new Error(`Future bridge runtime position changed: ${bridge.outputPath}`);
        }
      }
    }
    const migratedSourcePaths = new Set(this.#activeBatches().flatMap(
      (batch) => batch.modules.map((module) => module.currentPath),
    ));
    for (const debt of this.knownDebtRegistry.debts || []) {
      if (migratedSourcePaths.has(debt.target)) {
        throw new Error(`Known debt still targets migrated source: ${debt.target}`);
      }
    }
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
    const stageThreeStatePath = path.join(
      this.projectRoot,
      "architecture/migration/stage_3_execution_state.json",
    );
    const stageThreeState = fs.existsSync(stageThreeStatePath)
      ? JSON.parse(fs.readFileSync(stageThreeStatePath, "utf8"))
      : null;
    const stageThreeApprovedPlan = stageThreeState
      ? this.#readJson("architecture/migration/stage_3_approved_batches.json")
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
        approvedPlan,
        manifest,
        bridgeRegistry,
        knownDebtRegistry: knownDebt,
      });
      transition.validateCurrent();
    }
    this.#validateVersion({
      closure,
      executionState,
      stageThreeState,
      packageJson,
      packageLock,
      projectVersionSource,
      changelog,
      errors,
    });
    this.#validateRuntime({ closure, indexHtml, executionState, approvedPlan, stageThreeState, stageThreeApprovedPlan, errors });
    this.#validateArchitecture({
      closure,
      manifest,
      knownDebt,
      globalBaseline,
      bridgeRegistry,
      executionState,
      approvedPlan,
      stageThreeState,
      stageThreeApprovedPlan,
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
    this.#validateNoTemporaryArtifacts({ executionState, approvedPlan, stageThreeState, errors });

    if (errors.length > 0) {
      throw new Error(`Stage 1 closure failed:\n- ${errors.join("\n- ")}`);
    }

    return Object.freeze({
      version: closure.version,
      mode: transition ? "historical" : "strict",
      currentVersion:
        stageThreeState?.releaseVersion || executionState?.releaseVersion || closure.version,
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
    stageThreeState,
    packageJson,
    packageLock,
    projectVersionSource,
    changelog,
    errors,
  }) {
    const sourceVersion = projectVersionSource.match(
      /CURRENT_PROJECT_VERSION\s*=\s*"([^"]+)"/,
    )?.[1];
    const expectedCurrentVersion =
      stageThreeState?.releaseVersion || executionState?.releaseVersion || closure.version;
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
          `## v${executionState.releaseVersion} - ${this.#stageReleaseTitle(executionState)}`,
        ),
        "changelog must contain the current Stage 2 release version",
        errors,
      );
    }
    if (stageThreeState?.compatibilityRuntimeActivated === true) {
      this.#require(
        changelog.includes(
          `## v${stageThreeState.releaseVersion} - ` +
            this.#stageThreeReleaseTitle(stageThreeState),
        ),
        "changelog must contain the current Stage 3 release version",
        errors,
      );
    }
  }

  #stageReleaseTitle(executionState) {
    const lastBatch = executionState.activeBatchId ||
      executionState.completedBatchIds?.[executionState.completedBatchIds.length - 1];
    const titles = {
      "stage-2.1-engine-asset-contracts": "Engine Asset Contracts",
      "stage-2.2-engine-dependency-contract": "Engine Dependency Contract",
      "stage-2.3-engine-event-primitives": "Engine Event Primitives",
      "stage-2.4-engine-rendering-primitives": "Engine Rendering Primitives",
    };
    return titles[lastBatch] || "Classic Bridge Build Foundation";
  }

  #stageThreeReleaseTitle(executionState) {
    const lastBatch =
      executionState.completedBatchIds?.[executionState.completedBatchIds.length - 1] ||
      executionState.activeBatchId;
    const titles = {
      "stage-3.candidate-001-inventory-85f44b2e":
        "First Domain Cumulative Runtime",
      "stage-3.candidate-002-fishing-944d0790":
        "Reel Auto-Recovery Calculator",
      "stage-3.candidate-003-fishing-9700ad4f":
        "Line Tension Calculator",
      "stage-3.candidate-004-equipment-4f2570dc":
        "Rod Capability Resolver",
      "stage-3.candidate-005-fishing-45d0c7ce":
        "Fishing Foundation Cluster",
      "stage-3.candidate-006-fishing-e48e70d8":
        "Fishing Domain Primitives II",
    };
    return titles[lastBatch] || "Domain ESM Migration";
  }

  #validateRuntime({ closure, indexHtml, executionState, approvedPlan, stageThreeState, stageThreeApprovedPlan, errors }) {
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
    const activeBatchIds = new Set([
      ...(executionState?.completedBatchIds || []),
      ...(executionState?.activeBatchId ? [executionState.activeBatchId] : []),
    ]);
    const activeWrapperCount = (approvedPlan?.batches || [])
      .filter((batch) => activeBatchIds.has(batch.id))
      .reduce((count, batch) => count + batch.bridgeStrategy.bridges.length, 0);
    const completedStageThree = new Set([
      ...(stageThreeState?.completedBatchIds || []),
      ...(stageThreeState?.activeBatchId &&
        stageThreeState.activeBatchPhase !== "prebuild"
        ? [stageThreeState.activeBatchId]
        : []),
    ]);
    const stageThreeTargetCount = (stageThreeApprovedPlan?.batches || [])
      .filter((batch) => completedStageThree.has(batch.id))
      .reduce((count, batch) => count + batch.modules.length, 0);
    const selectedStageThreeBatch = (stageThreeApprovedPlan?.batches || [])
      .filter((batch) => completedStageThree.has(batch.id))
      .at(-1);
    const cumulativeActivationCount =
      selectedStageThreeBatch?.compatibility?.cumulativeActivationIds?.length || 0;
    const additionalActivationScripts = Math.max(
      0,
      cumulativeActivationCount - activeWrapperCount - stageThreeTargetCount,
    );
    this.#require(
      sourceFiles.length ===
        baseline.sourceModuleCount + activeWrapperCount + stageThreeTargetCount,
      "runtime source module count changed",
      errors,
    );
    this.#require(
      scriptCount ===
        baseline.classicScriptCount +
          (stageThreeState?.compatibilityRuntimeActivated === true ? 1 : 0) +
          additionalActivationScripts,
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
    executionState,
    approvedPlan,
    stageThreeState,
    stageThreeApprovedPlan,
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
    const activeBatchIds = new Set([
      ...(executionState?.completedBatchIds || []),
      ...(executionState?.activeBatchId ? [executionState.activeBatchId] : []),
    ]);
    const activeModules = (approvedPlan?.batches || [])
      .filter((batch) => activeBatchIds.has(batch.id))
      .reduce((count, batch) => count + batch.modules.length, 0);
    const activeWrappers = (approvedPlan?.batches || [])
      .filter((batch) => activeBatchIds.has(batch.id))
      .reduce((count, batch) => count + batch.bridgeStrategy.bridges.length, 0);
    const completedStageThree = new Set([
      ...(stageThreeState?.completedBatchIds || []),
      ...(stageThreeState?.activeBatchId &&
        stageThreeState.activeBatchPhase !== "prebuild"
        ? [stageThreeState.activeBatchId]
        : []),
    ]);
    const stageThreeTargets = (stageThreeApprovedPlan?.batches || [])
      .filter((batch) => completedStageThree.has(batch.id))
      .reduce((count, batch) => count + batch.modules.length, 0);
    this.#require(
      classifiedCount === baseline.classifiedModuleCount - activeModules &&
        manifest.modules.length ===
          baseline.classifiedModuleCount + activeWrappers + stageThreeTargets,
      "Stage 1 classified set changed outside activated batches",
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
    const expectedBridgeRecords = (approvedPlan?.batches || [])
      .filter((batch) => activeBatchIds.has(batch.id))
      .reduce(
        (count, batch) => count + batch.bridgeStrategy.bridges.reduce(
          (bridgeCount, bridge) => bridgeCount + bridge.legacyConsumers.length,
          0,
        ),
        0,
      );
    this.#require(
      baseline.activeBridgeCount === 0,
      "Stage 1 bridge baseline must remain zero",
      errors,
    );
    this.#require(
      bridgeRegistry.bridges.filter((bridge) => /^stage-2\./.test(bridge.owner || "")).length === expectedBridgeRecords,
      "migration bridge registry differs from activated Stage 2 batches",
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

  #validateNoTemporaryArtifacts({ executionState, approvedPlan, stageThreeState, errors }) {
    const stale = [];
    const activeBatchIds = new Set([
      ...(executionState?.completedBatchIds || []),
      ...(executionState?.activeBatchId ? [executionState.activeBatchId] : []),
    ]);
    const allowedOutputs = new Set((approvedPlan?.batches || [])
      .filter((batch) => activeBatchIds.has(batch.id))
      .flatMap((batch) => batch.bridgeStrategy.bridges.map((bridge) => bridge.outputPath)));
    const cumulativeOutputPrefix = "dist/stage-3-compat-runtime";
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
        (relative.startsWith("dist/") &&
          relative !== "dist/legacy-bridges" &&
          !(stageThreeState?.compatibilityRuntimeActivated === true &&
            (relative === cumulativeOutputPrefix ||
              relative.startsWith(`${cumulativeOutputPrefix}/`))) &&
          !allowedOutputs.has(relative)) ||
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
