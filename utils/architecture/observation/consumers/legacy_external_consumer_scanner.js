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
  ConsumerExecutionPhaseResolver,
} = require("./consumer_execution_phase_resolver");
const {
  ConsumerAccessRequirementResolver,
} = require("./consumer_access_requirement_resolver");
const {
  MemberReadClassifier,
} = require("./member_read_classifier");
const {
  ExternalIdentifierCandidateDetector,
} = require("./external_identifier_candidate_detector");
const {
  StaticGlobalPropertyCandidateDetector,
} = require("./static_global_property_candidate_detector");
const {
  UnsupportedConsumerConstructDetector,
} = require("./unsupported_consumer_construct_detector");
const {
  ConsumerEnvironmentClassifier,
} = require("./consumer_environment_classifier");
const {
  ConsumerObservationAssembler,
} = require("./consumer_observation_assembler");

class LegacyExternalConsumerScanner {
  constructor({
    parser,
    scopeAnalyzer,
    contextIndexFactory,
    detectorFactory,
    assembler,
  }) {
    this.parser = parser;
    this.scopeAnalyzer = scopeAnalyzer;
    this.contextIndexFactory = contextIndexFactory;
    this.detectorFactory = detectorFactory;
    this.assembler = assembler;
  }

  scan({ currentPath, source }) {
    const parsed = this.parser.parse(source);
    if (parsed.status === "failed") {
      return this.assembler.failed(currentPath, parsed.issue);
    }
    try {
      const scopeAnalysis = this.scopeAnalyzer.analyze(
        parsed.syntaxTree,
        parsed.sourceType,
      );
      const contextIndex = this.contextIndexFactory(parsed.syntaxTree);
      const observations = this.detectorFactory(contextIndex).map((detector) =>
        detector.detect(parsed.syntaxTree, scopeAnalysis)
      );
      return this.assembler.assemble(currentPath, observations);
    } catch {
      return this.assembler.failed(currentPath, {
        code: "analysis-failure",
        message: "Consumer analysis could not produce trustworthy results.",
      });
    }
  }
}

class LegacyExternalConsumerScannerFactory {
  create(observationContract) {
    const environment = observationContract.environmentModel;
    return new LegacyExternalConsumerScanner({
      parser: new LegacySourceParser(),
      scopeAnalyzer: new EslintScopeAnalyzer(),
      contextIndexFactory: (syntaxTree) => new AstNodeContextIndex(syntaxTree),
      detectorFactory: (contextIndex) => {
        const assignmentTargetReader = new AssignmentTargetReader();
        const executionPhaseResolver =
          new ConsumerExecutionPhaseResolver(contextIndex);
        const accessRequirementResolver =
          new ConsumerAccessRequirementResolver(contextIndex);
        return [
          new ExternalIdentifierCandidateDetector({
            contextIndex,
            accessRequirementResolver,
            executionPhaseResolver,
          }),
          new StaticGlobalPropertyCandidateDetector({
            contextIndex,
            memberReadClassifier: new MemberReadClassifier({
              assignmentTargetReader,
              contextIndex,
            }),
            accessRequirementResolver,
            executionPhaseResolver,
          }),
          new UnsupportedConsumerConstructDetector(),
        ];
      },
      assembler: new ConsumerObservationAssembler(
        new ConsumerEnvironmentClassifier({
          builtins: environment.builtins,
          browserApis: environment.browserApis,
        }),
      ),
    });
  }
}

module.exports = {
  LegacyExternalConsumerScanner,
  LegacyExternalConsumerScannerFactory,
};
