const assert = require("node:assert/strict");
const path = require("node:path");
const { ArchitecturePolicy } = require("./core/architecture_policy");
const {
  CanonicalModulePath,
} = require("./migration/canonical_module_path");
const {
  CurrentAreaResolver,
} = require("./migration/current_area_resolver");
const {
  LegacyScriptOrderReader,
} = require("./migration/legacy_script_order_reader");
const {
  MigrationManifestRepository,
} = require("./migration/migration_manifest_repository");
const {
  createMigrationManifestValidator,
} = require("./migration/migration_manifest_validator");
const {
  SourceFileScanner,
} = require("./migration/source_file_scanner");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const SOURCE_ROOT = path.join(PROJECT_ROOT, "src");
const POLICY_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "module_architecture.json",
);
const MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "migration",
  "module_migration_manifest.json",
);

class MigrationManifestValidatorCheck {
  constructor({ validator, context }) {
    this.validator = validator;
    this.context = context;
  }

  run() {
    this.validator.validate(this.context);
    this.#expectFailure(
      "Unsupported migration manifest schemaVersion",
      (context) => {
        context.manifest.schemaVersion += 1;
      },
    );
    this.#expectFailure("Untracked source module", (context) => {
      context.manifest.modules.pop();
    });
    this.#expectFailure("Stale migration manifest entry", (context) => {
      const stale = this.#clone(context.manifest.modules[0]);
      stale.currentPath = "src/stale_manifest_fixture.js";
      stale.currentArea = "root";
      stale.observed.legacyLoadOrder = null;
      context.manifest.modules.push(stale);
    });
    this.#expectFailure("Duplicate migration manifest entry", (context) => {
      context.manifest.modules.splice(
        1,
        0,
        this.#clone(context.manifest.modules[0]),
      );
    });
    this.#expectFailure("Non-canonical currentPath", (context) => {
      context.manifest.modules[0].currentPath =
        context.manifest.modules[0].currentPath.replaceAll("/", "\\");
    });
    this.#expectFailure("has invalid migrationStatus", (context) => {
      context.manifest.modules[0].architecture.migrationStatus = "almost-ready";
    });
    this.#expectFailure("has invalid module role", (context) => {
      context.manifest.modules[0].architecture.roles = ["guessed-role"];
    });
    this.#expectFailure("has invalid targetBoundary", (context) => {
      context.manifest.modules[0].architecture.targetBoundary = "unknown";
    });
    this.#expectFailure("targetPath requires targetBoundary", (context) => {
      context.manifest.modules[0].architecture.targetBoundary = null;
      context.manifest.modules[0].architecture.targetPath =
        "src/engine/fixture.js";
    });
    this.#expectClassifiedFailure("requires targetPath", (context) => {
      context.manifest.modules[0].architecture.targetPath = null;
    });
    this.#expectClassifiedFailure("requires at least one reviewed role", (context) => {
      context.manifest.modules[0].architecture.roles = [];
    });
    this.#expectClassifiedFailure("requires reviewed blockers", (context) => {
      context.manifest.modules[0].analysis.blockers.status = "pending";
    });
    this.#expectClassifiedFailure(
      "does not allow targetBoundary platform",
      (context) => {
        context.manifest.modules[0].architecture.migrationWave = 1;
      },
    );
    this.#expectClassifiedFailure("architecture.roles must be sorted", (context) => {
      context.manifest.modules[0].architecture.roles = [
        "platform-adapter",
        "engine-utility",
      ];
    });
    this.#expectClassifiedFailure(
      "is not allowed by targetBoundary platform",
      (context) => {
        context.manifest.modules[0].architecture.roles = ["engine-utility"];
      },
    );
    this.#expectClassifiedFailure("has unknown blocker", (context) => {
      context.manifest.modules[0].analysis.blockers.items = ["write-it-later"];
    });
    this.#expectFailure("status pending must not assert results", (context) => {
      context.manifest.modules[0].analysis.dependencies = {
        status: "pending",
        confirmed: [],
        items: [
          {
            target: context.manifest.modules[1].currentPath,
            symbols: ["Fixture"],
            resolution: "confirmed",
          },
        ],
        unresolved: [],
        ambiguous: [],
        issues: [],
      };
    });
    this.#expectFailure("provider has invalid mechanism", (context) => {
      context.manifest.modules[0].observed.providers = {
        status: "verified",
        items: [
          {
            symbol: "Fixture",
            mechanism: "filename-guess",
            availability: "program-init",
          },
        ],
        issues: [],
      };
    });
    this.#expectFailure("provider has invalid availability", (context) => {
      context.manifest.modules[0].observed.providers = {
        status: "verified",
        items: [
          {
            symbol: "Fixture",
            mechanism: "global-lexical",
            availability: "eventually",
          },
        ],
        issues: [],
      };
    });
    this.#expectFailure("status partial requires at least one issue", (context) => {
      context.manifest.modules[0].observed.consumers.status = "partial";
    });
    this.#expectFailure("consumer has invalid executionPhase", (context) => {
      context.manifest.modules[0].observed.consumers = {
        status: "verified",
        items: [
          {
            symbol: "Fixture",
            mechanism: "identifier",
            accessRequirement: "required",
            executionPhase: "eventually",
          },
        ],
        issues: [],
      };
    });
    this.#expectFailure("has invalid status: maybe", (context) => {
      context.manifest.modules[0].analysis.dependencies.status = "maybe";
    });
    this.#expectFailure("dynamic constructs require partial", (context) => {
      const environment = context.manifest.modules[0].observed.environment;
      environment.status = "verified";
      environment.dynamicConstructs = ["eval-call"];
    });
    this.#expectFailure("ambiguous symbol requires at least 2 candidates", (context) => {
      const entry = context.manifest.modules[0];
      const consumer = this.#consumer("AmbiguousFixture", "guarded");
      entry.observed.consumers = {
        status: "verified",
        items: [consumer],
        issues: [],
      };
      entry.analysis.dependencies = {
        status: "verified",
        confirmed: [],
        items: [],
        unresolved: [],
        ambiguous: [
          {
            ...consumer,
            resolution: "ambiguous",
            candidates: [context.manifest.modules[1].currentPath],
          },
        ],
        issues: [],
      };
    });
    this.#expectFailure("dependency edge resolution must be confirmed", (context) => {
      const entry = context.manifest.modules[0];
      const consumer = this.#consumer("UnconfirmedEdgeFixture", "required");
      entry.observed.consumers = {
        status: "verified",
        items: [consumer],
        issues: [],
      };
      entry.analysis.dependencies = {
        status: "verified",
        confirmed: [],
        items: [
          {
            target: context.manifest.modules[1].currentPath,
            symbols: [consumer.symbol],
            resolution: "unresolved",
          },
        ],
        unresolved: [],
        ambiguous: [],
        issues: [],
      };
    });
    this.#expectFailure("invalid confirmed dependency target", (context) => {
      const entry = context.manifest.modules[0];
      const consumer = this.#consumer("SelfEdgeFixture", "required");
      entry.observed.consumers = {
        status: "verified",
        items: [consumer],
        issues: [],
      };
      entry.analysis.dependencies = {
        status: "verified",
        confirmed: [{
          ...consumer,
          target: entry.currentPath,
          resolution: "confirmed",
        }],
        items: [
          {
            target: entry.currentPath,
            symbols: [consumer.symbol],
            resolution: "confirmed",
          },
        ],
        unresolved: [],
        ambiguous: [],
        issues: [],
      };
    });
    this.#expectFailure(
      "consumer observation has more than one resolution result",
      (context) => {
        const entry = context.manifest.modules[0];
        const consumer = this.#consumer("DuplicateResolutionFixture", "guarded");
        entry.observed.consumers = {
          status: "verified",
          items: [consumer],
          issues: [],
        };
        entry.analysis.dependencies = {
          status: "verified",
          confirmed: [],
          items: [],
          unresolved: [{ ...consumer, resolution: "unresolved" }],
          ambiguous: [
            {
              ...consumer,
              resolution: "ambiguous",
              candidates: [
                context.manifest.modules[1].currentPath,
                context.manifest.modules[2].currentPath,
              ].sort(),
            },
          ],
          issues: [],
        };
      },
    );
    this.#expectFailure("reverse consumers are derived-only", (context) => {
      context.manifest.modules[0].analysis.reverseConsumers = [];
    });
    this.#expectFailure("fields must be exactly", (context) => {
      context.manifest.modules[0].observed.providers.line = 12;
    });
    this.#expectFailure("legacyLoadOrder mismatch", (context) => {
      context.manifest.modules[0].observed.legacyLoadOrder = 999999;
    });
    this.#expectFailure(
      "Legacy runtime script outside migration manifest scope",
      (context) => {
        context.legacyScripts.push({
          source: "vendor/runtime.js",
          currentPath: "vendor/runtime.js",
          type: "classic",
          legacyLoadOrder: context.legacyScripts.length + 1,
        });
      },
    );
    this.#expectFailure("observed consumer has no resolution result", (context) => {
      const entry = context.manifest.modules[0];
      entry.observed.consumers = {
        status: "verified",
        items: [this.#consumer("MissingResolutionFixture", "required")],
        issues: [],
      };
      entry.analysis.dependencies = {
        status: "verified",
        confirmed: [],
        items: [],
        unresolved: [],
        ambiguous: [],
        issues: [],
      };
    });
    this.#expectFailure(
      "confirmed inter-file resolution is missing a dependency edge",
      (context) => {
        const entry = context.manifest.modules[0];
        const consumer = this.#consumer("MissingEdgeFixture", "required");
        entry.observed.consumers = {
          status: "verified",
          items: [consumer],
          issues: [],
        };
        entry.analysis.dependencies = {
          status: "verified",
          confirmed: [{
            ...consumer,
            target: context.manifest.modules[1].currentPath,
            resolution: "confirmed",
          }],
          items: [],
          unresolved: [],
          ambiguous: [],
          issues: [],
        };
      },
    );
    this.#assertConfirmedDependencyProvenanceIsValid();
    this.#assertSelfResolutionWithoutEdgeIsValid();
    this.#assertMixedOutcomesForOneSymbolAreValid();
    this.#assertConsumerObservationResolutionKeysAreIndependent();
    this.#assertVerifiedProvidersAreValid();
    this.#assertVerifiedEmptyAndLegacyNullAreValid();
    this.#assertReviewedClassificationIsValid();
  }

  #expectFailure(expectedMessage, mutate) {
    const context = this.#copyContext();
    mutate(context);
    assert.throws(
      () => this.validator.validate(context),
      (error) => error.message.includes(expectedMessage),
      `Expected validator failure containing: ${expectedMessage}`,
    );
  }

  #expectClassifiedFailure(expectedMessage, mutate) {
    const context = this.#copyContext();
    this.#classify(context.manifest.modules[0]);
    mutate(context);
    assert.throws(
      () => this.validator.validate(context),
      (error) => error.message.includes(expectedMessage),
      `Expected classified validator failure containing: ${expectedMessage}`,
    );
  }

  #assertReviewedClassificationIsValid() {
    const context = this.#copyContext();
    this.#classify(context.manifest.modules[0]);
    this.validator.validate(context);
  }

  #classify(entry) {
    entry.architecture = {
      migrationStatus: "classified",
      roles: ["platform-adapter"],
      targetBoundary: "platform",
      targetPath: "src/platform/browser/adapters.js",
      migrationWave: 5,
    };
    entry.analysis.blockers = { status: "verified", items: [] };
  }

  #assertVerifiedEmptyAndLegacyNullAreValid() {
    const context = this.#copyContext();
    const entry = this.#clone(context.manifest.modules[0]);
    entry.currentPath = "src/future/not_in_legacy_graph.js";
    entry.currentArea = "future";
    entry.observed.legacyLoadOrder = null;
    entry.observed.providers = {
      status: "verified",
      items: [],
      issues: [],
    };
    entry.observed.consumers = {
      status: "verified",
      items: [],
      issues: [],
    };
    entry.observed.environment = {
      status: "verified",
      builtins: [],
      browserApis: [],
      dynamicConstructs: [],
      issues: [],
    };
    entry.analysis.dependencies = {
      status: "verified",
      confirmed: [],
      items: [],
      unresolved: [],
      ambiguous: [],
      issues: [],
    };
    entry.analysis.blockers = { status: "verified", items: [] };
    context.manifest.modules.push(entry);
    context.manifest.modules.sort((left, right) =>
      left.currentPath < right.currentPath ? -1 : 1,
    );
    context.sourceFiles.push({ currentPath: entry.currentPath });
    context.sourceFiles.sort((left, right) =>
      left.currentPath < right.currentPath ? -1 : 1,
    );
    this.validator.validate(context);
  }

  #assertConfirmedDependencyProvenanceIsValid() {
    const context = this.#copyContext();
    const entry = context.manifest.modules[0];
    const target = context.manifest.modules[1].currentPath;
    entry.observed.consumers = {
      status: "verified",
      items: [this.#consumer("ConfirmedFixture", "required")],
      issues: [],
    };
    entry.analysis.dependencies = {
      status: "verified",
      confirmed: [
        {
          ...this.#consumer("ConfirmedFixture", "required"),
          target,
          resolution: "confirmed",
        },
      ],
      items: [
        {
          target,
          symbols: ["ConfirmedFixture"],
          resolution: "confirmed",
        },
      ],
      unresolved: [],
      ambiguous: [],
      issues: [],
    };
    this.validator.validate(context);
  }

  #assertSelfResolutionWithoutEdgeIsValid() {
    const context = this.#copyContext();
    const entry = context.manifest.modules[0];
    const consumer = this.#consumer("SelfResolutionFixture", "guarded");
    entry.observed.consumers = {
      status: "verified",
      items: [consumer],
      issues: [],
    };
    entry.analysis.dependencies = {
      status: "verified",
      confirmed: [{
        ...consumer,
        target: entry.currentPath,
        resolution: "confirmed",
      }],
      items: [],
      unresolved: [],
      ambiguous: [],
      issues: [],
    };
    this.validator.validate(context);
  }

  #assertMixedOutcomesForOneSymbolAreValid() {
    const context = this.#copyContext();
    const entry = context.manifest.modules[0];
    const target = context.manifest.modules[1].currentPath;
    const confirmed = this.#consumer(
      "MixedOutcomeFixture",
      "required",
      "deferred",
    );
    const unresolved = {
      ...this.#consumer("MixedOutcomeFixture", "guarded", "eager"),
      mechanism: "window-property",
    };
    entry.observed.consumers = {
      status: "verified",
      items: [confirmed, unresolved],
      issues: [],
    };
    entry.analysis.dependencies = {
      status: "verified",
      confirmed: [{
        ...confirmed,
        target,
        resolution: "confirmed",
      }],
      items: [{
        target,
        symbols: [confirmed.symbol],
        resolution: "confirmed",
      }],
      unresolved: [{ ...unresolved, resolution: "unresolved" }],
      ambiguous: [],
      issues: [],
    };
    this.validator.validate(context);
  }

  #assertConsumerObservationResolutionKeysAreIndependent() {
    const context = this.#copyContext();
    const entry = context.manifest.modules[0];
    const eager = this.#consumer(
      "PhaseSensitiveFixture",
      "required",
      "eager",
    );
    const deferred = this.#consumer(
      "PhaseSensitiveFixture",
      "required",
      "deferred",
    );
    entry.observed.consumers = {
      status: "verified",
      items: [deferred, eager].sort((left, right) =>
        left.executionPhase < right.executionPhase ? -1 : 1,
      ),
      issues: [],
    };
    entry.analysis.dependencies = {
      status: "verified",
      confirmed: [],
      items: [],
      unresolved: [
        { ...deferred, resolution: "unresolved" },
        { ...eager, resolution: "unresolved" },
      ].sort((left, right) =>
        left.executionPhase < right.executionPhase ? -1 : 1,
      ),
      ambiguous: [],
      issues: [],
    };
    this.validator.validate(context);
  }

  #assertVerifiedProvidersAreValid() {
    const context = this.#copyContext();
    context.manifest.modules[0].observed.providers = {
      status: "verified",
      items: [
        {
          symbol: "AvailabilityFixture",
          mechanism: "window-property",
          availability: "deferred",
        },
        {
          symbol: "AvailabilityFixture",
          mechanism: "window-property",
          availability: "program-init",
        },
      ],
      issues: [],
    };
    this.validator.validate(context);
  }

  #consumer(symbol, accessRequirement, executionPhase = "deferred") {
    return {
      symbol,
      mechanism: "identifier",
      accessRequirement,
      executionPhase,
    };
  }

  #copyContext() {
    return {
      ...this.context,
      manifest: this.#clone(this.context.manifest),
      sourceFiles: this.#clone(this.context.sourceFiles),
      legacyScripts: this.#clone(this.context.legacyScripts),
    };
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

const policy = ArchitecturePolicy.load(POLICY_PATH);
const currentAreaResolver = new CurrentAreaResolver({
  rootValue: policy.migrationManifest.currentArea.rootValue,
});
new MigrationManifestValidatorCheck({
  validator: createMigrationManifestValidator(),
  context: {
    manifest: new MigrationManifestRepository(MANIFEST_PATH).read(),
    policy,
    sourceFiles: new SourceFileScanner({
      projectRoot: PROJECT_ROOT,
      sourceRoot: SOURCE_ROOT,
    }).scan(),
    legacyScripts: new LegacyScriptOrderReader(
      path.join(PROJECT_ROOT, "index.html"),
    ).read(),
    canonicalPath: new CanonicalModulePath(),
    currentAreaResolver,
  },
}).run();

console.log(
  "Migration manifest validator passed: v5 fact-level provenance, provider availability, consumer semantics, and observation statuses verified.",
);
