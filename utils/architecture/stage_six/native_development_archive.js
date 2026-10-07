"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const cp = require("node:child_process");

const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

// Hash-validated raw recovery of the tree retired by Stage 6 preparation 005. Historical assertions read
// these exact bytes (mixed EOL preserved by raw blobs); the live tree is never a substitute for them.
class NativeDevelopmentArchive {
  #root;
  #record;
  #pins = new Map();
  #bytes = new Map();
  #identityVerified = false;

  constructor(projectRoot, record) {
    this.#root = projectRoot;
    this.#record = record;
    for (const pin of [...record.removedModules, ...record.historicalMetadata, record.historicalHtml]) {
      assert(!this.#pins.has(pin.path), "archive duplicate pin: " + pin.path);
      this.#pins.set(pin.path, { before: pin.before, gitBlob: pin.gitBlob });
    }
  }

  get record() { return this.#record; }

  has(file) { return this.#pins.has(file); }

  // Annotated tag -> peeled recovery commit -> accepted Stage 6 implementation base.
  verifyIdentity() {
    if (this.#identityVerified) return this;
    const { archiveTag, archiveCommit } = this.#record.postClosureCleanup;
    assert.equal(this.#git(["cat-file", "-t", archiveTag]).toString().trim(), "tag", "archive tag must be annotated");
    assert.equal(this.#git(["rev-parse", archiveTag + "^{commit}"]).toString().trim(), archiveCommit, "archive peeled commit");
    assert.equal(this.#git(["rev-parse", archiveCommit + "^"]).toString().trim(), this.#record.baseCommit, "archive parent");
    assert.equal(this.#git(["rev-list", "--parents", "-n", "1", archiveCommit]).toString().trim().split(" ").length, 2,
      "archive commit has exactly one parent");
    this.#identityVerified = true;
    return this;
  }

  // Every pinned path: recorded blob is the archive tree entry and its raw bytes have the recorded SHA256.
  verifyAll() {
    this.verifyIdentity();
    const tree = new Map(this.#git(["ls-tree", "-r", "-z", this.#record.postClosureCleanup.archiveCommit]).toString("utf8")
      .split("\0").filter(Boolean).map(line => { const [meta, file] = line.split("\t"); return [file, meta.split(" ")[2]]; }));
    for (const [file, pin] of this.#pins) assert.equal(tree.get(file), pin.gitBlob, "archive tree blob: " + file);
    const pending = [...this.#pins].filter(([file]) => !this.#bytes.has(file));
    const output = this.#git(["cat-file", "--batch"], pending.map(([, pin]) => pin.gitBlob).join("\n") + "\n");
    let offset = 0;
    for (const [file, pin] of pending) {
      const end = output.indexOf(10, offset);
      const [blob, type, size] = output.subarray(offset, end).toString("utf8").split(" ");
      assert(blob === pin.gitBlob && type === "blob", "archive blob identity: " + file);
      const bytes = output.subarray(end + 1, end + 1 + Number(size));
      assert.equal(hash(bytes), pin.before, "archive recovery hash: " + file);
      this.#bytes.set(file, bytes);
      offset = end + 2 + Number(size);
    }
    assert.equal(offset, output.length, "archive batch output fully consumed");
    return this.#pins.size;
  }

  bytes(file) {
    const pin = this.#pins.get(file);
    assert(pin, "archive has no recorded pin: " + file);
    if (!this.#bytes.has(file)) {
      this.verifyIdentity();
      assert.equal(this.#git(["rev-parse", this.#record.postClosureCleanup.archiveCommit + ":" + file]).toString().trim(),
        pin.gitBlob, "archive tree blob: " + file);
      const bytes = this.#git(["cat-file", "blob", pin.gitBlob]);
      assert.equal(hash(bytes), pin.before, "archive recovery hash: " + file);
      this.#bytes.set(file, bytes);
    }
    return this.#bytes.get(file);
  }

  text(file) { return this.bytes(file).toString("utf8"); }

  json(file) { return JSON.parse(this.text(file)); }

  #git(args, input) {
    return cp.execFileSync("git", args, { cwd: this.#root, maxBuffer: 64e6, input, stdio: ["pipe", "pipe", "pipe"] });
  }
}

module.exports = { NativeDevelopmentArchive };
