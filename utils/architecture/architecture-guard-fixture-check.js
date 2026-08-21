const assert = require("node:assert/strict");
const { CanonicalJson } = require("./guards/core/canonical_json");
const { GuardDiagnostic, GuardReport, UnifiedDependencyEdge } = require("./guards/core/guard_models");
const { GuardOutcomeClassifier } = require("./guards/core/guard_outcome_classifier");
const { ArchitectureGuardPolicyValidator } = require("./guards/contracts/architecture_guard_policy_validator");
const { GlobalProviderBaselineValidator, KnownDebtRegistryValidator, MigrationBridgeRegistryValidator } = require("./guards/contracts/guard_artifact_repository");
const { EsmDependencyObserver } = require("./guards/observation/esm_dependency_observer");
const { UnifiedDependencyGraphBuilder } = require("./guards/graph/unified_dependency_graph");
const { TarjanStronglyConnectedComponents } = require("./guards/graph/tarjan_scc");
const { BoundaryGuard } = require("./guards/rules/boundary_guard");
const { BrowserCapabilityGuard } = require("./guards/rules/browser_capability_guard");
const { DevLeakageGuard } = require("./guards/rules/dev_leakage_guard");
const { EsmConventionGuard } = require("./guards/rules/esm_convention_guard");
const { GlobalNamespaceGuard } = require("./guards/rules/global_namespace_guard");
const { SccCycleGuard } = require("./guards/rules/scc_cycle_guard");
const { BridgeRegistryGuard } = require("./guards/rules/bridge_registry_guard");
const { PhysicalTargetPathGuard } = require("./guards/rules/physical_target_path_guard");

const policy = require("../../architecture/module_architecture.json");
let cases = 0;
const test = (name, callback) => { callback(); cases += 1; };
const classifier = (debts = [], exceptions = []) => new GuardOutcomeClassifier({ debts, exceptions });
const moduleEntry = (currentPath, boundary, roles = ["domain-behavior"], migrationStatus = "classified") => ({ currentPath, observed: { providers: { items: [] }, environment: { browserApis: [] } }, architecture: { targetBoundary: boundary, roles, migrationStatus, targetPath: currentPath, migrationWave: 1 }, analysis: { dependencies: { items: [] }, blockers: { items: [] } } });
const snapshot = (modules, edges = [], sources = []) => ({ policy, manifest: { modules }, graph: { nodes: modules.map((item) => item.currentPath), edges }, sources, bridgeRegistry: { bridges: [] }, globalBaseline: { providers: [] }, debtRegistry: { debts: [] } });
const edge = (source, target, mechanism = "legacy-confirmed") => new UnifiedDependencyEdge({ source, target, mechanisms: [mechanism], provenance: [{ mechanism }] });

