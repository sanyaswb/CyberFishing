const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { ArchitecturePolicy } = require("./core/architecture_policy");
const {
  ActiveBridgePlanResolver,
  ApprovedDependencyClosureValidator,
  BridgeWrapperContractValidator,
  CanonicalBridgeIdentity,
} = require("../build/legacy_bridge_build_config");
const {
  LegacyBridgeBuildApplication,
  LegacyBridgeBundleValidator,
  LegacyBridgeOutputManager,
} = require("../build/build_legacy_bridges");
const { DevServerApplication } = require("../dev-server");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

class TemporaryProject {
  constructor(label) {
    this.prefix = `cyber-fishing-stage-2-${label}-`;
    this.root = fs.mkdtempSync(path.join(os.tmpdir(), this.prefix));
  }

  write(relativePath, contents) {
    const target = path.join(this.root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  }

  writeJson(relativePath, value) {
    this.write(relativePath, `${JSON.stringify(value, null, 2)}\n`);
  }

  read(relativePath) {
    return fs.readFileSync(path.join(this.root, relativePath), "utf8");
  }

  exists(relativePath) {
    return fs.existsSync(path.join(this.root, relativePath));
  }

  dispose() {
    const resolved = path.resolve(this.root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith(this.prefix));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

class SyntheticBridgeProjectFactory {
  constructor(policyDefinition) {
    this.policyDefinition = policyDefinition;
  }

  create(label, { targetSource = null, consumers = null } = {}) {
    const project = new TemporaryProject(label);
    const contract = this.#contract(consumers || ["src/legacy_consumer.js"]);
    const state = {
      schemaVersion: 1,
      kind: "cyber-fishing-stage-2-execution-state",
      sourceClosureVersion: "0.24.31",
      releaseVersion: "0.24.32",
      status: "migration-active",
      completedBatchIds: [],
      activeBatchId: contract.batchId,
      esmRuntimeIntegrationStarted: true,
      closureTransition: { mode: "semantic-release-delta" },
    };
    const approvedPlan = {
      schemaVersion: 1,
      approvedAtVersion: "0.24.31",
      batches: [
        {
          id: contract.batchId,
          targetBoundary: "engine",
          modules: [
            {
              currentPath: "src/legacy_exact_symbol.js",
              targetPath: contract.targetModule,
            },
          ],
          bridgeStrategy: {
            owner: contract.batchId,
            removalStage: "stage-4",
            bridges: [
              {
                wrapperPath: contract.wrapperPath,
                targetModule: contract.targetModule,
                outputPath: contract.outputPath,
                legacyConsumers: contract.legacyConsumers,
                globalProviders: [
                  {
                    symbol: "ExactSymbol",
                    mechanism: "global-this-property",
                    availability: "program-init",
                  },
                ],
              },
            ],
          },
        },
      ],
    };
    const bridges = contract.legacyConsumers.map((source) => {
      const record = {
        bridge: contract.wrapperPath,
        owner: contract.batchId,
        source,
        target: contract.targetModule,
        reason: "Keep one reviewed classic consumer synchronous during migration.",
        introducedStage: "stage-2",
        removalStage: "stage-4",
        globalProviders: [
          { symbol: "ExactSymbol", mechanism: "global-this-property" },
        ],
      };
      return { id: CanonicalBridgeIdentity.id(record), ...record };
    }).sort((left, right) => left.id.localeCompare(right.id));
    const manifest = {
      modules: [
        {
          currentPath: "src/legacy_exact_symbol.js",
          architecture: {
            targetPath: contract.targetModule,
            targetBoundary: "engine",
            roles: ["runtime-service"],
            migrationStatus: "migrating",
          },
          observed: { environment: { browserApis: [] } },
        },
      ],
    };

    project.writeJson("architecture/module_architecture.json", this.policyDefinition);
    project.writeJson("architecture/migration/stage_2_execution_state.json", state);
    project.writeJson("architecture/migration/stage_2_approved_batches.json", approvedPlan);
    project.writeJson("architecture/guards/migration_bridge_registry.json", {
      schemaVersion: 1,
      kind: "cyber-fishing-migration-bridges",
      bridges,
    });
    project.writeJson("architecture/migration/module_migration_manifest.json", manifest);
    project.write("index.html", "<!doctype html><script src=\"classic.js\"></script>\n");
    project.write(
      contract.wrapperPath,
      'import { ExactSymbol } from "../../exact_symbol.js";\n\n' +
        "globalThis.ExactSymbol = ExactSymbol;\n",
    );
    project.write(
      contract.targetModule,
      targetSource ||
        "export class ExactSymbol {\n" +
          "  static label() { return \"ExactSymbol\"; }\n" +
          "}\n",
    );
    return { project, contract, state, approvedPlan, bridges, manifest };
  }

  #contract(legacyConsumers) {
    return {
      batchId: "stage-2.1-synthetic",
      wrapperPath: "src/engine/compat/stage_2/exact_symbol_bridge.js",
      targetModule: "src/engine/exact_symbol.js",
      outputPath: "dist/legacy-bridges/exact_symbol.iife.js",
      legacyConsumers,
      globalProviders: [
        { symbol: "ExactSymbol", mechanism: "global-this-property" },
      ],
      removalStage: "stage-4",
    };
  }
}

class StageTwoLegacyBridgeBuildCheck {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.policyDefinition = JSON.parse(
      fs.readFileSync(
        path.join(projectRoot, "architecture/module_architecture.json"),
        "utf8",
      ),
    );
    this.factory = new SyntheticBridgeProjectFactory(this.policyDefinition);
  }

  async run() {
    this.#verifyCanonicalIdentity();
    this.#verifyRegistrySetEquality();
    this.#verifyWrapperContract();
    this.#verifyRecursiveClosure();
    await this.#verifyEmptyRegistryAvoidsVite();
    const hashes = await this.#verifyDeterministicBuildAcrossRoots();
    await this.#verifyUnknownVirtualRejected();
    await this.#verifyPreviousOutputSurvivesFailure();
    this.#verifyOutputSafety();
    await this.#verifyFailBeforeListen();

    console.log(
      "Stage 2 legacy bridge build passed: canonical registry, exact wrapper, " +
        `recursive closure, deterministic IIFE ${hashes[0]}, atomic output and ` +
        "fail-before-listen verified.",
    );
  }

  #verifyCanonicalIdentity() {
    const identity = {
      bridge: "src/engine/compat/stage_2/example.js",
      owner: "stage-2.1-example",
      source: "src/legacy/example.js",
      target: "src/engine/example.js",
    };
    const canonical = CanonicalBridgeIdentity.serialize(identity);
    assert.equal(
      canonical,
      '{"bridge":"src/engine/compat/stage_2/example.js","owner":"stage-2.1-example","source":"src/legacy/example.js","target":"src/engine/example.js"}',
    );
    assert.match(CanonicalBridgeIdentity.id(identity), /^bridge-[a-f0-9]{12}$/);
    for (const invalid of [
      "src\\engine\\example.js",
      "src/engine/../example.js",
      "src/engine/*.js",
      "./src/engine/example.js",
    ]) {
      assert.throws(
        () => CanonicalBridgeIdentity.normalizePath(invalid),
        /canonical|wildcards|dot segments|backslashes/,
      );
    }
  }

