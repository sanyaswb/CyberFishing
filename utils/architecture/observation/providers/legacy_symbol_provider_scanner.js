const {
  LegacySourceParser,
} = require("../parsing/legacy_source_parser");
const {
  EslintScopeAnalyzer,
} = require("../scope/eslint_scope_analysis");
const {
  AstNodeContextIndex,
} = require("../scope/ast_node_context_index");
const {
  AssignmentTargetReader,
} = require("../shared/assignment_target_reader");
const {
  ProviderAvailabilityResolver,
} = require("./provider_availability_resolver");
const {
  GlobalScopeProviderDetector,
} = require("./global_scope_provider_detector");
const {
  GlobalPropertyProviderDetector,
} = require("./global_property_provider_detector");
const {
  ImplicitGlobalProviderDetector,
} = require("./implicit_global_provider_detector");
const {
  UnsupportedProviderConstructDetector,
} = require("./unsupported_provider_construct_detector");
const {
  ProviderObservationAssembler,
} = require("./provider_observation_assembler");

class LegacySymbolProviderScanner {
  constructor({
    parser,
    scopeAnalyzer,
    contextIndexFactory,
    availabilityResolverFactory,
    detectorFactory,
    assembler,
  }) {
    this.parser = parser;
    this.scopeAnalyzer = scopeAnalyzer;
    this.contextIndexFactory = contextIndexFactory;
    this.availabilityResolverFactory = availabilityResolverFactory;
    this.detectorFactory = detectorFactory;
    this.assembler = assembler;
  }

  scan({ currentPath, source }) {
    const parsed = this.parser.parse(source);
    if (parsed.status === "failed") {
      return this.assembler.failed(currentPath, parsed.issue);
    }

    try {
      const scopeAnalysis = this.scopeAnalyzer.analyze(parsed.syntaxTree);
      const contextIndex = this.contextIndexFactory(parsed.syntaxTree);
      const availabilityResolver = this.availabilityResolverFactory(contextIndex);
      const detectors = this.detectorFactory({
        contextIndex,
        availabilityResolver,
      });
      const observations = detectors.map((detector) =>
        detector.detect(parsed.syntaxTree, scopeAnalysis)
      );
      return this.assembler.assemble(currentPath, observations);
    } catch {
      return this.assembler.failed(currentPath, {
        code: "analysis-failure",
        message: "Provider analysis could not produce trustworthy results.",
      });
    }
  }
}

class LegacySymbolProviderScannerFactory {
  create(observationContract) {
    const environmentModel = observationContract.environmentModel;
    const assignmentTargetReader = new AssignmentTargetReader();
    return new LegacySymbolProviderScanner({
      parser: new LegacySourceParser(),
      scopeAnalyzer: new EslintScopeAnalyzer(),
      contextIndexFactory: (syntaxTree) => new AstNodeContextIndex(syntaxTree),
      availabilityResolverFactory: (contextIndex) =>
        new ProviderAvailabilityResolver(contextIndex),
      detectorFactory: ({ contextIndex, availabilityResolver }) => [
        new GlobalScopeProviderDetector(),
        new GlobalPropertyProviderDetector({
          assignmentTargetReader,
          availabilityResolver,
          contextIndex,
        }),
        new ImplicitGlobalProviderDetector({
          assignmentTargetReader,
          availabilityResolver,
          contextIndex,
          environmentSymbols: [
            ...environmentModel.builtins,
            ...environmentModel.browserApis,
          ],
        }),
        new UnsupportedProviderConstructDetector({ contextIndex }),
      ],
      assembler: new ProviderObservationAssembler(),
    });
  }
}

module.exports = {
  LegacySymbolProviderScanner,
  LegacySymbolProviderScannerFactory,
};