test("policy v2", () => new ArchitectureGuardPolicyValidator().validate(policy));
test("immutable records", () => { const item = new GuardDiagnostic({ status: "FAIL", rule: "x", source: "a", target: "b", location: null, message: "x", evidenceFingerprint: "f" }); assert.throws(() => { "use strict"; item.status = "PASS"; }, TypeError); });
test("deterministic report", () => { const a = { status: "FAIL", rule: "b", source: "b", target: "x", message: "b", evidenceFingerprint: "b" }; const b = { status: "FAIL", rule: "a", source: "a", target: "x", message: "a", evidenceFingerprint: "a" }; assert.deepEqual(new GuardReport([a, b]).diagnostics.map((item) => item.rule), ["a", "b"]); });
test("invalid debt schema", () => assert.throws(() => new KnownDebtRegistryValidator().validate({ schemaVersion: 1, kind: "cyber-fishing-known-debt", debts: [{ id: "bad" }] })));
test("duplicate bridge id", () => { const b = { id: "b", bridge: "x", source: "a", target: "z", reason: "r", owner: "o", introducedStage: "stage-2", removalStage: "stage-3", globalProviders: [] }; assert.throws(() => new MigrationBridgeRegistryValidator().validate({ schemaVersion: 1, kind: "cyber-fishing-migration-bridges", bridges: [b, b] })); });
test("global baseline sorted", () => assert.throws(() => new GlobalProviderBaselineValidator().validate({ schemaVersion: 1, kind: "cyber-fishing-global-provider-baseline", providers: [{ currentPath: "z", symbol: "A", mechanism: "global-lexical", availability: "program-init" }, { currentPath: "a", symbol: "A", mechanism: "global-lexical", availability: "program-init" }] })));
test("exact debt known", () => { const identity = { rule: "boundary-dependency", source: "a", target: "b" }; const debt = { id: CanonicalJson.debtId(identity.rule, identity), rule: identity.rule, source: "a", target: "b", evidenceFingerprint: CanonicalJson.fingerprint(identity), removalStage: "stage-2" }; assert.equal(classifier([debt]).classify({ ...identity, identity, location: null, message: "x" }).status, "KNOWN-DEBT"); });
test("changed debt fails", () => { const identity = { rule: "boundary-dependency", source: "a", target: "b" }; const debt = { id: "d", rule: identity.rule, source: "a", target: "b", evidenceFingerprint: CanonicalJson.fingerprint(identity), removalStage: "stage-2" }; assert.equal(classifier([debt]).classify({ rule: identity.rule, source: "a", target: "c", identity: { ...identity, target: "c" }, location: null, message: "x" }).status, "FAIL"); });
test("exact exception pass", () => { const exception = { id: "e", rule: "module-convention", currentPath: "a", subject: "default-export" }; assert.equal(classifier([], [exception]).classify({ rule: "module-convention/default-export", source: "a", target: "default-export", location: null, message: "x" }, { debtEligible: false, exceptionRule: "module-convention", exceptionSubject: "default-export" }).status, "PASS"); });

const resolver = { resolve: (_source, specifier) => specifier.startsWith(".") ? { status: "confirmed-project", target: `src/${specifier.slice(2)}` } : { status: "external-package", target: null } };
const observer = new EsmDependencyObserver({ projectRoot: process.cwd(), resolver });
test("ESM mechanisms", () => { const result = observer.observeFile("src/a.js", 'import "./setup.js"; import { B } from "./b.js"; export { C } from "./c.js"; import("./d.js");'); assert.deepEqual(result.observations.map((item) => item.mechanism).sort(), ["dynamic-import", "re-export", "side-effect-import", "static-import"]); });
test("dynamic unresolved", () => assert.equal(observer.observeFile("src/a.js", "import(name);").observations[0].resolutionStatus, "dynamic-unresolved"));
test("external package", () => assert.equal(observer.observeFile("src/a.js", 'import x from "pkg";').observations[0].resolutionStatus, "external-package"));
test("ESM parse failure", () => assert.equal(observer.observeFile("src/a.js", "export {;").status, "failed"));

test("unified migrating has legacy and ESM", () => { const a = moduleEntry("src/a.js", "engine", ["engine-runtime"], "migrating"); a.analysis.dependencies.items = [{ target: "src/b.js", symbols: ["B"], resolution: "confirmed" }]; const b = moduleEntry("src/b.js", "engine", ["engine-runtime"]); const graph = new UnifiedDependencyGraphBuilder().build({ manifest: { modules: [a, b] }, esmResults: [{ source: "src/a.js", hasEsmSyntax: true, observations: [{ resolutionStatus: "confirmed-project", resolvedTarget: "src/b.js", mechanism: "static-import" }] }], bridgeRegistry: { bridges: [] } }); assert.deepEqual(graph.edges[0].mechanisms, ["legacy-confirmed", "static-import"]); });
test("self edge ignored", () => { const a = moduleEntry("src/a.js", "engine", ["engine-runtime"]); a.analysis.dependencies.items = [{ target: "src/a.js", symbols: ["A"], resolution: "confirmed" }]; assert.equal(new UnifiedDependencyGraphBuilder().build({ manifest: { modules: [a] }, esmResults: [], bridgeRegistry: { bridges: [] } }).edges.length, 0); });
test("Tarjan SCC", () => { const graph = { nodes: ["a", "b", "c"], edges: [edge("a", "b"), edge("b", "a"), edge("b", "c")] }; assert.deepEqual(new TarjanStronglyConnectedComponents().find(graph), [["a", "b"], ["c"]]); });

