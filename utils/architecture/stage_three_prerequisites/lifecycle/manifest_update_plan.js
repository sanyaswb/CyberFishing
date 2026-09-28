"use strict";

const assert = require("node:assert/strict");

const UPDATE_KEYS = Object.freeze(["architecture", "currentPath", "removedBlockers"]);
const RECLASSIFIABLE = Object.freeze(["roles", "targetBoundary", "targetPath"]);
const REMOVAL_KEYS = Object.freeze(["blocker", "reason"]);
const clone = value => JSON.parse(JSON.stringify(value));
const sameKeys = (value, allowed) => Object.keys(value).every(key => allowed.includes(key));

// Reviewed classification updates of existing Manifest entries whose sources the same prerequisite
// transition edits. Only reclassification (roles, target boundary, target path) and the removal of
// reviewed blockers, each with its reason, are allowed. Adding a blocker, changing any other field
// (currentPath, legacyLoadOrder, migration status or wave) or touching a module outside the
// transition's source edits is refused. The record keeps the exact before/after of every entry.
class PrerequisiteManifestUpdatePlan {
  #updates;
  #editedPaths;

  constructor(updates, { editedPaths }) {
    assert(Array.isArray(updates) && updates.length > 0, "manifest updates must be a non-empty list");
    this.#editedPaths = new Set(editedPaths);
    const paths = new Set();
    this.#updates = updates.map(update => {
      assert(update && typeof update === "object" && sameKeys(update, UPDATE_KEYS),
        `manifest update has unsupported fields: ${Object.keys(update || {}).join(", ")}`);
      assert(typeof update.currentPath === "string" && !paths.has(update.currentPath),
        `manifest update path is missing or duplicated: ${update.currentPath}`);
      paths.add(update.currentPath);
      assert(this.#editedPaths.has(update.currentPath),
        `manifest update outside the transition's source edits: ${update.currentPath}`);
      const architecture = update.architecture ?? {};
      assert(architecture && typeof architecture === "object" && !Array.isArray(architecture) &&
        sameKeys(architecture, RECLASSIFIABLE),
      `manifest update may only reclassify ${RECLASSIFIABLE.join(", ")}: ${update.currentPath}`);
      if ("roles" in architecture) {
        assert(Array.isArray(architecture.roles) && architecture.roles.length > 0 &&
          architecture.roles.every(role => typeof role === "string" && role), `invalid roles: ${update.currentPath}`);
      }
      for (const key of ["targetBoundary", "targetPath"]) {
        if (key in architecture) assert(typeof architecture[key] === "string" && architecture[key], `invalid ${key}`);
      }
      if ("targetPath" in architecture) assert.match(architecture.targetPath, /^src\/.+\.js$/u, "invalid targetPath");
      const removedBlockers = update.removedBlockers ?? [];
      assert(Array.isArray(removedBlockers), `removed blockers must be a list: ${update.currentPath}`);
      const blockers = new Set();
      for (const removal of removedBlockers) {
        assert(removal && typeof removal === "object" && sameKeys(removal, REMOVAL_KEYS),
          `blocker removal has unsupported fields: ${update.currentPath}`);
        assert(typeof removal.blocker === "string" && removal.blocker && !blockers.has(removal.blocker),
          `blocker removal is missing or duplicated: ${update.currentPath}`);
        assert(typeof removal.reason === "string" && removal.reason.trim().length > 0,
          `blocker removal needs a reason: ${update.currentPath} ${removal.blocker}`);
        blockers.add(removal.blocker);
      }
      assert(Object.keys(architecture).length > 0 || removedBlockers.length > 0,
        `manifest update changes nothing: ${update.currentPath}`);
      return Object.freeze({ currentPath: update.currentPath, architecture: clone(architecture),
        removedBlockers: clone(removedBlockers) });
    });
  }

  // The manifest with the reviewed updates applied (the input is not changed).
  apply(manifest) {
    const byPath = new Map(this.#updates.map(update => [update.currentPath, update]));
    const found = new Set();
    const modules = manifest.modules.map(module => {
      const update = byPath.get(module.currentPath);
      if (!update) return module;
      found.add(module.currentPath);
      const current = module.analysis?.blockers?.items ?? [];
      for (const removal of update.removedBlockers) {
        assert(current.includes(removal.blocker),
          `blocker ${removal.blocker} is not recorded for ${module.currentPath}`);
      }
      for (const [key, value] of Object.entries(update.architecture)) {
        assert.notDeepEqual(module.architecture?.[key], value, `reclassification changes nothing: ${module.currentPath} ${key}`);
      }
      const removed = new Set(update.removedBlockers.map(removal => removal.blocker));
      return { ...module, architecture: { ...module.architecture, ...clone(update.architecture) },
        analysis: { ...module.analysis, blockers: { ...module.analysis.blockers,
          items: current.filter(blocker => !removed.has(blocker)) } } };
    });
    for (const update of this.#updates) {
      assert(found.has(update.currentPath), `manifest update names an unknown module: ${update.currentPath}`);
    }
    return { ...manifest, modules };
  }

  // Record entries: the exact classification and blockers before and after, with every reason.
  records(oldManifest, newManifest) {
    const entry = (document, currentPath) => document.modules.find(module => module.currentPath === currentPath);
    return this.#updates.map(update => {
      const before = entry(oldManifest, update.currentPath);
      const after = entry(newManifest, update.currentPath);
      return { currentPath: update.currentPath,
        before: { architecture: clone(before.architecture), blockers: clone(before.analysis.blockers.items) },
        after: { architecture: clone(after.architecture), blockers: clone(after.analysis.blockers.items) },
        removedBlockers: clone(update.removedBlockers) };
    });
  }

  // The re-observed manifest keeps every old entry's identity, classification and blockers except
  // the reviewed updates, which it carries exactly; no blocker is ever added.
  verify(oldManifest, newManifest) {
    const planned = this.apply(oldManifest);
    const byPath = document => new Map(document.modules.map(module => [module.currentPath, module]));
    const expected = byPath(planned);
    const actual = byPath(newManifest);
    for (const [currentPath, module] of byPath(oldManifest)) {
      const next = actual.get(currentPath);
      assert(next, `module disappeared from the Manifest: ${currentPath}`);
      assert.equal(next.observed?.legacyLoadOrder, module.observed?.legacyLoadOrder, `legacyLoadOrder changed: ${currentPath}`);
      assert.deepEqual(next.architecture, expected.get(currentPath).architecture, `classification changed: ${currentPath}`);
      assert.deepEqual(next.analysis?.blockers, expected.get(currentPath).analysis?.blockers, `blockers changed: ${currentPath}`);
      const before = new Set(module.analysis?.blockers?.items ?? []);
      assert((next.analysis?.blockers?.items ?? []).every(blocker => before.has(blocker)), `blocker added: ${currentPath}`);
    }
    return true;
  }
}

module.exports = { PrerequisiteManifestUpdatePlan };
