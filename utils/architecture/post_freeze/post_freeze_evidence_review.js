"use strict";

const espree = require("espree");
const estraverse = require("estraverse");
const { CanonicalJson } = require("../guards/core/canonical_json");
const { StageThreeStateIdentityReview } = require("../domain_batches/stage_three_state_identity_review");

const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const position = node => `${node.loc.start.line}:${node.loc.start.column + 1}`;
const COLLECTION_ISSUE = "collection-state-requires-cache-review:";
const COMPOSITION_ISSUE = "self-composition:";
const LEGACY_EXPOSURE_OBJECTS = new Set(["globalThis", "window"]);

// Reviewed collection contracts of the Stage 3.22 graph review. Each entry is a review decision
// (field, scope, collection kind, the operations the owner may perform and the cache lifetime);
// the source proof itself is re-run by StageThreeStateIdentityReview on every review.
const REVIEWED_COLLECTIONS = Object.freeze({
  "AssemblyStateRepository#states": Object.freeze({ className: "AssemblyStateRepository",
    field: "#states", scope: "instance", collection: "Map",
    allowedOperations: ["delete", "get", "has", "set", "values"],
    cacheLifetime: "instance-lifetime-authoritative-store" }),
  "AuthoredItemRarityStrategy#descriptors": Object.freeze({ className: "AuthoredItemRarityStrategy",
    field: "#descriptors", scope: "instance", collection: "Map", allowedOperations: ["get", "set"],
    cacheLifetime: "instance-lifetime-derived-memo-without-eviction" }),
  "ItemAssemblyStackingPolicy.ignoredKeys": Object.freeze({ className: "ItemAssemblyStackingPolicy",
    field: "#ignoredKeys", scope: "static", collection: "Set", allowedOperations: ["has"],
    cacheLifetime: "class-lifetime-immutable-lookup" }),
  "ItemMetricStrategyRegistry#strategies": Object.freeze({ className: "ItemMetricStrategyRegistry",
    field: "#strategies", scope: "instance", collection: "Map",
    allowedOperations: ["get", "has", "keys", "set"], cacheLifetime: "instance-lifetime-registry" }),
});

// Collection contracts added by the Stage 3.36 repeated review for the candidates unblocked by the
// prerequisite transitions: two registry maps and two derived memo caches cleared explicitly.
const REVIEWED_COLLECTIONS_3_36 = Object.freeze({
  ...REVIEWED_COLLECTIONS,
  "AssemblyProfileRegistry#profileIdByFallbackType": Object.freeze({ className: "AssemblyProfileRegistry",
    field: "#profileIdByFallbackType", scope: "instance", collection: "Map", allowedOperations: ["get", "has", "set"],
    cacheLifetime: "instance-lifetime-registry-index" }),
  "AssemblyProfileRegistry#profiles": Object.freeze({ className: "AssemblyProfileRegistry",
    field: "#profiles", scope: "instance", collection: "Map", allowedOperations: ["get", "has", "set"],
    cacheLifetime: "instance-lifetime-registry" }),
  "ItemCatalogBaselineRegistry#cache": Object.freeze({ className: "ItemCatalogBaselineRegistry",
    field: "#cache", scope: "instance", collection: "Map", allowedOperations: ["clear", "get", "set"],
    cacheLifetime: "instance-lifetime-derived-memo-with-explicit-clear" }),
  "ItemProgressionResolver#cache": Object.freeze({ className: "ItemProgressionResolver",
    field: "#cache", scope: "instance", collection: "Map", allowedOperations: ["clear", "get", "set"],
    cacheLifetime: "instance-lifetime-derived-memo-with-explicit-clear" }),
});

