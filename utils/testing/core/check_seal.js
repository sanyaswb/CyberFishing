"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

// Raise SEAL_SCHEMA whenever seal semantics become stricter; changes that only drop non-inputs keep it.
const SEAL_SCHEMA = 1;
// Informational documents never influence a result (history replays use their frozen copy), so
// editing them never invalidates a seal.
const { INFORMATIONAL_DOCUMENTS } = require("../../architecture/informational_documents");
const TRACER = path.join(__dirname, "check_input_tracer.js");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");

// Current fingerprints of project inputs, computed once per path and run.
class CheckInputFingerprints {
  constructor(root) {
    this.root = path.resolve(root);
    this.cache = new Map();
  }

  absolute(relative) { return path.join(this.root, ...relative.split("/")); }

  value(kind, relative) {
    const key = `${kind}\0${relative}`;
    if (!this.cache.has(key)) this.cache.set(key, this.#compute(kind, relative));
    return this.cache.get(key);
  }

  #compute(kind, relative) {
    const file = this.absolute(relative);
    let stat = null;
    try { stat = fs.statSync(file); } catch { stat = null; }
    if (kind === "probe") return stat ? (stat.isDirectory() ? "directory" : "file") : "absent";
    if (!stat) return "absent";
    if (kind === "read") return stat.isDirectory() ? "directory" : sha(fs.readFileSync(file));
    if (kind === "list") return stat.isDirectory() ? sha(fs.readdirSync(file).sort().join("\n")) : "not-a-directory";
    if (kind === "tree") return stat.isDirectory() ? this.#tree(file) : sha(fs.readFileSync(file));
    throw new Error(`Unknown input kind: ${kind}`);
  }

  #tree(directory) {
    const entries = [];
    const walk = current => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const child = path.join(current, entry.name);
        const relative = path.relative(directory, child).replaceAll("\\", "/");
        if (relative === "node_modules" || relative === ".git") continue;
        if (entry.isDirectory()) walk(child);
        else if (entry.isFile()) entries.push(`${relative}\0${sha(fs.readFileSync(child))}`);
      }
    };
    walk(directory);
    return sha(entries.join("\n"));
  }
}

// A content-addressed record that a check passed for exactly these inputs and this environment.
class CheckSeal {
  static environment(root) {
    const lock = path.join(root, "package-lock.json");
    return {
      schema: SEAL_SCHEMA,
      node: process.version,
      platform: process.platform,
      lockfileSha256: fs.existsSync(lock) ? sha(fs.readFileSync(lock)) : null,
      tracerSha256: sha(fs.readFileSync(TRACER)),
    };
  }

  static identity(check) { return { id: check.id, file: check.file, args: [...(check.args || [])] }; }

  // Written paths are outputs, not inputs; git facts are re-evaluated by command.
  static build({ root, check, trace, fingerprints, durationMs }) {
    const entries = trace.split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line));
    const writes = [...new Set(entries.filter(entry => entry.kind === "write").map(entry => entry.path))].sort();
    const written = new Set(writes);
    const underWritten = relative => writes.some(item => relative === item || relative.startsWith(`${item}/`));
    const inputs = [];
    const seen = new Set();
    for (const entry of entries) {
      if (entry.kind === "write" || entry.kind === "git") continue;
      if (INFORMATIONAL_DOCUMENTS.includes(entry.path)) continue;
      if (written.has(entry.path) || underWritten(entry.path)) continue;
      const key = `${entry.kind}\0${entry.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      inputs.push({ kind: entry.kind, path: entry.path, value: fingerprints.value(entry.kind, entry.path) });
    }
    inputs.sort((a, b) => `${a.kind}\0${a.path}`.localeCompare(`${b.kind}\0${b.path}`));
    const git = entries.filter(entry => entry.kind === "git").map(entry => ({ args: entry.args, sha256: entry.sha256 }));
    return {
      check: CheckSeal.identity(check), environment: CheckSeal.environment(root),
      inputs, git, writes, durationMs, sealedAt: new Date().toISOString(),
    };
  }

  // Returns null when the seal still holds, or the first reason it does not.
  static invalidation({ root, check, seal, fingerprints, git }) {
    if (!seal) return "no seal";
    if (JSON.stringify(seal.check) !== JSON.stringify(CheckSeal.identity(check))) return "check definition changed";
    if (JSON.stringify(seal.environment) !== JSON.stringify(CheckSeal.environment(root))) return "environment changed";
    for (const input of seal.inputs) {
      if (fingerprints.value(input.kind, input.path) !== input.value) return `${input.kind} changed: ${input.path}`;
    }
    for (const fact of seal.git) {
      if (git(fact.args) !== fact.sha256) return `git output changed: git ${fact.args.join(" ")}`;
    }
    return null;
  }
}

class CheckSealStore {
  constructor(root, directory = path.join(root, "node_modules", ".cache", "cyber-check-seals")) {
    this.directory = directory;
  }

  file(check) { return path.join(this.directory, `${check.id}.json`); }

  load(check) {
    try { return JSON.parse(fs.readFileSync(this.file(check), "utf8")); } catch { return null; }
  }

  save(check, seal) {
    fs.mkdirSync(this.directory, { recursive: true });
    const target = this.file(check);
    fs.writeFileSync(`${target}.tmp`, `${JSON.stringify(seal)}\n`);
    fs.renameSync(`${target}.tmp`, target);
  }

  remove(check) { fs.rmSync(this.file(check), { force: true }); }
}

module.exports = { CheckInputFingerprints, CheckSeal, CheckSealStore, TRACER };
