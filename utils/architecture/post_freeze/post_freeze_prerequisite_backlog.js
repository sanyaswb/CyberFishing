"use strict";

const espree = require("espree");
const estraverse = require("estraverse");

const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const unique = values => [...new Set(values)].sort(compare);
const position = node => `${node.loc.start.line}:${node.loc.start.column + 1}`;
const BACKLOG_KINDS = new Set(["architecture-prerequisite", "boundary-extraction", "config-di",
  "domain-dependency", "evidence-review"]);
const { STAGE_3_22 } = require("./post_freeze_review_profile");

const graphReviewRepeat = stage => `Repeat the Stage ${stage} post-freeze graph review (fresh observation, ` +
  "logical graph, eligibility and candidate plan) after the task lands and before any dependent " +
  "cluster is frozen or executed.";

// Reviewed graph-changing prerequisite tasks. `match` selects the prerequisite records a task
// resolves; everything else a task records is derived from the physical graph and sources.
const GRAPH_TASKS = Object.freeze([
  Object.freeze({
    slug: "vector2-extraction", kind: "boundary-extraction",
    match: { kind: "boundary-extraction", module: "src/core/core.js" }, symbols: ["Vector2"],
    intent: "Extract the Vector2 value type from the platform core script into a reusable engine math module.",
    targetBoundaries: { from: "platform", to: "engine", proposedTarget: "src/engine/math/vector2.js" },
    compatibility: [
      "Vector2 keeps its constructor, prototype methods and value semantics byte-for-byte.",
      "The legacy global Vector2 stays available to every unmigrated classic consumer through one reviewed bridge.",
      "No new permanent global; CacheManager and InputManager stay in the platform core script.",
    ],
    checks: ["focused Vector2 parity (construction, arithmetic, normalization, immutability of inputs)",
      "check:architecture", "check:quick", "game-cycle-check fight scenarios"],
    graphTrigger: "The forbidden Domain → src/core/core.js Vector2 edges disappear from the physical graph.",
  }),
  Object.freeze({
    slug: "bait-effectiveness-descriptor-boundary", kind: "descriptor-boundary",
    match: { kind: "boundary-extraction", module: "src/core/items/bait/bait_effectiveness_descriptor.js" },
    symbols: ["BaitEffectivenessDescriptor"],
    intent: "Separate the Domain bait-effectiveness result from presentation descriptor fields.",
    targetBoundaries: { from: "game-presentation", to: "game-domain-result-plus-presentation-mapper" },
    compatibility: [
      "Existing descriptor consumers receive identical fields and values through a presentation mapper.",
      "BaitEffectivenessResolver returns a Domain result without presentation-only fields.",
    ],
    checks: ["focused bait effectiveness parity (result and descriptor fields)", "check:architecture",
      "check:quick", "inventory/bait scenarios of game-cycle-check"],
    graphTrigger: "BaitEffectivenessResolver no longer depends on the presentation descriptor module.",
  }),
  Object.freeze({
    slug: "item-freshness-descriptor-boundary", kind: "descriptor-boundary",
    match: { kind: "boundary-extraction", module: "src/core/items/freshness/item_freshness_descriptor.js" },
    symbols: ["ItemFreshnessDescriptor"],
    intent: "Separate the Domain freshness result from presentation descriptor fields.",
    targetBoundaries: { from: "game-presentation", to: "game-domain-result-plus-presentation-mapper" },
    compatibility: [
      "Existing freshness descriptor consumers receive identical fields and values through a presentation mapper.",
      "ItemFreshnessResolver returns a Domain result without presentation-only fields.",
    ],
    checks: ["focused freshness parity (result and descriptor fields)", "check:architecture", "check:quick"],
    graphTrigger: "ItemFreshnessResolver no longer depends on the presentation descriptor module.",
  }),
  Object.freeze({
    slug: "item-condition-descriptor-boundary", kind: "descriptor-boundary",
    match: { kind: "boundary-extraction", module: "src/core/items/condition/item_condition_descriptor.js" },
    symbols: ["ItemConditionDescriptor"],
    intent: "Separate the Domain condition result from presentation descriptor fields.",
    targetBoundaries: { from: "game-presentation", to: "game-domain-result-plus-presentation-mapper" },
    compatibility: [
      "Existing condition descriptor consumers receive identical fields and values through a presentation mapper.",
      "ItemConditionResolver returns a Domain result without presentation-only fields.",
    ],
    checks: ["focused condition parity (result and descriptor fields)", "check:architecture", "check:quick"],
    graphTrigger: "ItemConditionResolver no longer depends on the presentation descriptor module.",
  }),
  Object.freeze({
    slug: "assembly-profile-registry-config-injection", kind: "config-injection",
    match: { kind: "config-di", module: "src/core/assemblies/assembly_profile_registry.js" },
    symbols: ["AssemblyProfileRegistry"], configSymbols: ["ITEM_ASSEMBLY_PROFILE_CONFIG"],
    intent: "Deliver ITEM_ASSEMBLY_PROFILE_CONFIG to AssemblyProfileRegistry through its constructor from the composition roots.",
    targetBoundaries: { from: "game-config-raw-direct-read", to: "constructor-injection-from-composition" },
    compatibility: [
      "Every composition call site passes the same frozen profile table; registry behavior and profile order are unchanged.",
      "The raw config global is read only in composition code, never inside the Domain module.",
    ],
    checks: ["focused assembly profile parity", "inventory-v2 persistence and migration checks",
      "check:architecture", "check:quick"],
    graphTrigger: "The forbidden AssemblyProfileRegistry → ITEM_ASSEMBLY_PROFILE_CONFIG read disappears.",
  }),
  Object.freeze({
    slug: "item-stat-override-policy-config-injection", kind: "config-injection",
    match: { kind: "config-di", module: "src/core/items/item_stat_override_policy.js" },
    symbols: ["ItemStatOverridePolicy"], configSymbols: ["ITEM_STAT_OVERRIDE_CONFIG"],
    intent: "Replace the ItemStatOverridePolicy global default with configuration injected at composition, including the default-parameter call sites.",
    targetBoundaries: { from: "game-config-raw-direct-read", to: "constructor-injection-from-composition" },
    compatibility: [
      "Default-parameter call sites receive an explicitly composed policy with the same override table.",
      "Effective stats, snapshots and legacy migration results stay byte-identical.",
    ],
    checks: ["focused effective-stats parity", "inventory snapshot and legacy migration checks",
      "check:architecture", "check:quick"],
    graphTrigger: "The forbidden ItemStatOverridePolicy → ITEM_STAT_OVERRIDE_CONFIG read disappears.",
  }),
]);