// Collection contracts added by the Stage 3.40 repeated review for the candidates unblocked by the six
// decompositions: two authoritative stores replaced by snapshot restore, the store's derived child
// index rebuilt with it, and one immutable static lookup (as ItemAssemblyStackingPolicy.ignoredKeys).
const REVIEWED_COLLECTIONS_3_40 = Object.freeze({
  ...REVIEWED_COLLECTIONS_3_36,
  "FlatInventoryItemRepository#items": Object.freeze({ className: "FlatInventoryItemRepository",
    field: "#items", scope: "instance", collection: "Map",
    allowedOperations: ["delete", "get", "has", "set", "size", "values"],
    cacheLifetime: "instance-lifetime-authoritative-store" }),
  "FlatInventoryItemRepository#childrenByParent": Object.freeze({ className: "FlatInventoryItemRepository",
    field: "#childrenByParent", scope: "instance", collection: "Map", allowedOperations: ["get", "set"],
    cacheLifetime: "instance-lifetime-derived-index-rebuilt-with-store" }),
  "InventoryItemStackingPolicy.ignoredKeys": Object.freeze({ className: "InventoryItemStackingPolicy",
    field: "#ignoredKeys", scope: "static", collection: "Set", allowedOperations: ["has"],
    cacheLifetime: "class-lifetime-immutable-lookup" }),
  "EquipmentLoadoutRepository#loadouts": Object.freeze({ className: "EquipmentLoadoutRepository",
    field: "#loadouts", scope: "instance", collection: "Map",
    allowedOperations: ["delete", "get", "has", "set", "values"],
    cacheLifetime: "instance-lifetime-authoritative-store" }),
});

// Collection contracts of the Stage 3.50 repeated review (review queue 049–052): the same three stores with
// their reviewed replacement rules — the inventory store's transactional swap with rollback, its child index
// reset by the first statement of the rebuild, and the loadout store's atomic local replacement.
const REVIEWED_COLLECTIONS_3_50 = Object.freeze({
  ...REVIEWED_COLLECTIONS_3_40,
  "FlatInventoryItemRepository#items": Object.freeze({ ...REVIEWED_COLLECTIONS_3_40["FlatInventoryItemRepository#items"],
    replacement: "transactional-swap" }),
  "FlatInventoryItemRepository#childrenByParent": Object.freeze({
    ...REVIEWED_COLLECTIONS_3_40["FlatInventoryItemRepository#childrenByParent"], replacement: "rebuilt-index" }),
  "EquipmentLoadoutRepository#loadouts": Object.freeze({ ...REVIEWED_COLLECTIONS_3_40["EquipmentLoadoutRepository#loadouts"],
    replacement: "atomic-local" }),
});

// Reviews the ownership, identity, evaluation-effect, configuration, cache-lifetime and hot-loop
// evidence of every remaining Domain module. Missing or ambiguous evidence is a finding; a module
// with findings is not sufficient for an approved freeze.
class PostFreezeEvidenceReviewer {
  // `frozenConstants`: review top-level Object.freeze constants (Stage 3.40 on; earlier reviews replay
  // without it byte-for-byte).
  constructor({ reviewedCollections = REVIEWED_COLLECTIONS, requiredHotLoopEvidence,
    identityReview = new StageThreeStateIdentityReview(), frozenConstants = false } = {}) {
    this.reviewedCollections = reviewedCollections;
    this.frozenConstants = frozenConstants;
    this.requiredHotLoopEvidence = requiredHotLoopEvidence;
    this.identityReview = identityReview;
  }

