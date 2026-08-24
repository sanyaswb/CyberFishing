"use strict";

const assert = require("node:assert/strict");
const { CanonicalJson } = require("./guards/core/canonical_json");
const { DomainAuditContract } = require("./domain_audit/domain_audit_contract");
const { DomainAuditDocument } = require("./domain_audit/domain_audit_models");
const { DomainAuditValidator } = require("./domain_audit/domain_audit_validator");
const {
  ConservativeDomainInventoryBuilder,
} = require("./domain_audit/conservative_domain_inventory_builder");

class StageThreeDomainAuditFixtureCheck {
  constructor({ contract, builder, validator }) {
    this.contract = contract;
    this.builder = builder;
    this.validator = validator;
  }

  run() {
    const manifest = this.#manifest();
    const manifestBefore = this.#clone(manifest);
    const expected = this.builder.build({
      manifest,
      releaseVersion: "0.24.36",
    });
    const repeated = this.builder.build({
      manifest,
      releaseVersion: "0.24.36",
    });
    assert.deepEqual(repeated, expected, "Domain inventory must be deterministic");
    assert.deepEqual(manifest, manifestBefore, "Domain inventory must be read-only");
    assert.deepEqual(this.validator.validate(expected, {
      expectedInventory: expected,
    }), { entries: 2, pendingAnalyses: 8 });
    assert.deepEqual(
      expected.entries.map((entry) => entry.currentPath),
      ["src/a_domain.js", "src/b_domain.js"],
    );
    assert.deepEqual(
      expected.entries[0].manifestEvidence.reverseConsumers,
      [{ source: "src/c_consumer.js", symbols: ["A"] }],
    );
    this.#assertMissingEntryFails(expected);
    this.#assertExtraEntryFails(expected);
    this.#assertDuplicateEntryFails(expected);
    this.#assertWrongScopeFails(expected);
    this.#assertStaleFingerprintFails(expected);
    this.#assertPendingPayloadFails(expected);
    this.#assertVerifiedWithoutEvidenceFails(expected);
    this.#assertVerifiedDependencyContract(expected);
    this.#assertInvalidDependencyDepthFails(expected);
    this.#assertUnsortedEntriesFail(expected);
    this.#assertImmutableModel(expected);
    this.#assertReconcilePreservesReviewedFacts(manifest, expected);
    this.#assertChangedEvidenceResetsReviewedFacts(manifest, expected);
    console.log(
      "Stage 3 domain audit fixtures passed: schema, scope equality, " +
        "fingerprints, pending semantics, immutability, conservative " +
        "reconciliation and dependencyAudit v2 semantics verified (14 cases).",
    );
  }