  #verifyRegistrySetEquality() {
    const fixture = this.factory.create("registry", {
      consumers: ["src/consumer_a.js", "src/consumer_b.js"],
    });
    try {
      const resolver = new ActiveBridgePlanResolver();
      const base = {
        state: fixture.state,
        approvedPlan: fixture.approvedPlan,
        bridgeRegistry: { bridges: fixture.bridges },
        runtimeFacts: { moduleScriptCount: 0 },
      };
      assert.equal(resolver.resolve(base).plans.length, 1);
      assert.throws(
        () => resolver.resolve({
          ...base,
          bridgeRegistry: { bridges: fixture.bridges.slice(1) },
        }),
        /consumer set mismatch/,
      );
      const extra = this.#clone(fixture.bridges[0]);
      extra.source = "src/consumer_extra.js";
      extra.id = CanonicalBridgeIdentity.id(extra);
      assert.throws(
        () => resolver.resolve({
          ...base,
          bridgeRegistry: {
            bridges: [...fixture.bridges, extra].sort((a, b) =>
              a.id.localeCompare(b.id)),
          },
        }),
        /consumer set mismatch/,
      );
      assert.throws(
        () => resolver.resolve({
          ...base,
          bridgeRegistry: {
            bridges: [...fixture.bridges, this.#clone(fixture.bridges[0])]
              .sort((a, b) => a.id.localeCompare(b.id)),
          },
        }),
        /ids must be unique/,
      );
      const wrongId = this.#clone(fixture.bridges);
      wrongId[0].id = "bridge-000000000000";
      wrongId.sort((a, b) => a.id.localeCompare(b.id));
      assert.throws(
        () => resolver.resolve({
          ...base,
          bridgeRegistry: { bridges: wrongId },
        }),
        /Non-canonical bridge id/,
      );
    } finally {
      fixture.project.dispose();
    }
  }