  review({ modules, categories, providerIndex, readSource }) {
    return modules.map(module => this.#module(module, categories.get(module.currentPath),
      providerIndex, readSource(module.currentPath)))
      .sort((left, right) => compare(left.currentPath, right.currentPath));
  }

  #module(module, category, providerIndex, source) {
    const findings = [];
    const tree = espree.parse(source, { ecmaVersion: "latest", sourceType: "script", loc: true, range: true });
    const providers = new Set(module.manifestEvidence.providers.items.map(item => item.symbol));
    const collections = this.#collections(module, source, findings);
    const reviewedOwners = new Set(collections.filter(item => item.status === "proven").map(item => item.owner));
    const selfComposition = this.#selfComposition(module, providerIndex, findings);
    const state = module.stateOwnership;
    if (!["verified", "partial"].includes(state.status)) findings.push(`state-audit-${state.status}`);
    for (const issue of state.facts.issues) {
      if (issue.startsWith(COMPOSITION_ISSUE) || issue.startsWith(COLLECTION_ISSUE)) continue;
      findings.push(`unreviewed-state-issue:${issue}`);
    }
    const effects = module.dependencyAudit.facts.topLevelEffects.map(effect =>
      this.#effect(effect, tree, providers, reviewedOwners, module.currentPath, findings));
    const configuration = module.configurationInput;
    if (configuration.status !== "verified") findings.push(`configuration-audit-${configuration.status}`);
    for (const read of configuration.facts.forbiddenDirectReads) findings.push(`direct-config-read:${read}`);
    const dependency = module.dependencyAudit;
    if (dependency.status !== "verified") findings.push(`dependency-audit-${dependency.status}`);
    for (const issue of dependency.facts.issues) findings.push(`dependency-issue:${issue}`);
    for (const constraint of dependency.facts.availabilityConstraints) {
      if (constraint.resolution !== "confirmed") {
        findings.push(`availability-${constraint.resolution}:${constraint.symbol}`);
      }
    }
    const performance = this.#performance(module.performanceRisk, findings);
    const record = {
      currentPath: module.currentPath,
      targetPath: module.targetPath,
      category,
      ownership: {
        status: state.status,
        classification: state.facts.classification,
        authoritativeOwners: [...state.facts.authoritativeOwners].sort(compare),
        derivedCaches: [...state.facts.derivedCaches].sort(compare),
        persistenceBoundaries: [...state.facts.persistenceBoundaries].sort(compare),
        selfComposition,
        collections,
      },
      identity: {
        providers: [...providers].sort(compare),
        instancePolicy: "single-cumulative-module-instance",
        exposure: providers.size > 0 && dependency.facts.reverseConsumers.length > 0
          ? "exact-activation-reference" : "none",
      },
      evaluation: { effects },
      configuration: {
        status: configuration.status,
        inputs: configuration.facts.inputs.length,
        forbiddenDirectReads: [...configuration.facts.forbiddenDirectReads].sort(compare),
      },
      cacheLifetime: collections.map(item => ({ owner: item.owner, lifetime: item.cacheLifetime,
        creation: item.creation })),
      performance,
      availability: {
        constraints: dependency.facts.availabilityConstraints.length,
        unconfirmed: dependency.facts.availabilityConstraints
          .filter(item => item.resolution !== "confirmed").length,
      },
      findings: [...new Set(findings)].sort(compare),
    };
    record.verdict = record.findings.length === 0 ? "sufficient" : "insufficient";
    record.evidenceFingerprint = CanonicalJson.fingerprint({ ...record, source: CanonicalJson.fingerprint(source) });
    return record;
  }

  #collections(module, source, findings) {
    const owners = module.stateOwnership.facts.issues.filter(issue => issue.startsWith(COLLECTION_ISSUE))
      .map(issue => issue.slice(COLLECTION_ISSUE.length)).sort(compare);
    return owners.map(owner => {
      const reviewed = this.reviewedCollections[owner];
      if (!reviewed) {
        findings.push(`unreviewed-collection:${owner}`);
        return { owner, status: "unreviewed", cacheLifetime: "unknown", creation: "unknown" };
      }
      try {
        const proof = this.identityReview.review({ source, currentPath: module.currentPath,
          className: reviewed.className, collections: [{ owner, field: reviewed.field,
            scope: reviewed.scope, collection: reviewed.collection,
            allowedOperations: reviewed.allowedOperations,
            ...(reviewed.replacement ? { replacement: reviewed.replacement } : {}) }] });
        const [collection] = proof.collections;
        return { owner, status: "proven", collection: collection.collection, scope: collection.scope,
          creation: collection.creation, creationLocation: collection.creationLocation,
          methods: collection.methods, mutatingMethods: collection.mutatingMethods,
          escapes: collection.escapes, cacheLifetime: reviewed.cacheLifetime };
      } catch (error) {
        findings.push(`collection-identity-unproven:${owner}`);
        return { owner, status: "unproven", reason: error.message.split("\n")[0],
          cacheLifetime: reviewed.cacheLifetime, creation: "unproven" };
      }
    });
  }

  #selfComposition(module, providerIndex, findings) {
    return module.stateOwnership.facts.issues.filter(issue => issue.startsWith(COMPOSITION_ISSUE))
      .map(issue => {
        const match = /^self-composition:([^>]+)->([A-Za-z_$][\w$]*)@(\d+:\d+)$/u.exec(issue);
        if (!match) {
          findings.push(`ambiguous-composition:${issue}`);
          return { issue, resolution: "ambiguous" };
        }
        const provider = providerIndex.get(match[2]);
        if (!provider) findings.push(`unresolved-composition:${match[2]}`);
        return { owner: match[1], composed: match[2], location: match[3],
          provider: provider?.module || null, providerStatus: provider?.status || "unresolved",
          identity: provider ? "owner-created-instance" : "unknown" };
      })
      .sort((left, right) => compare(`${left.composed}\u0000${left.location}`,
        `${right.composed}\u0000${right.location}`));
  }

  #effect(effect, tree, providers, reviewedOwners, currentPath, findings) {
    const nodes = [];
    estraverse.traverse(tree, { fallback: "iteration", enter(node) {
      if (node.loc && position(node) === effect.location) nodes.push(node);
    } });
    let review = "unreviewed";
    if (effect.kind === "assignment") {
      const node = nodes.find(item => item.type === "AssignmentExpression");
      if (node && node.operator === "=" && node.left.type === "MemberExpression" && !node.left.computed &&
        node.left.object.type === "Identifier" && LEGACY_EXPOSURE_OBJECTS.has(node.left.object.name) &&
        node.right.type === "Identifier" && node.left.property.name === node.right.name &&
        providers.has(node.right.name)) {
        review = "legacy-exposure-replaced-by-exact-activation";
      }
    } else if (effect.kind === "instantiation") {
      const owner = this.#staticCollectionOwner(tree, effect.location);
      if (owner && reviewedOwners.has(owner)) review = "reviewed-private-collection-created-once";
    } else if (effect.kind === "call" && this.frozenConstants && this.#frozenConstant(tree, effect.location)) {
      review = "reviewed-immutable-constant-declaration";
    }
    if (review === "unreviewed") findings.push(`unreviewed-evaluation-effect:${effect.kind}@${effect.location}`);
    return { kind: effect.kind, location: effect.location, classification: effect.classification, review,
      module: currentPath };
  }

  // `Object.freeze(<object or array literal>)` whose ancestors up to a top-level `const` declaration are
  // only literals, their properties and further `Object.freeze` calls: an immutable constant evaluated
  // once, with no effect outside the value it creates.
  #frozenConstant(tree, location) {
    const isFreeze = node => node.type === "CallExpression" && node.callee.type === "MemberExpression" &&
      !node.callee.computed && node.callee.object.type === "Identifier" && node.callee.object.name === "Object" &&
      node.callee.property.name === "freeze" && node.arguments.length === 1 &&
      ["ObjectExpression", "ArrayExpression"].includes(node.arguments[0].type);
    for (const declaration of tree.body.filter(node => node.type === "VariableDeclaration" && node.kind === "const")) {
      for (const declarator of declaration.declarations) {
        let found = null;
        const walk = (node, allowed) => {
          if (!node || found !== null) return;
          if (node.type === "CallExpression" && position(node) === location) {
            found = allowed && isFreeze(node);
            return;
          }
          if (isFreeze(node)) return walk(node.arguments[0], allowed);
          if (node.type === "ObjectExpression") {
            for (const property of node.properties) walk(property.type === "Property" ? property.value : property, allowed);
          } else if (node.type === "ArrayExpression") {
            for (const element of node.elements) walk(element, allowed);
          }
        };
        walk(declarator.init, true);
        if (found !== null) return found;
      }
    }
    return false;
  }

  #staticCollectionOwner(tree, location) {
    for (const declaration of tree.body.filter(node => node.type === "ClassDeclaration")) {
      for (const member of declaration.body.body) {
        if (member.type === "PropertyDefinition" && member.key.type === "PrivateIdentifier" &&
          member.value?.type === "NewExpression" && position(member.value) === location) {
          return member.static ? `${declaration.id.name}.${member.key.name}`
            : `${declaration.id.name}#${member.key.name}`;
        }
      }
    }
    return null;
  }

  #performance(risk, findings) {
    const facts = risk.facts;
    if (risk.status !== "verified") findings.push(`performance-audit-${risk.status}`);
    for (const access of facts.browserAccess) findings.push(`browser-access:${access}`);
    const hotLoop = facts.hotLoopParticipation === "direct";
    if (hotLoop) findings.push("hot-loop-equivalence-evidence-missing");
    return {
      hotLoopParticipation: facts.hotLoopParticipation,
      perFrameAllocations: facts.perFrameAllocations,
      deltaTimeSemantics: facts.deltaTimeSemantics,
      updateRenderSeparation: facts.updateRenderSeparation,
      requiredEvidence: hotLoop ? [...this.requiredHotLoopEvidence, "no-compatibility-lookup-in-hot-loop"] : [],
    };
  }
}