// Reviewed responsibility groups for deferred modules, keyed by reviewed target area.
const DECOMPOSITION_GROUPS = Object.freeze([
  Object.freeze({ slug: "equipment-decomposition", areas: ["equipment"],
    intent: "Decompose equipment slot catalog, state, transition planning, readiness and compatibility responsibilities." }),
  Object.freeze({ slug: "inventory-decomposition", areas: ["inventory", "line"],
    intent: "Decompose inventory capacity, flat repository, stacking and line allocation responsibilities." }),
  Object.freeze({ slug: "loadouts-decomposition", areas: ["loadouts"],
    intent: "Decompose loadout model, repository and equipment transition planning responsibilities." }),
  Object.freeze({ slug: "item-progression-decomposition", areas: ["items"],
    intent: "Decompose item metric composition, capacity, rating and catalog baseline responsibilities." }),
  Object.freeze({ slug: "fishing-systems-decomposition", areas: ["casting", "fishing"],
    intent: "Decompose fishing systems and policies that mix Domain rules with config, browser or DEV responsibilities." }),
  Object.freeze({ slug: "entities-world-rules-decomposition", areas: ["fish", "locations", "rules", "tackle"],
    intent: "Decompose the fish and tackle entities, the location world and gameplay rules." }),
]);

const BLOCKER_BOUNDARIES = Object.freeze({
  "browser-api-coupling": "platform",
  "dev-production-coupling": "dev",
  "mixed-responsibility-requires-decomposition": "game-domain-plus-owning-layer",
});

