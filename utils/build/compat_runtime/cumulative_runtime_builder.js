"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");
const estraverse = require("estraverse");
const { LegacyScriptOrderReader } = require(
  "../../architecture/migration/legacy_script_order_reader"
);
const {
  CumulativeRuntimeContractValidator,
  EXACT_TRANSPORT_GLOBAL,
} = require("./cumulative_runtime_contract");
const {
  CumulativeGraphPlanner,
  CumulativeRuntimePlanAssembler,
  StageThreeTargetSelector,
  StageTwoMigratedTargetCatalog,
} = require("./cumulative_graph_planner");
const { CumulativeSideEffectGate } = require("./cumulative_side_effect_gate");
const {
  ActivationShimContractValidator,
  ActivationShimRenderer,
} = require("./activation_shim");
const { CumulativeRuntimeOutputManager } = require(
  "./cumulative_runtime_output_manager"
);

class CumulativeRuntimeEntryRenderer {
  render({ modules, entryPath, projectRoot, transportSymbol = EXACT_TRANSPORT_GLOBAL }) {
    const imports = [];
    const properties = [];
    modules.forEach((modulePath, index) => {
      const alias = `module${index}`;
      let specifier = path
        .relative(path.dirname(entryPath), path.resolve(projectRoot, modulePath))
        .replaceAll("\\", "/");
      if (!specifier.startsWith(".")) specifier = `./${specifier}`;
      imports.push(`import * as ${alias} from ${JSON.stringify(specifier)};`);
      properties.push(`    ${JSON.stringify(modulePath)}: ${alias}`);
    });
    return [
      ...imports,
      "",
      `globalThis.${transportSymbol} = Object.freeze({`,
      '  kind: "cyber-fishing-stage-3-compatibility-transport",',
      "  ownsGameState: false,",
      "  modules: Object.freeze({",
      properties.join(",\n"),
      "  })",
      "});",
      "",
    ].join("\n");
  }
}

class CumulativeRuntimeBundleValidator {
  validate({ code, actualModules, approvedModules }) {
    const actual = [...new Set(actualModules)].sort();
    const approved = [...new Set(approvedModules)].sort();
    if (!this.#sameArray(actual, approved)) {
      throw new Error(
        `Cumulative bundle graph differs from approved graph: ` +
          `${actual.join(", ")} !== ${approved.join(", ")}`,
      );
    }
    let tree;
    try {
      tree = espree.parse(code, { ecmaVersion: "latest", sourceType: "script" });
    } catch (error) {
      throw new Error(`Cumulative output is not a classic script: ${error.message}`);
    }
    const globalAssignments = [];
    estraverse.traverse(tree, {
      fallback: "iteration",
      enter(node) {
        if (
          node.type === "AssignmentExpression" &&
          node.left?.type === "MemberExpression" &&
          !node.left.computed &&
          node.left.object?.type === "Identifier" &&
          node.left.object.name === "globalThis" &&
          node.left.property?.type === "Identifier"
        ) {
          globalAssignments.push(node.left.property.name);
        }
      },
    });
    if (!this.#sameArray(globalAssignments, [EXACT_TRANSPORT_GLOBAL])) {
      throw new Error(
        `Cumulative output must assign only the exact transport global: ` +
          globalAssignments.join(", "),
      );
    }
    return Object.freeze({ bundledModules: Object.freeze(actual) });
  }

  #sameArray(left, right) {
    return left.length === right.length &&
      left.every((value, index) => value === right[index]);
  }
}

class DirectNamedExportValidator {
  constructor(projectRoot) {
    this.projectRoot = path.resolve(projectRoot);
  }

