const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");
const estraverse = require("estraverse");
const { ArchitecturePolicy } = require("../architecture/core/architecture_policy");
const {
  ActiveBridgePlanResolver,
  ApprovedDependencyClosureValidator,
  BridgeWrapperContractValidator,
} = require("./legacy_bridge_build_config");

class LegacyBridgeOutputManager {
  constructor(projectRoot) {
    this.projectRoot = path.resolve(projectRoot);
    this.distPath = path.resolve(this.projectRoot, "dist");
    this.outputPath = path.resolve(this.distPath, "legacy-bridges");
  }

  cleanupInactiveOutput() {
    this.#removeOutputIfPresent();
    this.#removePreviousIfPresent();
    this.#cleanupStagingDirectories();
    this.#removeEmptyDist();
  }

  createStagingDirectory() {
    fs.mkdirSync(this.distPath, { recursive: true });
    this.#recoverPreviousOutput();
    const stagingPath = fs.mkdtempSync(
      path.join(this.distPath, ".legacy-bridges-stage-"),
    );
    this.#assertStagingPath(stagingPath);
    return stagingPath;
  }

  publish(stagingPath) {
    this.#assertStagingPath(stagingPath);
    this.#assertOutputPath(this.outputPath);
    const previousPath = path.resolve(this.distPath, ".legacy-bridges-previous");
    this.#assertPreviousPath(previousPath);
    if (fs.existsSync(previousPath)) {
      fs.rmSync(previousPath, { recursive: true, force: true });
    }
    const hadPrevious = fs.existsSync(this.outputPath);
    if (hadPrevious) fs.renameSync(this.outputPath, previousPath);
    try {
      fs.renameSync(stagingPath, this.outputPath);
    } catch (error) {
      if (hadPrevious && fs.existsSync(previousPath) && !fs.existsSync(this.outputPath)) {
        fs.renameSync(previousPath, this.outputPath);
      }
      throw error;
    }
    if (hadPrevious) {
      try {
        fs.rmSync(previousPath, { recursive: true, force: true });
      } catch {
        // The new output is already fully validated and published. A locked
        // backup is recovered/cleaned deterministically on the next run.
      }
    }
  }

  discard(stagingPath) {
    if (!stagingPath || !fs.existsSync(stagingPath)) return;
    this.#assertStagingPath(stagingPath);
    fs.rmSync(stagingPath, { recursive: true, force: true });
    this.#removeEmptyDist();
  }

  #removeOutputIfPresent() {
    if (!fs.existsSync(this.outputPath)) return;
    this.#assertOutputPath(this.outputPath);
    fs.rmSync(this.outputPath, { recursive: true, force: true });
  }

  #previousPath() {
    return path.resolve(this.distPath, ".legacy-bridges-previous");
  }

  #removePreviousIfPresent() {
    const previousPath = this.#previousPath();
    if (!fs.existsSync(previousPath)) return;
    this.#assertPreviousPath(previousPath);
    fs.rmSync(previousPath, { recursive: true, force: true });
  }

  #recoverPreviousOutput() {
    const previousPath = this.#previousPath();
    if (!fs.existsSync(previousPath)) return;
    this.#assertPreviousPath(previousPath);
    if (fs.existsSync(this.outputPath)) {
      fs.rmSync(previousPath, { recursive: true, force: true });
      return;
    }
    fs.renameSync(previousPath, this.outputPath);
  }

  #cleanupStagingDirectories() {
    if (!fs.existsSync(this.distPath)) return;
    for (const entry of fs.readdirSync(this.distPath, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith(".legacy-bridges-stage-")) {
        continue;
      }
      const stagingPath = path.resolve(this.distPath, entry.name);
      this.#assertStagingPath(stagingPath);
      fs.rmSync(stagingPath, { recursive: true, force: true });
    }
  }

  #removeEmptyDist() {
    if (!fs.existsSync(this.distPath)) return;
    if (fs.readdirSync(this.distPath).length === 0) fs.rmdirSync(this.distPath);
  }

  #assertOutputPath(candidate) {
    const resolved = path.resolve(candidate);
    if (
      resolved !== this.outputPath ||
      path.dirname(resolved) !== this.distPath ||
      path.basename(resolved) !== "legacy-bridges"
    ) {
      throw new Error(`Refusing unsafe legacy bridge output operation: ${resolved}`);
    }
  }

  #assertStagingPath(candidate) {
    const resolved = path.resolve(candidate);
    const basename = path.basename(resolved);
    if (
      path.dirname(resolved) !== this.distPath ||
      !basename.startsWith(".legacy-bridges-stage-") ||
      basename === ".legacy-bridges-stage-" ||
      resolved === this.projectRoot ||
      resolved === this.distPath ||
      resolved === this.outputPath
    ) {
      throw new Error(`Refusing unsafe legacy bridge staging operation: ${resolved}`);
    }
  }

  #assertPreviousPath(candidate) {
    const resolved = path.resolve(candidate);
    if (
      resolved !== path.resolve(this.distPath, ".legacy-bridges-previous") ||
      path.dirname(resolved) !== this.distPath ||
      path.basename(resolved) !== ".legacy-bridges-previous"
    ) {
      throw new Error(`Refusing unsafe legacy bridge previous-output operation: ${resolved}`);
    }
  }
}

