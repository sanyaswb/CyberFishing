"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

// Owner decision (2026-09-26): refactor_Task.txt and FORCODEX.md are informational documents.
// They are edited freely and no check reads their live bytes. The release history pinned
// refactor_Task.txt up to v0.24.62; the freeze artifact holds those exact bytes so every
// historical replay reconstructs them without reading the live document.
const INFORMATIONAL_DOCUMENTS = Object.freeze(["FORCODEX.md", "refactor_Task.txt"]);
const FREEZE = "architecture/migration/stage_3_informational_documents_freeze.json";
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

class InformationalDocumentFreeze {
  constructor(root) { this.root = path.resolve(root); }

  exists() { return fs.existsSync(path.join(this.root, FREEZE)); }

  document() {
    const freeze = JSON.parse(fs.readFileSync(path.join(this.root, FREEZE)));
    assert.equal(freeze.schemaVersion, 1);
    assert.equal(freeze.kind, "cyber-fishing-informational-documents-freeze");
    assert.deepEqual(freeze.informationalDocuments, INFORMATIONAL_DOCUMENTS);
    for (const record of freeze.pinnedDocuments) {
      assert(INFORMATIONAL_DOCUMENTS.includes(record.path), `Pinned document is not informational: ${record.path}`);
      assert.equal(sha(Buffer.from(record.base64, "base64")), record.sha256, `Frozen bytes differ: ${record.path}`);
    }
    return freeze;
  }

  // The last release-pinned bytes of an informational document, or null when it was never pinned.
  pinned(file) {
    if (!this.exists()) return null;
    const record = this.document().pinnedDocuments.find(item => item.path === file);
    return record ? Buffer.from(record.base64, "base64") : null;
  }

  // Replaces live informational documents under a historical workspace root with their pinned
  // bytes and removes the freeze artifact there, so older layers replay the pinned history.
  restore(workspaceRoot) {
    const freeze = new InformationalDocumentFreeze(workspaceRoot);
    if (!freeze.exists()) return;
    for (const record of freeze.document().pinnedDocuments) {
      fs.writeFileSync(path.join(workspaceRoot, record.path), Buffer.from(record.base64, "base64"));
    }
    fs.unlinkSync(path.join(workspaceRoot, FREEZE));
  }

  static record({ root, frozenAfterRelease }) {
    const bytes = fs.readFileSync(path.join(root, "refactor_Task.txt"));
    return {
      schemaVersion: 1,
      kind: "cyber-fishing-informational-documents-freeze",
      decision: "owner-2026-09-26-informational-documents-excluded-from-checks",
      informationalDocuments: [...INFORMATIONAL_DOCUMENTS],
      frozenAfterRelease,
      pinnedDocuments: [{ path: "refactor_Task.txt", sha256: sha(bytes), base64: bytes.toString("base64") }],
    };
  }
}

module.exports = { FREEZE, INFORMATIONAL_DOCUMENTS, InformationalDocumentFreeze };