  validate(activations) {
    const byModule = new Map();
    for (const activation of activations) {
      if (!byModule.has(activation.targetModule)) {
        byModule.set(activation.targetModule, this.#exports(activation.targetModule));
      }
      if (!byModule.get(activation.targetModule).has(activation.exportName)) {
        throw new Error(
          `Activation export is not a direct named export: ` +
            `${activation.targetModule}#${activation.exportName}`,
        );
      }
    }
  }

  #exports(modulePath) {
    const tree = espree.parse(
      fs.readFileSync(path.resolve(this.projectRoot, modulePath), "utf8"),
      { ecmaVersion: "latest", sourceType: "module" },
    );
    const exports = new Set();
    for (const node of tree.body) {
      if (node.type === "ExportDefaultDeclaration" || node.type === "ExportAllDeclaration") {
        throw new Error(`Cumulative target must use direct named exports: ${modulePath}`);
      }
      if (node.type !== "ExportNamedDeclaration" || node.source) continue;
      if (node.declaration) {
        if (node.declaration.id?.name) exports.add(node.declaration.id.name);
        for (const declaration of node.declaration.declarations || []) {
          this.#bindingNames(declaration.id, exports);
        }
      }
      for (const specifier of node.specifiers || []) {
        if (specifier.exported?.name) exports.add(specifier.exported.name);
      }
    }
    return exports;
  }

  #bindingNames(node, result) {
    if (!node) return;
    if (node.type === "Identifier") result.add(node.name);
    for (const property of node.properties || []) {
      this.#bindingNames(property.value || property.argument, result);
    }
    for (const element of node.elements || []) this.#bindingNames(element, result);
    if (node.type === "RestElement") this.#bindingNames(node.argument, result);
    if (node.type === "AssignmentPattern") this.#bindingNames(node.left, result);
  }
}

class LegacyActivationPositionValidator {
  validate({ activations, scripts }) {
    const byOrder = new Map(
      scripts
        .filter((script) => script.type === "classic")
        .map((script) => [script.legacyLoadOrder, script.currentPath]),
    );
    for (const activation of activations) {
      const actualProvider = byOrder.get(activation.legacyScriptIndex);
      if (actualProvider !== activation.sourceProvider) {
        throw new Error(
          `Activation position differs from legacy provider: ${activation.id}; ` +
            `${actualProvider || "<missing>"} !== ${activation.sourceProvider}`,
        );
      }
    }
  }
}

class CumulativeRuntimeBuildApplication {
  constructor({
    projectRoot = path.resolve(__dirname, "../../.."),
    contract,
    approvedPlan,
    executionState,
    stageTwoApprovedPlan = null,
    stageTwoExecutionState = null,
    previousStageModules = null,
    viteLoader = () => import("vite"),
    outputManager = null,
    scriptOrderProvider = null,
  } = {}) {
    this.projectRoot = path.resolve(projectRoot);
    this.contract = contract;
    this.approvedPlan = approvedPlan;
    this.executionState = executionState;
    this.stageTwoApprovedPlan = stageTwoApprovedPlan;
    this.stageTwoExecutionState = stageTwoExecutionState;
    this.previousStageModules = previousStageModules;
    this.viteLoader = viteLoader;
    this.outputManager = outputManager || new CumulativeRuntimeOutputManager(this.projectRoot);
    this.scriptOrderProvider = scriptOrderProvider || (() =>
      new LegacyScriptOrderReader(path.resolve(this.projectRoot, "index.html")).read());
  }

  async run() {
    const contract = new CumulativeRuntimeContractValidator().validate(this.contract);
    const selection = new StageThreeTargetSelector().select({
      approvedPlan: this.approvedPlan,
      executionState: this.executionState,
    });
    if (selection.targetModules.length === 0) {
      if (contract.activationPositions.length > 0) {
        throw new Error("Activation positions require an active or completed Stage 3 target");
      }
      this.outputManager.cleanupInactiveOutput();
      return Object.freeze({
        status: "no-active-runtime",
        moduleCount: 0,
        activationCount: 0,
        outputs: Object.freeze([]),
      });
    }
    if (contract.status === "foundation-verified") {
      throw new Error("Active Stage 3 targets require migration-active compatibility contract");
    }
    const previousStageModules = this.previousStageModules ||
      (this.stageTwoApprovedPlan && this.stageTwoExecutionState
        ? new StageTwoMigratedTargetCatalog().collect({
          approvedPlan: this.stageTwoApprovedPlan,
          executionState: this.stageTwoExecutionState,
        })
        : []);
    const graph = new CumulativeGraphPlanner({ projectRoot: this.projectRoot }).plan({
      targetModules: selection.targetModules,
      approvedInfrastructureModules: contract.approvedInfrastructureModules,
      previousStageModules,
      previousRuntimeTransitions: contract.previousRuntimeTransitions,
      activations: contract.activationPositions,
    });
    if (graph.issues.length > 0) {
      throw new Error(
        `Cumulative runtime plan has unresolved identity issues:\n- ` +
          graph.issues.map((issue) => `${issue.code}: ${issue.module}`).join("\n- "),
      );
    }
    const effects = new CumulativeSideEffectGate({ projectRoot: this.projectRoot }).verify({
      graph,
      reviews: contract.sideEffectReviews,
    });
    const runtimePlan = new CumulativeRuntimePlanAssembler().assemble({ graph, effects });
    const selected = new Set(graph.modules.map((record) => record.path));
    for (const activation of contract.activationPositions) {
      if (!selected.has(activation.targetModule)) {
        throw new Error(`Activation target is not selected by execution state: ${activation.targetModule}`);
      }
    }
    new DirectNamedExportValidator(this.projectRoot).validate(contract.activationPositions);
    new LegacyActivationPositionValidator().validate({
      activations: contract.activationPositions,
      scripts: this.scriptOrderProvider(),
    });
    return this.#build({ contract, graph, effects, runtimePlan, selection });
  }