class LegacyBridgeBundleValidator {
  validate({ code, plan, actualModules, approvedModules }) {
    const actual = [...new Set(actualModules)].sort();
    const approved = [...new Set(approvedModules)].sort();
    if (!this.#sameArray(actual, approved)) {
      throw new Error(
        `Vite bundle graph differs from approved closure for ${plan.wrapperPath}: ` +
          `${actual.join(", ")} !== ${approved.join(", ")}`,
      );
    }
    let tree;
    try {
      tree = espree.parse(code, { ecmaVersion: "latest", sourceType: "script" });
    } catch (error) {
      throw new Error(`Generated bridge output is not a classic script: ${error.message}`);
    }
    const globals = [];
    estraverse.traverse(tree, {
      enter(node) {
        if (
          node.type === "AssignmentExpression" &&
          node.left?.type === "MemberExpression" &&
          !node.left.computed &&
          node.left.object?.type === "Identifier" &&
          node.left.object.name === "globalThis" &&
          node.left.property?.type === "Identifier"
        ) {
          globals.push(node.left.property.name);
        }
      },
      fallback: "iteration",
    });
    const expectedGlobals = plan.globalProviders.map((item) => item.symbol).sort();
    if (!this.#sameArray(globals.sort(), expectedGlobals)) {
      throw new Error(
        `Generated bridge globals differ from approved providers: ` +
          `${globals.sort().join(", ")} !== ${expectedGlobals.join(", ")}`,
      );
    }
    return Object.freeze({
      bundledModules: Object.freeze(actual),
      globalProviders: Object.freeze(
        plan.globalProviders.map((item) => Object.freeze({ ...item })),
      ),
    });
  }

  #sameArray(left, right) {
    return left.length === right.length &&
      left.every((value, index) => value === right[index]);
  }
}

class LegacyBridgeBuildApplication {
  constructor({
    projectRoot = path.resolve(__dirname, "../.."),
    viteLoader = () => import("vite"),
    outputManager = null,
  } = {}) {
    this.projectRoot = path.resolve(projectRoot);
    this.viteLoader = viteLoader;
    this.outputManager = outputManager || new LegacyBridgeOutputManager(this.projectRoot);
  }

  async run() {
    if (this.#stageThreeCompatibilityActivated()) {
      this.outputManager.cleanupInactiveOutput();
      return this.#report("transitioned-to-cumulative-runtime", []);
    }
    const inputs = this.#loadInputs();
    const runtimeFacts = this.#runtimeFacts();
    const resolved = new ActiveBridgePlanResolver().resolve({
      ...inputs,
      runtimeFacts,
    });
    if (resolved.plans.length === 0) {
      this.outputManager.cleanupInactiveOutput();
      return this.#report("no-active-bridges", []);
    }

    const wrapperValidator = new BridgeWrapperContractValidator(this.projectRoot);
    const closureValidator = new ApprovedDependencyClosureValidator({
      projectRoot: this.projectRoot,
      approvedPlan: inputs.approvedPlan,
      state: inputs.state,
      architecturePolicy: inputs.architecturePolicy,
      manifest: inputs.manifest,
    });
    const verifiedPlans = resolved.plans.map((plan) => ({
      plan,
      wrapper: wrapperValidator.validate(plan),
      closure: closureValidator.validate(plan),
    }));

    const stagingPath = this.outputManager.createStagingDirectory();
    try {
      const vite = await this.viteLoader();
      if (typeof vite?.build !== "function") {
        throw new Error("Vite loader did not provide build()");
      }
      const outputs = [];
      for (const verified of verifiedPlans) {
        outputs.push(await this.#buildOne(vite.build, stagingPath, verified));
      }
      this.outputManager.publish(stagingPath);
      return this.#report("built", outputs);
    } catch (error) {
      this.outputManager.discard(stagingPath);
      throw error;
    }
  }

  #stageThreeCompatibilityActivated() {
    const statePath = path.join(
      this.projectRoot,
      "architecture/migration/stage_3_execution_state.json",
    );
    if (!fs.existsSync(statePath)) return false;
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    return state.compatibilityRuntimeActivated === true;
  }