  #assertMissingEntryFails(expected) {
    const invalid = this.#clone(expected);
    invalid.entries.pop();
    this.#refreshScopeFingerprint(invalid);
    assert.throws(
      () => this.validator.validate(invalid, { expectedInventory: expected }),
      /entries must equal/u,
    );
  }

  #assertExtraEntryFails(expected) {
    const invalid = this.#clone(expected);
    const extra = this.#clone(invalid.entries[1]);
    extra.currentPath = "src/z_extra.js";
    extra.targetPath = "src/game/domain/z_extra.js";
    extra.manifestEvidence.reverseConsumers = [];
    this.#refreshEntryFingerprint(extra);
    invalid.entries.push(extra);
    this.#refreshScopeFingerprint(invalid);
    assert.throws(
      () => this.validator.validate(invalid, { expectedInventory: expected }),
      /entries must equal/u,
    );
  }

  #assertDuplicateEntryFails(expected) {
    const invalid = this.#clone(expected);
    invalid.entries.push(this.#clone(invalid.entries[1]));
    assert.throws(
      () => this.validator.validate(invalid),
      /sorted and unique/u,
    );
  }

  #assertWrongScopeFails(expected) {
    const invalid = this.#clone(expected);
    invalid.source.scope.value = "platform";
    assert.throws(
      () => this.validator.validate(invalid),
      /exact game-domain/u,
    );
  }

  #assertStaleFingerprintFails(expected) {
    const invalid = this.#clone(expected);
    invalid.entries[0].manifestEvidence.legacyLoadOrder += 1;
    assert.throws(
      () => this.validator.validate(invalid),
      /stale fingerprint/u,
    );
  }

  #assertPendingPayloadFails(expected) {
    const invalid = this.#clone(expected);
    invalid.entries[0].stateOwnership.facts = {};
    assert.throws(
      () => this.validator.validate(invalid),
      /pending facts must be null/u,
    );
  }

  #assertVerifiedWithoutEvidenceFails(expected) {
    const invalid = this.#clone(expected);
    invalid.entries[0].stateOwnership = {
      status: "verified",
      facts: {
        classification: "stateless",
        authoritativeOwners: [],
        reads: [],
        writes: [],
        derivedCaches: [],
        persistenceBoundaries: [],
        evidence: [],
        issues: [],
      },
    };
    assert.throws(
      () => this.validator.validate(invalid),
      /verified facts require evidence/u,
    );
  }

  #assertUnsortedEntriesFail(expected) {
    const invalid = this.#clone(expected);
    invalid.entries.reverse();
    assert.throws(
      () => this.validator.validate(invalid),
      /entry paths must be sorted/u,
    );
  }

  #assertVerifiedDependencyContract(expected) {
    const valid = this.#clone(expected);
    valid.entries[0].dependencyAudit = this.#verifiedDependencyFacts();
    assert.deepEqual(this.validator.validate(valid, {
      expectedInventory: expected,
    }), { entries: 2, pendingAnalyses: 7 });
  }

  #assertInvalidDependencyDepthFails(expected) {
    const invalid = this.#clone(expected);
    invalid.entries[0].dependencyAudit = this.#verifiedDependencyFacts();
    invalid.entries[0].dependencyAudit.facts.dependencyDepth = -1;
    assert.throws(
      () => this.validator.validate(invalid),
      /dependencyDepth must be a non-negative integer/u,
    );
  }

  #assertImmutableModel(expected) {
    const model = new DomainAuditDocument(expected);
    assert.throws(
      () => model.value.entries.push({}),
      TypeError,
    );
    const snapshot = model.snapshot();
    snapshot.entries.pop();
    assert.equal(model.value.entries.length, 2);
  }

  #assertReconcilePreservesReviewedFacts(manifest, expected) {
    const existing = this.#clone(expected);
    existing.entries[0].stateOwnership = this.#verifiedStatelessFacts();
    const reconciled = this.builder.reconcile({
      manifest,
      releaseVersion: "0.24.37",
      existingDocument: existing,
    });
    assert.deepEqual(
      reconciled.entries[0].stateOwnership,
      existing.entries[0].stateOwnership,
    );
    assert.equal(reconciled.source.releaseVersion, "0.24.37");
  }

  #assertChangedEvidenceResetsReviewedFacts(manifest, expected) {
    const existing = this.#clone(expected);
    existing.entries[0].stateOwnership = this.#verifiedStatelessFacts();
    const changedManifest = this.#clone(manifest);
    changedManifest.modules[0].observed.legacyLoadOrder = 9;
    const reconciled = this.builder.reconcile({
      manifest: changedManifest,
      releaseVersion: "0.24.37",
      existingDocument: existing,
    });
    assert.deepEqual(reconciled.entries[0].stateOwnership, {
      status: "pending",
      facts: null,
    });
  }

  #verifiedStatelessFacts() {
    return {
      status: "verified",
      facts: {
        classification: "stateless",
        authoritativeOwners: [],
        reads: [],
        writes: [],
        derivedCaches: [],
        persistenceBoundaries: [],
        evidence: [{
          sourcePath: "src/a_domain.js",
          observation: "No mutable module, instance or external state was observed.",
        }],
        issues: [],
      },
    };
  }

  #verifiedDependencyFacts() {
    return {
      status: "verified",
      facts: {
        graphFingerprint: CanonicalJson.fingerprint({ fixture: "graph" }),
        internalDependencies: [{
          target: "src/b_domain.js",
          symbols: ["B"],
          executionPhases: ["deferred"],
        }],
        externalDependencies: [{
          target: "src/d_engine.js",
          targetBoundary: "engine",
          symbols: ["D"],
          executionPhases: ["eager"],
          policy: "allowed",
        }],
        reverseConsumers: [{
          source: "src/c_consumer.js",
          sourceBoundary: "game-application",
          symbols: ["A"],
        }],
        scc: {
          id: "scc-123456789abc",
          members: ["src/a_domain.js"],
          internalEdges: [],
          cyclic: false,
        },
        dependencyDepth: 1,
        capabilities: [{
          capability: "timing",
          identifiers: ["performance"],
          policy: "forbidden",
        }],
        availabilityConstraints: [{
          symbol: "B",
          target: "src/b_domain.js",
          consumerPhase: "deferred",
          providerAvailability: "program-init",
          resolution: "confirmed",
        }],
        topLevelEffects: [{
          kind: "call",
          location: "1:0",
          classification: "observable",
        }],
        evidence: [{
          sourcePath: "src/a_domain.js",
          observation: "Fixture graph and SCC facts were mechanically verified.",
        }],
        issues: [],
      },
    };
  }

  #manifest() {
    return {
      schemaVersion: 5,
      modules: [
        this.#entry({
          currentPath: "src/a_domain.js",
          order: 1,
          symbol: "A",
          targetBoundary: "game-domain",
          targetPath: "src/game/domain/a.js",
          roles: ["domain-contract"],
        }),
        this.#entry({
          currentPath: "src/b_domain.js",
          order: 2,
          symbol: "B",
          targetBoundary: "game-domain",
          targetPath: "src/game/domain/b.js",
          roles: ["domain-behavior"],
        }),
        this.#entry({
          currentPath: "src/c_consumer.js",
          order: 3,
          symbol: "C",
          consumer: "A",
          target: "src/a_domain.js",
          targetBoundary: "game-application",
          targetPath: "src/game/application/c.js",
          roles: ["application-service"],
        }),
        this.#entry({
          currentPath: "src/d_engine.js",
          order: 4,
          symbol: "D",
          targetBoundary: "engine",
          targetPath: "src/engine/d.js",
          roles: ["engine-contract"],
        }),
      ],
    };
  }

  #entry({
    currentPath,
    order,
    symbol,
    consumer = null,
    target = null,
    targetBoundary,
    targetPath,
    roles,
  }) {
    const consumerFact = consumer ? {
      symbol: consumer,
      mechanism: "identifier",
      accessRequirement: "required",
      executionPhase: "deferred",
    } : null;
    return {
      currentPath,
      currentArea: "fixture",
      observed: {
        legacyLoadOrder: order,
        providers: {
          status: "verified",
          items: [{
            symbol,
            mechanism: "global-lexical",
            availability: "program-init",
          }],
          issues: [],
        },
        consumers: {
          status: "verified",
          items: consumerFact ? [consumerFact] : [],
          issues: [],
        },
        environment: {
          status: "verified",
          builtins: [],
          browserApis: [],
          dynamicConstructs: [],
          issues: [],
        },
      },
      architecture: {
        migrationStatus: "classified",
        roles,
        targetBoundary,
        targetPath,
        migrationWave: 2,
      },
      analysis: {
        dependencies: {
          status: "verified",
          confirmed: target ? [{
            ...consumerFact,
            target,
            resolution: "confirmed",
          }] : [],
          items: target ? [{
            target,
            symbols: [consumer],
            resolution: "confirmed",
          }] : [],
          unresolved: [],
          ambiguous: [],
          issues: [],
        },
        blockers: { status: "verified", items: [] },
      },
    };
  }

  #refreshEntryFingerprint(entry) {
    const manifestEvidence = this.#clone(entry.manifestEvidence);
    delete manifestEvidence.fingerprint;
    entry.manifestEvidence.fingerprint = CanonicalJson.fingerprint({
      currentPath: entry.currentPath,
      targetPath: entry.targetPath,
      roles: entry.roles,
      manifestEvidence,
    });
  }

  #refreshScopeFingerprint(document) {
    document.source.manifestScopeFingerprint = CanonicalJson.fingerprint(
      document.entries.map((entry) => ({
        currentPath: entry.currentPath,
        targetPath: entry.targetPath,
        roles: entry.roles,
        manifestEvidence: entry.manifestEvidence,
      })),
    );
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

const contract = new DomainAuditContract();
new StageThreeDomainAuditFixtureCheck({
  contract,
  builder: new ConservativeDomainInventoryBuilder(contract),
  validator: new DomainAuditValidator(contract),
}).run();