test("forbidden boundary", () => { const result = new BoundaryGuard().run(snapshot([moduleEntry("a", "engine", ["engine-runtime"]), moduleEntry("b", "game-domain")], [edge("a", "b")]), classifier()); assert.equal(result[0].status, "FAIL"); });
test("qualified role", () => { const result = new BoundaryGuard().run(snapshot([moduleEntry("a", "game-config", ["config-factory"]), moduleEntry("b", "game-domain", ["domain-behavior"])], [edge("a", "b")]), classifier()); assert.equal(result[0].rule, "qualified-role"); });
test("capability platform pass", () => { const a = moduleEntry("a", "platform", ["platform-adapter"]); a.observed.environment.browserApis = ["localStorage"]; assert.equal(new BrowserCapabilityGuard().run(snapshot([a]), classifier()).length, 0); });
test("capability domain fail", () => { const a = moduleEntry("a", "game-domain"); a.observed.environment.browserApis = ["document"]; assert.equal(new BrowserCapabilityGuard().run(snapshot([a]), classifier())[0].status, "FAIL"); });
test("direct dev leakage", () => { const result = new DevLeakageGuard().run(snapshot([moduleEntry("a", "game-domain"), moduleEntry("d", "dev", ["dev-tool"])], [edge("a", "d")]), classifier()); assert.equal(result[0].status, "FAIL"); });
test("role-only dev leakage", () => { const result = new DevLeakageGuard().run(snapshot([moduleEntry("a", "game-domain"), moduleEntry("d", "game-domain", ["dev-tool"])], [edge("a", "d")]), classifier()); assert.equal(result[0].status, "FAIL"); });
test("dynamic production dev leakage", () => { const result = new DevLeakageGuard().run(snapshot([moduleEntry("a", "game-domain"), moduleEntry("d", "dev", ["dev-tool"])], [edge("a", "d", "dynamic-import")]), classifier()); assert.equal(result[0].rule, "dev-leakage"); });
test("approved capability debt", () => { const a = moduleEntry("a", "game-domain"); a.observed.environment.browserApis = ["document"]; const identity = { rule: "browser-capability", source: "a", target: "environment:dom", identifier: "document" }; const debt = { id: CanonicalJson.debtId("browser-capability", identity), rule: "browser-capability", source: "a", target: "environment:dom", evidenceFingerprint: CanonicalJson.fingerprint(identity), removalStage: "stage-2" }; assert.equal(new BrowserCapabilityGuard().run(snapshot([a]), classifier([debt]))[0].status, "KNOWN-DEBT"); });
test("new global fails", () => { const a = moduleEntry("a", "game-domain"); a.observed.providers.items = [{ symbol: "NewGlobal", mechanism: "window-property", availability: "program-init" }]; assert.equal(new GlobalNamespaceGuard().run(snapshot([a]), classifier())[0].status, "FAIL"); });
test("removed global passes", () => assert.equal(new GlobalNamespaceGuard().run({ ...snapshot([]), globalBaseline: { providers: [{ currentPath: "a", symbol: "Old", mechanism: "window-property", availability: "program-init" }] } }, classifier()).length, 0));
test("new SCC fails", () => { const graph = { nodes: ["a", "b"], edges: [edge("a", "b"), edge("b", "a")] }; assert.equal(new SccCycleGuard().run({ ...snapshot([]), graph }, classifier())[0].status, "FAIL"); });
test("expanded SCC changes fingerprint", () => { const graph2 = { nodes: ["a", "b"], edges: [edge("a", "b"), edge("b", "a")] }; const first = new SccCycleGuard().run({ ...snapshot([]), graph: graph2 }, classifier())[0]; const debt = { id: "d", rule: first.rule, source: first.source, target: first.target, evidenceFingerprint: first.evidenceFingerprint, removalStage: "stage-2" }; const graph3 = { nodes: ["a", "b", "c"], edges: [edge("a", "b"), edge("b", "c"), edge("c", "a")] }; assert.equal(new SccCycleGuard().run({ ...snapshot([]), graph: graph3 }, classifier([debt]))[0].status, "FAIL"); });
test("approved SCC debt", () => { const graph = { nodes: ["a", "b"], edges: [edge("a", "b"), edge("b", "a")] }; const first = new SccCycleGuard().run({ ...snapshot([]), graph }, classifier())[0]; const debt = { id: "d", rule: first.rule, source: first.source, target: first.target, evidenceFingerprint: first.evidenceFingerprint, removalStage: "stage-2" }; assert.equal(new SccCycleGuard().run({ ...snapshot([]), graph }, classifier([debt]))[0].status, "KNOWN-DEBT"); });
test("stale debt fails", () => { const c = classifier([{ id: "old", rule: "boundary-dependency", source: "a", target: "b", evidenceFingerprint: "old", removalStage: "stage-2" }]); assert.equal(c.staleMetadataDiagnostics()[0].rule, "stale-known-debt"); });
test("stale exception fails", () => { const c = classifier([], [{ id: "old", rule: "module-convention", currentPath: "a" }]); assert.equal(c.staleMetadataDiagnostics()[0].rule, "stale-exception"); });
test("stale bridge fails", () => { const bridge = { id: "b", bridge: "bridge", source: "missing", target: "a", globalProviders: [] }; const s = snapshot([moduleEntry("a", "engine", ["engine-runtime"])]); s.bridgeRegistry = { bridges: [bridge] }; assert.equal(new BridgeRegistryGuard().run(s, classifier())[0].rule, "stale-bridge"); });
test("invalid removal stage", () => { const identity = { rule: "x", source: "a", target: "b" }; const item = { id: CanonicalJson.debtId("x", identity), rule: "x", source: "a", target: "b", reason: "r", blockers: [], owner: "o", migrationWave: 1, removalStage: "stage-99", evidenceFingerprint: CanonicalJson.fingerprint(identity), identity }; assert.throws(() => new KnownDebtRegistryValidator().validate({ schemaVersion: 1, kind: "cyber-fishing-known-debt", debts: [item] })); });
test("physical path mismatch", () => { const a = moduleEntry("src/a.js", "engine", ["engine-runtime"], "esm"); a.architecture.targetPath = "src/engine/a.js"; assert.equal(new PhysicalTargetPathGuard(process.cwd()).run(snapshot([a]), classifier())[0].rule, "physical-target-path"); });