  async #build({ contract, graph, effects, runtimePlan, selection }) {
    const stagingPath = this.outputManager.createStagingDirectory();
    try {
      const inputPath = this.outputManager.assertControlledChild(stagingPath, path.join(stagingPath, ".input"), ".input");
      const vitePath = this.outputManager.assertControlledChild(stagingPath, path.join(stagingPath, ".vite"), ".vite");
      fs.mkdirSync(inputPath);
      const entryPath = path.resolve(inputPath, "cumulative_runtime_entry.js");
      if (path.dirname(entryPath) !== inputPath) throw new Error("Unsafe cumulative entry path");
      const entrySource = new CumulativeRuntimeEntryRenderer().render({
        modules: graph.modules.map((record) => record.path),
        entryPath,
        projectRoot: this.projectRoot,
      });
      fs.writeFileSync(entryPath, entrySource, "utf8");
      const vite = await this.viteLoader();
      if (typeof vite?.build !== "function") throw new Error("Vite loader did not provide build()");
      const buildResult = await vite.build({
        configFile: false,
        root: this.projectRoot,
        publicDir: false,
        logLevel: "silent",
        plugins: [this.#deterministicRenderPlugin()],
        build: {
          outDir: vitePath,
          emptyOutDir: true,
          minify: false,
          sourcemap: false,
          target: "es2020",
          lib: {
            entry: entryPath,
            formats: ["iife"],
            name: "CyberFishingCompatibilityRuntime",
            fileName: () => contract.output.runtimeFile,
          },
        },
      });
      const emitted = (Array.isArray(buildResult) ? buildResult : [buildResult])
        .flatMap((result) => result.output || []);
      const chunks = emitted.filter((item) => item.type === "chunk");
      const assets = emitted.filter((item) => item.type !== "chunk");
      if (
        chunks.length !== 1 ||
        chunks[0].fileName !== contract.output.runtimeFile ||
        assets.length > 0
      ) {
        throw new Error("Cumulative runtime build emitted unexpected chunks/assets");
      }
      const actualModules = this.#actualProjectModules(
        chunks[0].modules,
        entryPath,
        contract.approvedVirtualModules,
      );
      const runtimeSourcePath = path.resolve(vitePath, contract.output.runtimeFile);
      const runtimeOutputPath = path.resolve(stagingPath, contract.output.runtimeFile);
      if (path.dirname(runtimeOutputPath) !== stagingPath || !fs.existsSync(runtimeSourcePath)) {
        throw new Error("Cumulative runtime output file is missing or unsafe");
      }
      const code = fs.readFileSync(runtimeSourcePath, "utf8");
      const validation = new CumulativeRuntimeBundleValidator().validate({
        code,
        actualModules: actualModules.projectModules,
        approvedModules: graph.modules.map((record) => record.path),
      });
      fs.writeFileSync(runtimeOutputPath, code, "utf8");
      const activationOutputs = this.#writeActivationShims(stagingPath, contract);
      fs.rmSync(inputPath, { recursive: true, force: true });
      fs.rmSync(vitePath, { recursive: true, force: true });
      this.outputManager.publish(stagingPath);
      const runtimeRelative = `${contract.output.directory}${contract.output.runtimeFile}`;
      return Object.freeze({
        status: "built",
        moduleCount: validation.bundledModules.length,
        activationCount: activationOutputs.length,
        selectedBatchIds: selection.selectedBatchIds,
        effects,
        plan: runtimePlan,
        outputs: Object.freeze([
          Object.freeze({
            kind: "cumulative-runtime",
            path: runtimeRelative,
            sha256: this.#sha256(code),
            projectModules: validation.bundledModules,
            virtualBuildModules: actualModules.virtualModules,
          }),
          ...activationOutputs,
        ]),
      });
    } catch (error) {
      this.outputManager.discard(stagingPath);
      throw error;
    }
  }

  #writeActivationShims(stagingPath, contract) {
    if (contract.activationPositions.length === 0) return [];
    const activationRoot = path.resolve(stagingPath, "activations");
    if (path.dirname(activationRoot) !== stagingPath || path.basename(activationRoot) !== "activations") {
      throw new Error("Unsafe activation output directory");
    }
    fs.mkdirSync(activationRoot);
    const renderer = new ActivationShimRenderer();
    const validator = new ActivationShimContractValidator();
    return contract.activationPositions
      .map((activation) => {
        const outputPath = path.resolve(stagingPath, activation.shimFile);
        if (path.dirname(outputPath) !== activationRoot) {
          throw new Error(`Activation shim escaped exact output directory: ${activation.shimFile}`);
        }
        const code = renderer.render(activation, contract.transport.symbol);
        validator.validate({ code, activation, transportSymbol: contract.transport.symbol });
        fs.writeFileSync(outputPath, code, "utf8");
        return Object.freeze({
          kind: "activation-shim",
          path: `${contract.output.directory}${activation.shimFile}`,
          sha256: this.#sha256(code),
          activationId: activation.id,
          legacyScriptIndex: activation.legacyScriptIndex,
          targetModule: activation.targetModule,
          exportName: activation.exportName,
          legacySymbol: activation.legacySymbol,
        });
      })
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  #actualProjectModules(modules, entryPath, approvedVirtualModules) {
    const result = [];
    const virtualModules = [];
    const unapprovedVirtualModules = [];
    const approvedVirtual = new Set(approvedVirtualModules || []);
    for (const moduleId of Object.keys(modules || {})) {
      if (moduleId.startsWith("\u0000")) {
        if (!approvedVirtual.has(moduleId)) {
          unapprovedVirtualModules.push(moduleId);
          continue;
        }
        virtualModules.push(moduleId);
        continue;
      }
      const absolute = path.resolve(moduleId);
      if (absolute === path.resolve(entryPath)) continue;
      const relative = path.relative(this.projectRoot, absolute).replaceAll("\\", "/");
      if (relative.startsWith("../") || path.isAbsolute(relative)) {
        throw new Error(`Cumulative bundle escaped project root: ${moduleId}`);
      }
      if (
        relative === "index.html" ||
        relative.startsWith("assets/") ||
        relative === "node_modules" ||
        relative.startsWith("node_modules/")
      ) {
        throw new Error(`Cumulative bundle contains forbidden input: ${relative}`);
      }
      result.push(relative);
    }
    if (unapprovedVirtualModules.length > 0) {
      throw new Error(
        `Cumulative bundle contains unapproved virtual modules: ` +
          [...new Set(unapprovedVirtualModules)].sort().join(", "),
      );
    }
    const observedVirtual = [...new Set(virtualModules)].sort();
    return Object.freeze({
      projectModules: Object.freeze([...new Set(result)].sort()),
      virtualModules: Object.freeze(observedVirtual),
    });
  }

  #deterministicRenderPlugin() {
    return {
      name: "cyber-fishing-stage-3-deterministic-render",
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
  }

  #sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }
}

module.exports = {
  CumulativeRuntimeBuildApplication,
  CumulativeRuntimeBundleValidator,
  CumulativeRuntimeEntryRenderer,
  DirectNamedExportValidator,
  LegacyActivationPositionValidator,
};