const EVIDENCE_TASKS = Object.freeze({
  "hot-loop-equivalence-evidence-missing": Object.freeze({ slug: "hot-loop-equivalence-evidence",
    intent: "Record allocation, behavior and deltaTime equivalence evidence for the hot-loop fishing cluster before it is frozen.",
    checks: ["focused allocation-equivalence probe", "focused deltaTime-equivalence probe",
      "game-cycle-check fight scenarios", "no compatibility lookup in the hot loop"] }),
  "collection-identity-unproven": Object.freeze({ slug: "collection-identity-evidence",
    intent: "Prove or restructure collection state identity where the reviewed collection proof fails.",
    checks: ["StageThreeStateIdentityReview on the reviewed collection", "focused persistence round-trip"] }),
});

class PostFreezePrerequisiteBacklogBuilder {
  constructor({ profile = STAGE_3_22 } = {}) {
    this.profile = profile;
  }

  build({ eligibility, evidence, unifiedGraph, providerAmbiguities, readSource, sourceExists }) {
    const records = new Map(eligibility.records.map(record => [record.currentPath, record]));
    const modules = new Map(eligibility.modules.map(module => [module.currentPath, module]));
    const open = [...records.values()].filter(record => record.category !== "candidate");
    const pending = new Map();
    for (const record of open) {
      for (const prerequisite of record.eligibility.prerequisites) {
        if (BACKLOG_KINDS.has(prerequisite.kind)) {
          pending.set(`${record.currentPath}\u0000${prerequisite.id}`, { owner: record.currentPath, prerequisite });
        }
      }
    }
    const tasks = [];
    const resolvedTaskIds = [];
    for (const definition of GRAPH_TASKS) {
      const covered = [...pending.values()].filter(item => this.#matches(definition.match, item));
      // A repeated review records the tasks that earlier prerequisite transitions resolved.
      if (covered.length === 0 && this.profile.completedFromPlanSource) {
        resolvedTaskIds.push(`${this.profile.taskPrefix}${definition.slug}`);
        continue;
      }
      if (covered.length === 0) {
        throw new Error(`Reviewed prerequisite task matches no open prerequisite: ${definition.slug}`);
      }
      covered.forEach(item => pending.delete(`${item.owner}\u0000${item.prerequisite.id}`));
      const owners = unique(covered.map(item => item.owner));
      const provider = definition.match.module;
      const consumers = this.#consumers(unifiedGraph, provider, definition.symbols);
      tasks.push({
        id: `${this.profile.taskPrefix}${definition.slug}`,
        kind: definition.kind,
        graphChanging: true,
        status: "open",
        intent: definition.intent,
        prerequisiteIds: unique(covered.map(item => item.prerequisite.id)),
        provider,
        symbols: [...definition.symbols],
        configSymbols: definition.configSymbols ? [...definition.configSymbols] : [],
        modules: owners,
        unblocksCandidates: this.#unblocks(owners, records),
        affectedConsumers: consumers,
        compositionCallSites: definition.kind === "config-injection"
          ? this.#callSites(unique([provider, ...consumers]), definition.symbols[0], readSource, sourceExists) : [],
        targetBoundaries: { ...definition.targetBoundaries },
        compatibilityRequirements: [...definition.compatibility],
        checks: [...definition.checks],
        graphReviewRepeatCondition: { trigger: definition.graphTrigger, action: graphReviewRepeat(this.profile.stage) },
      });
    }
    const deferred = open.filter(record => record.category === "deferred");
    const groupByArea = new Map(DECOMPOSITION_GROUPS.flatMap(group => group.areas.map(area => [area, group])));
    for (const record of deferred) {
      if (!groupByArea.has(record.targetArea)) {
        throw new Error(`Deferred module has no reviewed decomposition group: ${record.currentPath}`);
      }
    }
    for (const group of DECOMPOSITION_GROUPS) {
      const members = deferred.filter(record => group.areas.includes(record.targetArea));
      // A repeated review records the decomposition groups that earlier prerequisite transitions resolved.
      if (members.length === 0 && this.profile.completedFromPlanSource) {
        resolvedTaskIds.push(`${this.profile.taskPrefix}${group.slug}`);
        continue;
      }
      if (members.length === 0) throw new Error(`Decomposition group is empty: ${group.slug}`);
      const memberPaths = new Set(members.map(record => record.currentPath));
      const covered = [...pending.values()].filter(item => memberPaths.has(item.owner));
      covered.forEach(item => pending.delete(`${item.owner}\u0000${item.prerequisite.id}`));
      const related = tasks.filter(task => task.modules.some(item => memberPaths.has(item))).map(task => task.id);
      const blockers = unique(members.flatMap(record => record.eligibility.reasonCodes));
      tasks.push({
        id: `${this.profile.taskPrefix}${group.slug}`,
        kind: "responsibility-decomposition",
        graphChanging: true,
        status: "open",
        intent: group.intent,
        prerequisiteIds: unique(covered.map(item => item.prerequisite.id)),
        modules: members.map(record => ({
          currentPath: record.currentPath,
          targetPath: record.targetPath,
          reasonCodes: [...record.eligibility.reasonCodes],
          historicalCoverage: record.historicalCoverage,
        })).sort((left, right) => compare(left.currentPath, right.currentPath)),
        relatedPrerequisiteTaskIds: related.sort(compare),
        affectedConsumers: unique(members.flatMap(record =>
          modules.get(record.currentPath).dependencyAudit.facts.reverseConsumers.map(item => item.source))),
        ambiguousProviders: providerAmbiguities.filter(item => item.modules.some(path => memberPaths.has(path))),
        targetBoundaries: {
          domainTargets: members.map(record => record.targetPath).sort(compare),
          extractedResponsibilities: unique(blockers.filter(code => BLOCKER_BOUNDARIES[code])
            .map(code => `${code}->${BLOCKER_BOUNDARIES[code]}`)),
        },
        compatibilityRequirements: [
          "Each decomposition is a separate reviewed task; it is never combined with a module migration.",
          "Legacy globals of unmigrated consumers stay available through reviewed bridges only.",
          "Gameplay formulas, state semantics, save format and timing stay unchanged.",
        ],
        checks: ["focused parity for every decomposed responsibility", "check:architecture", "check:quick",
          "game-cycle-check"],
        graphReviewRepeatCondition: {
          trigger: "A decomposition removes a deferral blocker or changes the Domain dependency graph.",
          action: graphReviewRepeat(this.profile.stage),
        },
      });
    }
    if (pending.size > 0) {
      throw new Error(`Prerequisites without a backlog task: ${[...pending.keys()].map(key => key.replace("\u0000", " ")).join(", ")}`);
    }
    tasks.push(...this.#evidenceTasks(evidence));
    const result = this.#coverage(tasks, open, eligibility);
    return this.profile.completedFromPlanSource ? { ...result, resolvedTaskIds } : result;
  }

  #matches(match, item) {
    if (item.prerequisite.kind !== match.kind) return false;
    return match.kind === "config-di" ? item.owner === match.module : item.prerequisite.module === match.module;
  }

  #unblocks(owners, records) {
    const unblocked = new Set(owners.filter(path => records.get(path).category === "prerequisite-blocked"));
    let changed = true;
    while (changed) {
      changed = false;
      for (const record of records.values()) {
        if (unblocked.has(record.currentPath) || record.category !== "prerequisite-blocked") continue;
        if (record.blockedBy.modules.some(path => unblocked.has(path))) {
          unblocked.add(record.currentPath);
          changed = true;
        }
      }
    }
    return unique([...unblocked]);
  }