  #verifyWrapperContract() {
    const fixture = this.factory.create("wrapper");
    try {
      const validator = new BridgeWrapperContractValidator(fixture.project.root);
      const result = validator.validate(fixture.contract);
      assert.deepEqual(result.symbols, ["ExactSymbol"]);
      fixture.project.write(
        fixture.contract.wrapperPath,
        'import { ExactSymbol } from "../../exact_symbol.js";\n' +
          "register(ExactSymbol);\n" +
          "globalThis.ExactSymbol = ExactSymbol;\n",
      );
      assert.throws(
        () => validator.validate(fixture.contract),
        /only contain exact global assignments/,
      );
    } finally {
      fixture.project.dispose();
    }
  }

  #verifyRecursiveClosure() {
    const completed = this.factory.create("completed", {
      targetSource:
        'import { ApprovedHelper } from "./approved_helper.js";\n' +
        "export class ExactSymbol extends ApprovedHelper {}\n",
    });
    try {
      completed.project.write(
        "src/engine/approved_helper.js",
        "export class ApprovedHelper {}\n",
      );
      completed.approvedPlan.batches.unshift({
        id: "stage-2.0-approved-helper",
        targetBoundary: "engine",
        modules: [
          {
            currentPath: "src/legacy_approved_helper.js",
            targetPath: "src/engine/approved_helper.js",
          },
        ],
        bridgeStrategy: { bridges: [] },
      });
      completed.state.completedBatchIds = ["stage-2.0-approved-helper"];
      completed.manifest.modules.push({
        currentPath: "src/legacy_approved_helper.js",
        architecture: {
          targetPath: "src/engine/approved_helper.js",
          targetBoundary: "engine",
          roles: ["runtime-service"],
          migrationStatus: "esm",
        },
        observed: { environment: { browserApis: [] } },
      });
      assert.deepEqual(
        this.#closureValidator(completed).validate(completed.contract).bundledModules,
        [
          "src/engine/approved_helper.js",
          "src/engine/compat/stage_2/exact_symbol_bridge.js",
          "src/engine/exact_symbol.js",
        ],
      );
    } finally {
      completed.project.dispose();
    }

    const future = this.factory.create("future", {
      targetSource: 'import { Future } from "./future.js";\nexport class ExactSymbol extends Future {}\n',
    });
    try {
      future.project.write(
        "src/engine/future.js",
        "export class Future {}\n",
      );
      const validator = this.#closureValidator(future);
      assert.throws(
        () => validator.validate(future.contract),
        /unapproved module: src\/engine\/future\.js/,
      );
    } finally {
      future.project.dispose();
    }

    const external = this.factory.create("external", {
      targetSource: 'import value from "future-package";\nexport class ExactSymbol {}\n',
    });
    try {
      assert.throws(
        () => this.#closureValidator(external).validate(external.contract),
        /not a confirmed project module/,
      );
    } finally {
      external.project.dispose();
    }

    const browser = this.factory.create("browser");
    try {
      browser.manifest.modules[0].observed.environment.browserApis = ["document"];
      const validator = new ApprovedDependencyClosureValidator({
        projectRoot: browser.project.root,
        approvedPlan: browser.approvedPlan,
        state: browser.state,
        architecturePolicy: new ArchitecturePolicy(this.policyDefinition),
        manifest: browser.manifest,
      });
      assert.throws(
        () => validator.validate(browser.contract),
        /forbidden browser capability/,
      );
    } finally {
      browser.project.dispose();
    }

    const conventionCases = [
      {
        label: "default-export",
        source:
          "export class ExactSymbol {}\nexport default ExactSymbol;\n",
        expected: /forbidden default export/,
      },
      {
        label: "side-effect",
        source:
          'import "./side_effect.js";\nexport class ExactSymbol {}\n',
        expected: /forbidden side-effect import/,
      },
      {
        label: "esm-global",
        source:
          "globalThis.Unapproved = 1;\nexport class ExactSymbol {}\n",
        expected: /exports through a global/,
      },
      {
        label: "legacy-global-read",
        source:
          "LegacyRuntime.start();\nexport class ExactSymbol {}\n",
        expected: /consumes unresolved global LegacyRuntime/,
      },
      {
        label: "dynamic-import",
        source:
          'const name = "future";\nimport(name);\nexport class ExactSymbol {}\n',
        expected: /observation is not verified/,
      },
    ];
    for (const item of conventionCases) {
      const fixture = this.factory.create(item.label, {
        targetSource: item.source,
      });
      try {
        if (item.label === "side-effect") {
          fixture.project.write("src/engine/side_effect.js", "export const ok = true;\n");
        }
        assert.throws(
          () => this.#closureValidator(fixture).validate(fixture.contract),
          item.expected,
        );
      } finally {
        fixture.project.dispose();
      }
    }
  }

  async #verifyEmptyRegistryAvoidsVite() {
    const fixture = this.factory.create("empty");
    try {
      fixture.state.status = "foundation-verified";
      fixture.state.activeBatchId = null;
      fixture.state.esmRuntimeIntegrationStarted = false;
      fixture.project.writeJson(
        "architecture/migration/stage_2_execution_state.json",
        fixture.state,
      );
      fixture.project.writeJson(
        "architecture/guards/migration_bridge_registry.json",
        {
          schemaVersion: 1,
          kind: "cyber-fishing-migration-bridges",
          bridges: [],
        },
      );
      let viteLoaded = false;
      const report = await new LegacyBridgeBuildApplication({
        projectRoot: fixture.project.root,
        viteLoader: async () => {
          viteLoaded = true;
          throw new Error("Vite must not load for an empty registry");
        },
      }).run();
      assert.equal(report.status, "no-active-bridges");
      assert.equal(report.bridgeCount, 0);
      assert.equal(viteLoaded, false);
      assert.equal(fixture.project.exists("dist/legacy-bridges"), false);
    } finally {
      fixture.project.dispose();
    }
  }

  async #verifyDeterministicBuildAcrossRoots() {
    const fixtures = [this.factory.create("root-a"), this.factory.create("root-b")];
    try {
      const reports = [];
      for (const fixture of fixtures) {
        reports.push(await new LegacyBridgeBuildApplication({
          projectRoot: fixture.project.root,
        }).run());
      }
      for (const report of reports) {
        assert.equal(report.status, "built");
        assert.equal(report.bridgeCount, 1);
        assert.deepEqual(report.outputs[0].bundledModules, [
          "src/engine/compat/stage_2/exact_symbol_bridge.js",
          "src/engine/exact_symbol.js",
        ]);
      }
      assert.equal(reports[0].outputs[0].sha256, reports[1].outputs[0].sha256);
      const output = fixtures[0].project.read(
        "dist/legacy-bridges/exact_symbol.iife.js",
      );
      assert.doesNotMatch(output, /\b(?:import|export)\b/);
      const context = { globalThis: null };
      context.globalThis = context;
      vm.runInNewContext(output, context);
      assert.equal(context.ExactSymbol.name, "ExactSymbol");
      assert.equal(context.ExactSymbol.label(), "ExactSymbol");
      assert.throws(
        () => new LegacyBridgeBundleValidator().validate({
          code:
            "globalThis.ExactSymbol = class ExactSymbol {};\n" +
            "globalThis.Unapproved = 1;\n",
          plan: fixtures[0].contract,
          actualModules: reports[0].outputs[0].bundledModules,
          approvedModules: reports[0].outputs[0].bundledModules,
        }),
        /globals differ from approved providers/,
      );
      return reports.map((report) => report.outputs[0].sha256);
    } finally {
      fixtures.forEach((fixture) => fixture.project.dispose());
    }
  }

  async #verifyUnknownVirtualRejected() {
    const fixture = this.factory.create("virtual");
    try {
      await assert.rejects(
        () => new LegacyBridgeBuildApplication({
          projectRoot: fixture.project.root,
          viteLoader: async () => ({
            build: async (configuration) => {
              const outputName = "exact_symbol.iife.js";
              fs.writeFileSync(
                path.join(configuration.build.outDir, outputName),
                "globalThis.ExactSymbol = class ExactSymbol {};\n",
              );
              return {
                output: [
                  {
                    type: "chunk",
                    fileName: outputName,
                    modules: {
                      "\u0000synthetic-virtual": {},
                    },
                  },
                ],
              };
            },
          }),
        }).run(),
        /unapproved virtual module/,
      );
      assert.equal(fixture.project.exists("dist/legacy-bridges"), false);
    } finally {
      fixture.project.dispose();
    }
  }

  async #verifyPreviousOutputSurvivesFailure() {
    const fixture = this.factory.create("retain");
    try {
      fixture.project.write(
        "dist/legacy-bridges/previous.iife.js",
        "/* validated previous output */\n",
      );
      const before = fixture.project.read("dist/legacy-bridges/previous.iife.js");
      await assert.rejects(
        () => new LegacyBridgeBuildApplication({
          projectRoot: fixture.project.root,
          viteLoader: async () => ({
            build: async () => {
              throw new Error("synthetic build failure");
            },
          }),
        }).run(),
        /synthetic build failure/,
      );
      assert.equal(
        fixture.project.read("dist/legacy-bridges/previous.iife.js"),
        before,
      );
      const distEntries = fs.readdirSync(path.join(fixture.project.root, "dist"));
      assert.deepEqual(distEntries, ["legacy-bridges"]);
    } finally {
      fixture.project.dispose();
    }
  }

  #verifyOutputSafety() {
    const fixture = this.factory.create("safety");
    try {
      const manager = new LegacyBridgeOutputManager(fixture.project.root);
      assert.throws(
        () => manager.discard(fixture.project.root),
        /unsafe legacy bridge staging operation/,
      );
      assert.equal(fixture.project.exists("architecture"), true);
    } finally {
      fixture.project.dispose();
    }
  }

  async #verifyFailBeforeListen() {
    let listenCount = 0;
    let onCount = 0;
    const server = {
      on() { onCount += 1; },
      listen() { listenCount += 1; },
    };
    const config = {
      rootDir: this.projectRoot,
      host: "127.0.0.1",
      port: 4173,
    };
    const silentLogger = { log() {}, error() {} };
    await assert.rejects(
      () => new DevServerApplication(config, {
        bridgeBuilder: { run: async () => { throw new Error("blocked build"); } },
        server,
        logger: silentLogger,
      }).start(),
      /blocked build/,
    );
    assert.equal(onCount, 0);
    assert.equal(listenCount, 0);

    const successServer = {
      on() { onCount += 1; },
      listen(_port, _host, callback) { listenCount += 1; callback(); },
    };
    const report = await new DevServerApplication(config, {
      bridgeBuilder: {
        run: async () => ({ status: "no-active-bridges", bridgeCount: 0, outputs: [] }),
      },
      compatibilityBuilder: {
        run: async () => ({ status: "no-stage-3-state", activationCount: 0, outputs: [] }),
      },
      server: successServer,
      logger: silentLogger,
    }).start();
    assert.equal(report.status, "no-active-bridges");
    assert.equal(listenCount, 1);
  }

  #closureValidator(fixture) {
    return new ApprovedDependencyClosureValidator({
      projectRoot: fixture.project.root,
      approvedPlan: fixture.approvedPlan,
      state: fixture.state,
      architecturePolicy: new ArchitecturePolicy(this.policyDefinition),
      manifest: fixture.manifest,
    });
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

new StageTwoLegacyBridgeBuildCheck(PROJECT_ROOT).run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