  #loadInputs() {
    const read = (relativePath) =>
      JSON.parse(fs.readFileSync(path.join(this.projectRoot, relativePath), "utf8"));
    return {
      state: read("architecture/migration/stage_2_execution_state.json"),
      approvedPlan: read("architecture/migration/stage_2_approved_batches.json"),
      bridgeRegistry: read("architecture/guards/migration_bridge_registry.json"),
      manifest: read("architecture/migration/module_migration_manifest.json"),
      architecturePolicy: ArchitecturePolicy.load(
        path.join(this.projectRoot, "architecture/module_architecture.json"),
      ),
    };
  }

  #runtimeFacts() {
    const html = fs.readFileSync(path.join(this.projectRoot, "index.html"), "utf8");
    return Object.freeze({
      moduleScriptCount: (
        html.match(/<script\b[^>]*\btype\s*=\s*["']module["']/giu) || []
      ).length,
    });
  }

  async #buildOne(build, stagingPath, verified) {
    const plan = verified.plan;
    const outputName = path.basename(plan.outputPath);
    const stripRegionComments = {
      name: "cyber-fishing-strip-region-comments",
      renderChunk(code) {
        return {
          code: code
            .split("\n")
            .filter((line) => {
              const trimmed = line.trimStart();
              return !trimmed.startsWith("//#region") &&
                !trimmed.startsWith("//#endregion");
            })
            .join("\n"),
          map: null,
        };
      },
    };
    const buildResult = await build({
      configFile: false,
      root: this.projectRoot,
      publicDir: false,
      logLevel: "silent",
      plugins: [stripRegionComments],
      build: {
        outDir: stagingPath,
        emptyOutDir: false,
        minify: false,
        sourcemap: false,
        target: "es2020",
        lib: {
          entry: path.resolve(this.projectRoot, plan.wrapperPath),
          formats: ["iife"],
          name: "CyberFishingLegacyBridge",
          fileName: () => outputName,
        },
      },
    });
    const results = Array.isArray(buildResult) ? buildResult : [buildResult];
    const emitted = results.flatMap((result) => result.output || []);
    const chunks = emitted.filter((item) => item.type === "chunk");
    const assets = emitted.filter((item) => item.type !== "chunk");
    if (chunks.length !== 1 || chunks[0].fileName !== outputName || assets.length > 0) {
      throw new Error(`Bridge build emitted unexpected chunks/assets for ${plan.wrapperPath}`);
    }
    const actualModules = Object.keys(chunks[0].modules || {}).map((moduleId) => {
      if (moduleId.startsWith("\u0000")) {
        throw new Error(`Bridge bundle contains unapproved virtual module: ${moduleId}`);
      }
      const absolute = path.resolve(moduleId);
      const relative = path.relative(this.projectRoot, absolute).replaceAll("\\", "/");
      if (relative.startsWith("../") || path.isAbsolute(relative)) {
        throw new Error(`Bridge bundle escaped project source graph: ${moduleId}`);
      }
      if (relative === "index.html" || relative.startsWith("assets/")) {
        throw new Error(`Bridge bundle contains forbidden input: ${relative}`);
      }
      if (relative === "node_modules" || relative.startsWith("node_modules/")) {
        throw new Error(`Bridge bundle contains unapproved external package: ${relative}`);
      }
      return relative;
    });
    const outputPath = path.join(stagingPath, outputName);
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Bridge output file is missing: ${outputName}`);
    }
    const code = fs.readFileSync(outputPath, "utf8");
    const validation = new LegacyBridgeBundleValidator().validate({
      code,
      plan,
      actualModules,
      approvedModules: verified.closure.bundledModules,
    });
    return Object.freeze({
      path: plan.outputPath,
      sha256: crypto.createHash("sha256").update(code).digest("hex"),
      entryWrapper: plan.wrapperPath,
      targetModule: plan.targetModule,
      globalProviders: validation.globalProviders,
      bundledModules: validation.bundledModules,
    });
  }

  #report(status, outputs) {
    return Object.freeze({
      status,
      bridgeCount: outputs.length,
      outputs: Object.freeze(outputs),
    });
  }
}

async function runCli() {
  const report = await new LegacyBridgeBuildApplication().run();
  console.log(
    `Legacy bridge build: ${report.status}; ${report.bridgeCount} output(s).`,
  );
  for (const output of report.outputs) {
    console.log(
      `- ${output.path} ${output.sha256} ` +
        `[${output.bundledModules.join(", ")}]`,
    );
  }
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  LegacyBridgeBuildApplication,
  LegacyBridgeBundleValidator,
  LegacyBridgeOutputManager,
};