  #consumers(unifiedGraph, provider, symbols) {
    return unique(unifiedGraph.edges.filter(edge => edge.target === provider &&
      edge.provenance.some(item => (item.symbols || []).some(symbol => symbols.includes(symbol))))
      .map(edge => edge.source));
  }

  #callSites(files, symbol, readSource, sourceExists) {
    const sites = [];
    for (const file of files.filter(sourceExists)) {
      const source = readSource(file);
      let tree;
      try {
        tree = espree.parse(source, { ecmaVersion: "latest", sourceType: "script", loc: true });
      } catch {
        tree = espree.parse(source, { ecmaVersion: "latest", sourceType: "module", loc: true });
      }
      const parents = [];
      estraverse.traverse(tree, {
        fallback: "iteration",
        enter(node) {
          if (node.type === "NewExpression" && node.callee.type === "Identifier" && node.callee.name === symbol) {
            const defaulted = parents.some(parent => parent.type === "AssignmentPattern");
            sites.push({ path: file, location: position(node),
              context: defaulted ? "default-parameter-global-default" : "explicit-composition" });
          }
          parents.push(node);
        },
        leave() { parents.pop(); },
      });
    }
    return sites.sort((left, right) => compare(`${left.path}\u0000${left.location}`,
      `${right.path}\u0000${right.location}`));
  }

  #evidenceTasks(evidence) {
    const byTask = new Map();
    for (const record of evidence.filter(item => item.category === "candidate" && item.verdict !== "sufficient")) {
      for (const finding of record.findings) {
        const key = finding.split(":")[0];
        const definition = EVIDENCE_TASKS[key];
        if (!definition) throw new Error(`Unclassified freeze evidence finding: ${record.currentPath} ${finding}`);
        if (!byTask.has(definition.slug)) byTask.set(definition.slug, { definition, modules: new Set(), findings: new Set() });
        byTask.get(definition.slug).modules.add(record.currentPath);
        byTask.get(definition.slug).findings.add(`${record.currentPath}:${finding}`);
      }
    }
    return [...byTask.values()].sort((left, right) => compare(left.definition.slug, right.definition.slug))
      .map(({ definition, modules, findings }) => ({
        id: `${this.profile.taskPrefix}${definition.slug}`,
        kind: "freeze-evidence",
        graphChanging: false,
        status: "open",
        intent: definition.intent,
        modules: [...modules].sort(compare),
        findings: [...findings].sort(compare),
        checks: [...definition.checks],
        graphReviewRepeatCondition: {
          trigger: "Only if collecting the evidence changes source or the dependency graph.",
          action: `Repeat the Stage ${this.profile.stage} freeze review for the affected clusters; repeat the graph review when the trigger applies.`,
        },
      }));
  }

  #coverage(tasks, open, eligibility) {
    const ids = tasks.map(task => task.id);
    if (new Set(ids).size !== ids.length) throw new Error("Prerequisite backlog contains duplicate task ids");
    const prerequisiteOwners = new Map();
    for (const task of tasks) {
      for (const id of task.prerequisiteIds || []) {
        if (prerequisiteOwners.has(id)) {
          throw new Error(`Prerequisite is covered by two tasks: ${id}`);
        }
        prerequisiteOwners.set(id, task.id);
      }
    }
    const blocked = open.filter(record => record.category === "prerequisite-blocked");
    const deferred = open.filter(record => record.category === "deferred");
    const moduleTasks = path => tasks.filter(task => (task.modules || []).some(item =>
      (typeof item === "string" ? item : item.currentPath) === path) ||
      (task.unblocksCandidates || []).includes(path)).map(task => task.id).sort(compare);
    const blockedCoverage = blocked.map(record => ({ currentPath: record.currentPath, taskIds: moduleTasks(record.currentPath) }));
    const deferredCoverage = deferred.map(record => ({ currentPath: record.currentPath,
      taskIds: moduleTasks(record.currentPath).filter(id => tasks.find(task => task.id === id).kind === "responsibility-decomposition") }));
    for (const item of blockedCoverage) {
      if (item.taskIds.length === 0) throw new Error(`Blocked module has no prerequisite task: ${item.currentPath}`);
    }
    for (const item of deferredCoverage) {
      if (item.taskIds.length !== 1) throw new Error(`Deferred module must belong to exactly one decomposition task: ${item.currentPath}`);
    }
    return {
      tasks,
      coverage: {
        prerequisiteBlocked: blockedCoverage.sort((left, right) => compare(left.currentPath, right.currentPath)),
        deferred: deferredCoverage.sort((left, right) => compare(left.currentPath, right.currentPath)),
        uncoveredPrerequisites: [],
      },
      summary: {
        taskCount: tasks.length,
        graphChangingTaskCount: tasks.filter(task => task.graphChanging).length,
        evidenceTaskCount: tasks.filter(task => !task.graphChanging).length,
        prerequisiteBlockedModuleCount: blocked.length,
        deferredModuleCount: deferred.length,
        candidateModuleCount: eligibility.summary.candidate,
      },
    };
  }
}

module.exports = { PostFreezePrerequisiteBacklogBuilder, GRAPH_TASKS, DECOMPOSITION_GROUPS, EVIDENCE_TASKS };