// Resolves a classic global symbol to the Domain module that owns it: remaining classic providers
// by Manifest evidence and completed ESM targets through their exact activation contract. A symbol
// declared by several classic modules has no single owner and resolves to nothing; it is reported.
class PostFreezeProviderIndex {
  build({ modules, runtimeContract, completedTargets }) {
    const index = new Map();
    const owners = new Map();
    const add = (symbol, record) => {
      if (!owners.has(symbol)) owners.set(symbol, new Map());
      owners.get(symbol).set(record.module, record);
    };
    const infrastructure = new Set(runtimeContract.approvedInfrastructureModules || []);
    for (const activation of runtimeContract.activationPositions) {
      // An approved infrastructure module (the Engine Vector2, prerequisite 027) provides its symbol
      // like a completed target: consumers compose the one Engine constructor.
      if (infrastructure.has(activation.targetModule)) {
        add(activation.legacySymbol, { module: activation.targetModule, status: "approved-infrastructure",
          exportName: activation.exportName });
        continue;
      }
      if (!completedTargets.has(activation.targetModule)) continue;
      add(activation.legacySymbol, { module: activation.targetModule, status: "completed",
        exportName: activation.exportName });
    }
    for (const module of modules) {
      for (const provider of module.manifestEvidence.providers.items) {
        add(provider.symbol, { module: module.currentPath, status: "remaining", exportName: provider.symbol });
      }
    }
    const ambiguous = [];
    for (const [symbol, records] of [...owners].sort(([left], [right]) => compare(left, right))) {
      if (records.size === 1) index.set(symbol, [...records.values()][0]);
      else ambiguous.push({ symbol, modules: [...records.keys()].sort(compare) });
    }
    return { index, ambiguous };
  }
}

module.exports = { PostFreezeEvidenceReviewer, PostFreezeProviderIndex, REVIEWED_COLLECTIONS,
  REVIEWED_COLLECTIONS_3_36, REVIEWED_COLLECTIONS_3_40, REVIEWED_COLLECTIONS_3_50 };
