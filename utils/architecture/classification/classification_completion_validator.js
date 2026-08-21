class ClassificationCompletionValidator {
  validate(manifest) {
    const modules = Array.isArray(manifest?.modules) ? manifest.modules : [];
    const errors = [];
    const targetPaths = new Map();
    let blockerCount = 0;

    if (modules.length === 0) errors.push("manifest modules must not be empty");
    for (const entry of modules) {
      const path = entry.currentPath || "<unknown module>";
      const architecture = entry.architecture || {};
      const blockers = entry.analysis?.blockers || {};
      if (architecture.migrationStatus !== "classified") {
        errors.push(`${path} is not classified`);
      }
      if (!Array.isArray(architecture.roles) || architecture.roles.length === 0) {
        errors.push(`${path} has no reviewed roles`);
      }
      if (!architecture.targetBoundary) {
        errors.push(`${path} has no reviewed targetBoundary`);
      }
      if (!architecture.targetPath) {
        errors.push(`${path} has no reviewed targetPath`);
      } else if (targetPaths.has(architecture.targetPath)) {
        errors.push(
          `${path} duplicates targetPath owned by ${targetPaths.get(architecture.targetPath)}`,
        );
      } else {
        targetPaths.set(architecture.targetPath, path);
      }
      if (!Number.isInteger(architecture.migrationWave)) {
        errors.push(`${path} has no reviewed migrationWave`);
      }
      if (blockers.status !== "verified" || !Array.isArray(blockers.items)) {
        errors.push(`${path} has no reviewed blockers decision`);
      } else if (blockers.items.length > 0) {
        blockerCount += 1;
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Stage 1.6 classification completion failed:\n- ${errors.join("\n- ")}`,
      );
    }

    return Object.freeze({
      classifiedCount: modules.length,
      blockerCount,
      targetPathCount: targetPaths.size,
    });
  }
}

module.exports = { ClassificationCompletionValidator };