const convention = (code, boundary = "game-domain", status = "migrating") => { const m = moduleEntry("src/a.js", boundary, [boundary === "platform" ? "platform-adapter" : "domain-behavior"], status); return snapshot([m], [], [{ currentPath: "src/a.js", esm: observer.observeFile("src/a.js", code) }]); };
test("named ESM pass", () => assert.equal(new EsmConventionGuard().run(convention("export class A {}"), classifier()).length, 0));
test("default export fail", () => assert.equal(new EsmConventionGuard().run(convention("export default class A {}"), classifier())[0].status, "FAIL"));
test("missing js fail", () => assert.equal(new EsmConventionGuard().run(convention('import { B } from "./b";'), classifier())[0].rule, "module-convention/explicit-js"));
test("domain side effect fail", () => assert.equal(new EsmConventionGuard().run(convention('import "./setup.js";'), classifier())[0].rule, "module-convention/side-effect-import"));
test("bootstrap side effect pass", () => assert.equal(new EsmConventionGuard().run(convention('import "./setup.js";', "bootstrap-production"), classifier()).length, 0));
test("barrel fail", () => assert.equal(new EsmConventionGuard().run(convention('export * from "./b.js";'), classifier())[0].rule, "module-convention/barrel-export"));
test("ESM global fail", () => assert.equal(new EsmConventionGuard().run(convention("window.A = class A {}; export { };"), classifier())[0].rule, "module-convention/esm-global-export"));
test("unresolved dynamic import convention fail", () => assert.equal(new EsmConventionGuard().run(convention("import(name);"), classifier())[0].rule, "module-convention/dynamic-import"));

console.log(`Architecture guard fixture matrix passed (${cases} cases).`);
