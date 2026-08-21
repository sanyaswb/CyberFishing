class MigrationBatchPlanValidator {
  constructor({ architecturePolicy }) {
    this.architecturePolicy = architecturePolicy;
  }

  validate({ plan, manifest }) {
    const errors = [];
    const modules = Array.isArray(manifest?.modules) ? manifest.modules : [];
    const entriesByPath = new Map(
      modules.map((entry) => [entry.currentPath, entry]),
    );
    const reverseConsumers = this.#buildReverseConsumers(modules);

    this.#require(plan?.schemaVersion === 1, "schemaVersion must be 1", errors);
    this.#require(plan?.stage === "1.6", "stage must be 1.6", errors);
    this.#require(
      plan?.status === "reviewed-candidates",
      "status must be reviewed-candidates",
      errors,
    );
    this.#require(
      plan?.sourceOfTruth ===
        "architecture/migration/module_migration_manifest.json",
      "sourceOfTruth must identify the migration manifest",
      errors,
    );

    const confirmedEdgeCount = modules.reduce(
      (count, entry) =>
        count +
        this.#confirmedDependencyTargets(entry).length,
      0,
    );
    this.#require(
      plan?.graphBaseline?.moduleCount === modules.length,
      "graphBaseline.moduleCount must match the manifest",
      errors,
    );
    this.#require(
      plan?.graphBaseline?.confirmedInterFileEdges === confirmedEdgeCount,
      "graphBaseline.confirmedInterFileEdges must match the manifest",
      errors,
    );

    const batches = Array.isArray(plan?.batches) ? plan.batches : [];
    this.#require(batches.length > 0, "batches must not be empty", errors);
    const batchIds = new Set();
    const plannedPaths = new Set();

    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index];
      this.#validateBatch({
        batch,
        expectedOrder: index + 1,
        entriesByPath,
        reverseConsumers,
        batchIds,
        plannedPaths,
        errors,
      });
    }

    if (errors.length > 0) {
      throw new Error(
        `Stage 1.6 migration batch plan failed:\n- ${errors.join("\n- ")}`,
      );
    }

    return Object.freeze({
      batchCount: batches.length,
      moduleCount: plannedPaths.size,
      confirmedInterFileEdges: confirmedEdgeCount,
    });
  }

  #validateBatch({
    batch,
    expectedOrder,
    entriesByPath,
    reverseConsumers,
    batchIds,
    plannedPaths,
    errors,
  }) {
    const label = batch?.id || `batch at order ${expectedOrder}`;
    this.#require(
      typeof batch?.id === "string" && batch.id.length > 0,
      `${label} requires id`,
      errors,
    );
    this.#require(!batchIds.has(batch?.id), `${label} id must be unique`, errors);
    batchIds.add(batch?.id);
    this.#require(
      batch?.order === expectedOrder,
      `${label} order must be ${expectedOrder}`,
      errors,
    );
    this.#require(
      batch?.readiness === "candidate",
      `${label} readiness must be candidate`,
      errors,
    );

    const boundary = this.architecturePolicy.getBoundary(batch?.targetBoundary);
    this.#require(!!boundary, `${label} has unknown targetBoundary`, errors);
    const modules = Array.isArray(batch?.modules) ? batch.modules : [];
    this.#require(modules.length > 0, `${label} modules must not be empty`, errors);
    this.#require(
      this.#isSorted(modules.map((module) => module.currentPath)),
      `${label} modules must be sorted by currentPath`,
      errors,
    );

    const batchPaths = new Set(modules.map((module) => module.currentPath));
    const actualOutgoing = new Set();
    for (const module of modules) {
      const entry = entriesByPath.get(module.currentPath);
      this.#require(!!entry, `${label} has unknown currentPath ${module.currentPath}`, errors);
      if (!entry) continue;
      this.#require(
        !plannedPaths.has(module.currentPath),
        `${module.currentPath} appears in more than one batch`,
        errors,
      );
      plannedPaths.add(module.currentPath);
      this.#validateModule({
        batch,
        module,
        entry,
        reverseConsumers,
        errors,
      });
      for (const target of this.#confirmedDependencyTargets(entry)) {
        if (!batchPaths.has(target)) actualOutgoing.add(target);
      }
    }

    const plannedOutgoing = this.#sortedUnique(
      batch?.confirmedOutgoingProjectDependencies,
    );
    this.#require(
      this.#sameArray(plannedOutgoing, [...actualOutgoing].sort()),
      `${label} confirmedOutgoingProjectDependencies must match the manifest`,
      errors,
    );
    this.#require(
      actualOutgoing.size === 0,
      `${label} is not dependency-safe: outgoing project dependencies remain`,
      errors,
    );

    const compatibility = batch?.compatibility;
    this.#require(
      compatibility?.mode === "temporary-legacy-global-bridge",
      `${label} must define its temporary legacy compatibility mode`,
      errors,
    );
    for (const field of ["reason", "owner", "removalStage", "stage1Action"]) {
      this.#require(
        typeof compatibility?.[field] === "string" &&
          compatibility[field].trim().length > 0,
        `${label} compatibility.${field} is required`,
        errors,
      );
    }
    this.#require(
      compatibility?.owner === batch?.id,
      `${label} compatibility.owner must equal the batch id`,
      errors,
    );
    this.#require(
      Array.isArray(batch?.gates) && batch.gates.length >= 4,
      `${label} requires at least four implementation gates`,
      errors,
    );
  }

  #validateModule({ batch, module, entry, reverseConsumers, errors }) {
    const path = module.currentPath;
    const architecture = entry.architecture || {};
    this.#require(
      architecture.migrationStatus === "classified",
      `${path} must be classified`,
      errors,
    );
    this.#require(
      architecture.targetBoundary === batch.targetBoundary,
      `${path} targetBoundary must match its batch`,
      errors,
    );
    this.#require(
      architecture.targetPath === module.targetPath,
      `${path} targetPath must match the manifest`,
      errors,
    );
    this.#require(
      architecture.migrationWave === batch.migrationWave,
      `${path} migrationWave must match its batch`,
      errors,
    );
    this.#require(
      entry.analysis?.blockers?.status === "verified" &&
        (entry.analysis.blockers.items || []).length === 0,
      `${path} must have verified empty blockers`,
      errors,
    );
    const resolvedBoundary = this.architecturePolicy.resolveBoundary(
      module.targetPath,
    );
    this.#require(
      resolvedBoundary?.id === batch.targetBoundary,
      `${path} targetPath must resolve to ${batch.targetBoundary}`,
      errors,
    );

    const providers = this.#sortedUnique(
      (entry.observed?.providers?.items || []).map((item) => item.symbol),
    );
    this.#require(
      this.#sameArray(this.#sortedUnique(module.providers), providers),
      `${path} providers must match observed provider facts`,
      errors,
    );
    const consumers = reverseConsumers.get(path) || [];
    this.#require(
      this.#sameArray(this.#sortedUnique(module.legacyConsumers), consumers),
      `${path} legacyConsumers must match derived reverse consumers`,
      errors,
    );
  }

  #buildReverseConsumers(modules) {
    const index = new Map();
    for (const entry of modules) {
      for (const target of this.#confirmedDependencyTargets(entry)) {
        if (target === entry.currentPath) continue;
        if (!index.has(target)) index.set(target, new Set());
        index.get(target).add(entry.currentPath);
      }
    }
    return new Map(
      [...index.entries()].map(([target, consumers]) => [
        target,
        [...consumers].sort(),
      ]),
    );
  }

  #confirmedDependencyTargets(entry) {
    return this.#sortedUnique(
      (entry.analysis?.dependencies?.items || [])
        .filter((item) => item.resolution === "confirmed")
        .map((item) => item.target)
        .filter((target) => target && target !== entry.currentPath),
    );
  }

  #sortedUnique(values) {
    return [...new Set(Array.isArray(values) ? values : [])].sort();
  }

  #isSorted(values) {
    return this.#sameArray(values, [...values].sort());
  }

  #sameArray(left, right) {
    return left.length === right.length &&
      left.every((value, index) => value === right[index]);
  }

  #require(condition, message, errors) {
    if (!condition) errors.push(message);
  }
}

module.exports = { MigrationBatchPlanValidator };
