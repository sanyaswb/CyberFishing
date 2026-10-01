const crypto = require("node:crypto");
const { StageThreeApprovedPlanSource } = require("../domain_batches/stage_three_approved_plan_source");
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
        // A retired activation's ESM module stays in the cumulative graph for its importers.
        runtimeInputs: new Set([
          ...cumulativeContract.activationPositions,
          ...(cumulativeContract.retiredActivations || []).map((record) => record.activation),
        ].map((activation) => activation.targetModule)).size,
        activationInputs: cumulativeContract.activationPositions.length,
      };
      if (
        packageContract.stage?.current !== new StageThreeApprovedPlanSource({
          read: (file) => fs.readFileSync(path.join(this.projectRoot, file)),
        }).currentStage(this.stageThreeState) ||
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
    const debtForStageOneBaseline = fs.existsSync(path.join(this.projectRoot,
      "architecture/migration/stage_3_batch_013_known_debt_resolution.json"))
      ? JSON.parse(new (require("../domain_batches/stage_three_batch_013_history").Batch013History)(this.projectRoot)
        .before("architecture/guards/known_debt_registry.json"))
      : knownDebt;
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
      ? new StageThreeApprovedPlanSource({
        read: (file) => fs.readFileSync(path.join(this.projectRoot, file)),
      }).load(stageThreeState).document
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
      knownDebt: debtForStageOneBaseline,
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
    // Audit-only Stage 3 releases complete no batch; their exact title is keyed by release version.
    const auditOnlyTitles = {
      "0.24.59": "Post-Freeze Domain Graph Review",
    };
    if (Object.hasOwn(auditOnlyTitles, executionState.releaseVersion)) {
      return auditOnlyTitles[executionState.releaseVersion];
    }
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
      "stage-3.candidate-007-fishing-bb8b3939":
        "Fishing Domain State and Motion",
      "stage-3.candidate-008-fishing-f859ccd3":
        "Line Spool, Stroke Distance and Reel Hold",
      "stage-3.candidate-009-fish-444e8034":
        "Fish Rarity and Anomaly Domain",
      "stage-3.candidate-010-inventory-e3dffbe7":
        "Inventory Assembly Capacity Domain",
      "stage-3.candidate-011-items-11818ee5":
        "Items Progression and Rarity Domain",
      "stage-3.candidate-012-assemblies-2086347a":
        "Assemblies Domain",
      "stage-3.candidate-013-fishing-0267b3ea":
        "Fishing Domain",
      "stage-3.candidate-014-fishing-fefd469b":
        "Fishing Stamina and Tackle Domain",
      "stage-3.candidate-015-fishing-37dc3452":
        "Fishing Endurance and Pressure Domain",
      "stage-3.candidate-016-fishing-f8c953aa":
        "Fishing Pressure Fatigue Source Domain",
      "stage-3.candidate-017-inventory-fd62478b":
        "Inventory Item Location Domain",
      "stage-3.candidate-018-items-8ea4be10":
        "Items Bait Freshness and Metrics Domain",
      "stage-3.candidate-019-items-b0af5033":
        "Items Bait Grade Decay and Quality Domain",
      "stage-3.candidate-020-assemblies-43d77861":
        "Assemblies Refill Signature and State Domain",
      "stage-3.candidate-021-equipment-4044fcef":
        "Equipment Auto Refill Policy Domain",
      "stage-3.replan-322.batch-022-assemblies-9cb3eecf":
        "Assemblies Item Reader Domain",
      "stage-3.replan-322.batch-023-items-c91fce82":
        "Items Metric Strategies Domain",
      "stage-3.replan-322.batch-024-inventory-21307d68":
        "Inventory Reservation Policy Domain",
      "stage-3.replan-322.batch-025-fishing-9bcfae5e":
        "Fishing Sector Pressure and Retrieve Domain",
      "stage-3.replan-322.batch-026-inventory-ad73f2fb":
        "Inventory Assembly Stacking Policy Domain",
      "stage-3.replan-322.batch-027-items-e8f84667":
        "Items Metric Registry, Quality Modifiers and Authored Rarity Domain",
      "stage-3.replan-322.batch-028-assemblies-f4be469e":
        "Assemblies Item Assembly Service Domain",
      "stage-3.replan-322.batch-029-fishing-f2a8faba":
        "Fishing Sector Angle and Stamina Phase Domain",
      "stage-3.replan-322.batch-030-items-a3bf25f7":
        "Items Hook Power and Rarity Resolver Domain",
      "stage-3.replan-322.batch-031-fishing-d2f28c0f":
        "Fishing Stamina Balance Frame Domain",
      "stage-3.replan-322.batch-032-items-096b3398":
        "Items Effective Rarity Resolver Domain",
      "stage-3.replan-322.batch-033-assemblies-3cd39292":
        "Assemblies Assembly State Repository Domain",
      "stage-3.replan-322.batch-034-fishing-b761d4f1":
        "Fishing Hot-Loop Cluster Domain",
      "stage-3.replan-336.batch-035-items-48cb5bbc":
        "Items Condition Resolver Domain",
      "stage-3.replan-336.batch-036-items-e1a5aaa4":
        "Items Effective Stats Domain",
      "stage-3.replan-336.batch-037-items-5fccd461":
        "Items Bait, Freshness and Progression Resolvers Domain",
      "stage-3.replan-336.batch-038-assemblies-d8271d28":
        "Assemblies Profile Registry Domain",
      "stage-3.replan-340.batch-039-fishing-inventory-f92b17ea":
        "Inventory Capacity And Stamina Domain",
      "stage-3.replan-341.batch-040-casting-items-line-rules-1fef9b89":
        "Casting Items Line And Rules Domain",
      "stage-3.replan-342.batch-041-fishing-71e662d7":
        "Landing Policy Domain",
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
    const prebuildBatch = stageThreeState?.activeBatchPhase === "prebuild"
      ? (stageThreeApprovedPlan?.batches || []).find(
        (batch) => batch.id === stageThreeState.activeBatchId,
      )
      : null;
    const prebuildTargetCount = (prebuildBatch?.modules || []).filter((module) =>
      fs.existsSync(path.join(this.projectRoot, module.targetPath))).length;
    this.#require(
      prebuildTargetCount === 0 || prebuildTargetCount === (prebuildBatch?.modules?.length || 0),
      "Stage 3 prebuild target source set must be atomic",
      errors,
    );
    const selectedStageThreeBatch = (stageThreeApprovedPlan?.batches || [])
      .filter((batch) => completedStageThree.has(batch.id))
      .at(-1);
    // A retired classic source keeps one script slot as an inert placeholder for all of the
    // activations it served (each active activation has its own shim script).
    const retiredIds = new Set(selectedStageThreeBatch?.compatibility?.cumulativeRetiredActivationIds || []);
    const retiredRecords = retiredIds.size === 0 ? [] : (this.#readJson(
      "architecture/migration/stage_3_compatibility_runtime.json",
    ).retiredActivations || []).filter((record) => retiredIds.has(record.activation.id));
    this.#require(retiredRecords.length === retiredIds.size, "retired activation ledger differs from the plan", errors);
    const stageThreeBatchOwners = new Set((stageThreeApprovedPlan?.batches || []).map(batch => batch.id));
    // Prerequisite-owned Engine activations and their sources are accounted by prerequisite sources
    // and reviewed split slots. Only batch-owned retired providers replace a migrated classic slot.
    const retiredBatchProviders = new Set(retiredRecords
      .filter(record => stageThreeBatchOwners.has(record.activation.owner))
      .map(record => record.activation.sourceProvider));
    const cumulativeActivationCount =
      (selectedStageThreeBatch?.compatibility?.cumulativeActivationIds?.length || 0) +
      retiredBatchProviders.size;
    const additionalActivationScripts = Math.max(
      0,
      cumulativeActivationCount - activeWrapperCount - stageThreeTargetCount,
    );
    this.#require(
      sourceFiles.length ===
        baseline.sourceModuleCount + activeWrapperCount + stageThreeTargetCount +
          prebuildTargetCount + this.#prerequisiteCreatedSources().length,
      "runtime source module count changed",
      errors,
    );
    this.#require(
      scriptCount ===
        baseline.classicScriptCount +
          (stageThreeState?.compatibilityRuntimeActivated === true ? 1 : 0) +
          additionalActivationScripts + this.#splitSlotAdditionalScripts(),
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
    const prebuildBatch = stageThreeState?.activeBatchPhase === "prebuild"
      ? (stageThreeApprovedPlan?.batches || []).find(
        (batch) => batch.id === stageThreeState.activeBatchId,
      )
      : null;
    const manifestByPath = new Map(
      manifest.modules.map((module) => [module.currentPath, module]),
    );
    const prebuildTargets = (prebuildBatch?.modules || []).filter((module) =>
      fs.existsSync(path.join(this.projectRoot, module.targetPath)));
    this.#require(
      prebuildTargets.length === 0 ||
        prebuildTargets.length === (prebuildBatch?.modules?.length || 0),
      "Stage 3 prebuild target Manifest set must be atomic",
      errors,
    );
    this.#require(
      prebuildTargets.every((module) =>
        manifestByPath.get(module.targetPath)?.architecture?.migrationStatus === "migrating"),
      "Stage 3 prebuild target Manifest entries must remain migrating",
      errors,
    );
    // Classic sources created by recorded prerequisite transitions are classified Manifest entries; an
    // ESM module a prerequisite creates is an Engine module the runtime contract approves as
    // infrastructure (the Engine Vector2, 027): an ESM entry that is not part of the classified set.
    const created = this.#prerequisiteCreatedSources();
    const runtimeContract = JSON.parse(fs.readFileSync(
      path.join(this.projectRoot, "architecture/migration/stage_3_compatibility_runtime.json"), "utf8"));
    const createdInfrastructure = created.filter((file) =>
      (runtimeContract.approvedInfrastructureModules || []).includes(file) &&
      manifestByPath.get(file)?.architecture?.migrationStatus === "esm");
    const createdSources = created.filter((file) => !createdInfrastructure.includes(file));
    this.#require(
      createdSources.every((file) => manifestByPath.get(file)?.architecture?.migrationStatus === "classified") &&
        classifiedCount === baseline.classifiedModuleCount - activeModules + createdSources.length &&
        manifest.modules.length ===
          baseline.classifiedModuleCount + activeWrappers + stageThreeTargets +
            prebuildTargets.length + createdSources.length + createdInfrastructure.length,
      "Stage 1 classified set changed outside activated batches",
      errors,
    );
    const stageThreeConfirmedEdgeDelta = this.#stageThreeConfirmedEdgeDelta(
      manifest.modules,
      baseline.confirmedInterFileEdges,
    );
    this.#require(
      this.#confirmedEdgeCount(manifest.modules) ===
        baseline.confirmedInterFileEdges + stageThreeConfirmedEdgeDelta + this.#prerequisiteConfirmedEdgeDelta(),
      "confirmed dependency edge count changed",
      errors,
    );
    this.#require(
      globalBaseline.providers.length === baseline.globalIdentityCount +
        this.#prerequisiteGlobalProviderNetChange(globalBaseline),
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
      // Evidence rewritten by recorded prerequisite transitions is compared after reversing exactly
      // their recorded writes.
      const actualHash = transition?.isReleasedPath(item.path)
        ? transition.normalizedSha256(item.path)
        : fs.existsSync(absolutePath)
          ? crypto.createHash("sha256").update(this.#prerequisiteLedger()
            .beforeAll(item.path, fs.readFileSync(absolutePath))).digest("hex")
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

  #reviewedImportEdgesRetiredByCutover(artifact) {
    const write = artifact.writes.find((item) => item.path === "architecture/migration/module_migration_manifest.json");
    const edgesOf = (bytes) => JSON.parse(Buffer.from(bytes, "base64")).modules.flatMap((module) =>
      module.analysis.dependencies.items.map((edge) =>
        JSON.stringify([module.currentPath, edge.target, [...edge.symbols].sort()])));
    const before = edgesOf(write.beforeBase64);
    const after = new Set(edgesOf(write.afterBase64));
    const removed = before.filter((edge) => !after.has(edge)).sort();
    const added = [...after].filter((edge) => !before.includes(edge));
    const state = JSON.parse(fs.readFileSync(path.join(this.projectRoot, "architecture/migration/stage_3_execution_state.json")));
    const document = new StageThreeApprovedPlanSource({
      read: (file) => fs.readFileSync(path.join(this.projectRoot, file)),
    }).load(state).document;
    const batch = document.batches.find((record) => record.id === artifact.batchId);
    const byEdge = new Map();
    for (const item of batch ? StageThreeApprovedPlanSource.resolvedImportRecords(document, batch) : []) {
      const key = `${item.consumer}\0${item.viaShim}`;
      byEdge.set(key, [...(byEdge.get(key) || []), item.legacySymbol]);
    }
    const reviewed = [...byEdge].map(([key, symbols]) => {
      const [consumer, shim] = key.split("\0");
      return JSON.stringify([consumer, shim, symbols.sort()]);
    }).sort();
    if (added.length !== 0 || JSON.stringify(removed) !== JSON.stringify(reviewed)) {
      throw new Error(`Stage 3 cutover changed classic edges beyond reviewed imports: ${artifact.batchId}`);
    }
    return removed.length;
  }

  #prerequisiteLedger() {
    const { StageThreePrerequisiteLedger } = require("../stage_three_prerequisites/core/prerequisite_ledger");
    return new StageThreePrerequisiteLedger(this.projectRoot);
  }

  // Classic sources (src/**/*.js) created by recorded prerequisite transitions and still present.
  #prerequisiteCreatedSources() {
    return this.#prerequisiteLedger().records()
      .flatMap((record) => record.writes.filter((write) => write.beforeSha256 === null && /^src\/.+\.js$/u.test(write.path)))
      .map((write) => write.path)
      .filter((file) => fs.existsSync(path.join(this.projectRoot, file)));
  }

  // Net change of the exact global baseline by recorded prerequisite transitions, applied in recording
  // order (additions, removals and replacement pairs): a provider added by one transition may be removed
  // by a later one. Every provider added and not later removed must be in the baseline; every provider
  // removed and not later re-added must be absent from it.
  #prerequisiteGlobalProviderNetChange(globalBaseline) {
    const identity = (provider) => `${provider.currentPath}\u0000${provider.symbol}\u0000${provider.mechanism}`;
    const approved = new Set(globalBaseline.providers.map(identity));
    const added = new Set();
    const removed = new Set();
    for (const record of this.#prerequisiteLedger().records()) {
      const pairs = record.globalProviderReplacements || [];
      for (const provider of [...(record.globalProviderRemovals || []), ...pairs.map((pair) => pair.remove)]) {
        const key = identity(provider);
        if (added.has(key)) added.delete(key);
        else removed.add(key);
      }
      for (const provider of [...(record.globalProviderAdditions || []), ...pairs.map((pair) => pair.add)]) {
        const key = identity(provider);
        if (removed.has(key)) removed.delete(key);
        else added.add(key);
      }
    }
    const missing = [...added].find((key) => !approved.has(key));
    if (missing) throw new Error(`Recorded global provider addition is missing from the baseline: ${missing}`);
    const present = [...removed].find((key) => approved.has(key));
    if (present) throw new Error(`Recorded global provider removal is still in the baseline: ${present}`);
    return added.size - removed.size;
  }

  // Physical classic scripts added by reviewed split legacy slots (every member beyond the first).
  #splitSlotAdditionalScripts() {
    const { LegacySlotSplitRegistry } = require("../migration/legacy_slot_split_registry");
    return LegacySlotSplitRegistry.load(this.projectRoot).splits
      .reduce((total, split) => total + split.members.length - 1, 0);
  }

  // Recorded prerequisite transitions change classic edges only as their records state: every
  // removed edge is in the transition's manifest before-image and no added edge was there before.
  #prerequisiteConfirmedEdgeDelta() {
    const { StageThreePrerequisiteLedger } = require("../stage_three_prerequisites/core/prerequisite_ledger");
    return new StageThreePrerequisiteLedger(this.projectRoot).records().reduce((total, record) => {
      const write = record.writes.find((item) => item.path === "architecture/migration/module_migration_manifest.json");
      const observation = record.dependencyObservation;
      if (observation.confirmedEdgeDelta !== observation.addedEdges.length - observation.removedEdges.length) {
        throw new Error(`Prerequisite edge evidence is invalid: ${record.slug}`);
      }
      // A transition that changes no observed fact writes no Manifest and records no edge change.
      if (!write) {
        if (observation.addedEdges.length > 0 || observation.removedEdges.length > 0) {
          throw new Error(`Prerequisite edge evidence is invalid: ${record.slug}`);
        }
        return total;
      }
      const before = new Set(JSON.parse(Buffer.from(write.beforeBase64, "base64")).modules.flatMap((module) =>
        module.analysis.dependencies.items.filter((edge) => edge.resolution === "confirmed")
          .map((edge) => `${module.currentPath}\u0000${edge.target}\u0000${[...edge.symbols].sort().join(",")}`)));
      if (!observation.removedEdges.every((edge) => before.has(edge)) ||
        observation.addedEdges.some((edge) => before.has(edge))) {
        throw new Error(`Prerequisite edge evidence differs from its manifest before-image: ${record.slug}`);
      }
      return total + observation.confirmedEdgeDelta;
    }, 0);
  }

  #stageThreeConfirmedEdgeDelta(modules, baselineEdgeCount) {
    const migrationRoot = path.join(this.projectRoot, "architecture/migration");
    const byPath = new Map(modules.map((module) => [module.currentPath, module]));
    const identities = new Set();
    let expectedBefore = baselineEdgeCount;
    // Prerequisite transitions recorded after a batch change the edge count seen by later batches.
    const { StageThreePrerequisiteLedger } = require("../stage_three_prerequisites/core/prerequisite_ledger");
    const prerequisites = new StageThreePrerequisiteLedger(this.projectRoot).records();
    return fs.readdirSync(migrationRoot)
      .filter((name) => /^stage_3_batch_\d+_runtime_cutover\.json$/u.test(name))
      .sort()
      .reduce((total, name) => {
        const batchNumber = Number(/^stage_3_batch_(\d+)_/u.exec(name)[1]);
        while (prerequisites.length > 0 && Number(prerequisites[0].afterBatch) < batchNumber) {
          expectedBefore += prerequisites.shift().dependencyObservation.confirmedEdgeDelta;
        }
        const artifact = JSON.parse(fs.readFileSync(path.join(migrationRoot, name), "utf8"));
        if (name === "stage_3_batch_009_runtime_cutover.json" && artifact.manifestTransition?.observations === "pending") {
          const { Batch009CutoverHistory } = require("../domain_batches/stage_three_batch_009_cutover_history");
          const history = new Batch009CutoverHistory(this.projectRoot);
          if (!history.active()) {
            const { StageThreeBatch009ReleaseTransition, STATE } = require("../domain_batches/stage_three_batch_009_release_transition");
            const release = new StageThreeBatch009ReleaseTransition(this.projectRoot);
            const { Batch010History } = require("../domain_batches/stage_three_batch_010_history");
            const historicalState = JSON.parse(release.before(STATE,
              new Batch010History(this.projectRoot).before(STATE)));
            if (historicalState.activeBatchId !== artifact.batchId ||
                historicalState.activeBatchPhase !== "runtime-active") {
              throw new Error("Batch 009 pending cutover lacks an exact runtime-active predecessor");
            }
          }
          history.artifact();
            history.before("architecture/migration/module_migration_manifest.json", fs.readFileSync(path.join(migrationRoot, "module_migration_manifest.json")));
            const observedPath = path.join(migrationRoot, "stage_3_batch_009_observation_reconciliation.json");
            if (fs.existsSync(observedPath)) {
              const observed = JSON.parse(fs.readFileSync(observedPath));
              const delta = observed.dependencyDelta;
              if (observed.status !== "verified" || observed.batchId !== artifact.batchId ||
                  delta.confirmedInterFileEdgesBefore !== expectedBefore ||
                  delta.confirmedInterFileEdgesAfter !== expectedBefore ||
                  delta.newlyConfirmedEdges.length !== 0 || delta.removedEdges.length !== 0) {
                throw new Error("Batch 009 reconciliation changed the confirmed-edge sequence");
              }
            }
          return total; // Publication creates no authoritative observation edges.
        }
        const modernBatch = /^stage_3_batch_(\d{3})_runtime_cutover\.json$/u.exec(name);
        if (modernBatch && Number(modernBatch[1]) >= 10 &&
            artifact.manifestTransition?.observations === "pending") {
          const number = modernBatch[1];
          // Continuation batches with a shared definition use the shared cutover history.
          const { StageThreeBatchRegistry } = require("../stage_three_batches/core/batch_definition");
          if (StageThreeBatchRegistry.has(number)) {
            const { StageThreeCutoverHistory } = require("../stage_three_batches/lifecycle/cutover_history");
            new StageThreeCutoverHistory(this.projectRoot, StageThreeBatchRegistry.load(number)).artifact();
          } else {
            const History = require(`../domain_batches/stage_three_batch_${number}_cutover_history`)
              [`Batch${number}CutoverHistory`];
            new History(this.projectRoot).artifact();
          }
          // A migrated source that imported completed-prefix exports stops reading their legacy
          // globals: its cutover removes exactly those classic edges and adds none.
          const retiredEdges = this.#reviewedImportEdgesRetiredByCutover(artifact);
          expectedBefore -= retiredEdges;
          total -= retiredEdges;
          const observedPath = path.join(migrationRoot, `stage_3_batch_${number}_observation_reconciliation.json`);
          if (fs.existsSync(observedPath)) {
            const observed = JSON.parse(fs.readFileSync(observedPath));
            const delta = observed.dependencyDelta;
            if (observed.status !== "verified" || observed.batchId !== artifact.batchId ||
                delta.confirmedInterFileEdgesBefore !== expectedBefore ||
                delta.confirmedInterFileEdgesAfter !== expectedBefore ||
                delta.newlyConfirmedEdges.length !== 0 || delta.removedEdges.length !== 0) {
              throw new Error(`Batch ${number} reconciliation changed the confirmed-edge sequence`);
            }
          }
          return total;
        }
        if (!artifact.dependencyObservation && artifact.manifestTransition?.observations === "pending") {
          // A cutover is not an observation approval. Its exact preliminary delta
          // is independently guarded; no dependency facts may be invented here.
          const { Batch008CutoverHistory } = require("../domain_batches/stage_three_batch_008_cutover_history");
          const history = new Batch008CutoverHistory(this.projectRoot);
          const { validateCutoverArtifact } = require("../domain_batches/stage_three_batch_008_cutover");
          if (!history.active()) throw new Error(`Pending cutover has no active observation gate: ${name}`);
          validateCutoverArtifact(artifact, history.json("architecture/migration/stage_3_batch_008_prebuild_contract.json"),
            history.json("architecture/migration/stage_3_batch_008_source_build_validation.json"));
          history.before("architecture/migration/module_migration_manifest.json");
          const observationPath = path.join(migrationRoot, "stage_3_batch_008_observation_reconciliation.json");
          if (fs.existsSync(observationPath)) {
            const observation = JSON.parse(fs.readFileSync(observationPath, "utf8"));
            const delta = observation.dependencyDelta;
            if (observation.status !== "verified" || observation.batchId !== artifact.batchId ||
                delta.confirmedInterFileEdgesBefore !== expectedBefore ||
                delta.confirmedInterFileEdgesAfter !== expectedBefore ||
                delta.newlyConfirmedEdges.length !== 0 || delta.removedEdges.length !== 0) {
              throw new Error(`Reconciliation changed the exact confirmed-edge sequence: ${name}`);
            }
          }
          return total;
        }
        const delta = artifact?.dependencyObservation?.confirmedEdgeDelta || 0;
        if (!Number.isInteger(delta) || delta < 0) {
          throw new Error(`Stage 3 cutover confirmed-edge delta is invalid: ${name}`);
        }
        const records = artifact?.dependencyObservation?.newlyConfirmedEdges || [];
        if (records.length !== delta ||
          artifact.dependencyObservation.confirmedInterFileEdgesBefore !== expectedBefore ||
          artifact.dependencyObservation.confirmedInterFileEdgesAfter !== expectedBefore + delta) {
          throw new Error(`Stage 3 cutover confirmed-edge sequence is invalid: ${name}`);
        }
        for (const record of records) {
          const identity = `${record.source}\0${record.target}\0${JSON.stringify(record.symbols)}`;
          if (identities.has(identity)) {
            throw new Error(`Stage 3 cutover confirmed-edge evidence is duplicated: ${name}`);
          }
          identities.add(identity);
          const observed = byPath.get(record.source)?.analysis?.dependencies?.items || [];
          if (!observed.some((edge) => edge.target === record.target &&
            JSON.stringify(edge.symbols) === JSON.stringify(record.symbols) &&
            edge.resolution === "confirmed")) {
            throw new Error(`Stage 3 cutover confirmed-edge evidence is not observed: ${name}`);
          }
        }
        expectedBefore += delta;
        return total + delta;
      }, 0);
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
