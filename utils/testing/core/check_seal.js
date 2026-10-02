"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

// Seal schema 2: explicit cache policies, full observation records, reviewed coverage and tooling
// identity. Schema-1, malformed or incomplete seals are cache misses.
const SEAL_SCHEMA = 2;
const TRACER = path.join(__dirname, "check_input_tracer.js");
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
// Implementation files whose behavior decides whether a cached PASS is still valid.
const TOOLING = Object.freeze([
  "utils/run-checks.js", "utils/testing/core/check_catalog.js", "utils/testing/core/check_runner.js",
  "utils/testing/core/check_seal.js", "utils/testing/core/check_input_tracer.js", "utils/testing/core/check_report.js",
]);
// Traced reads under these trees are code or installed dependencies: they are covered and each one
// is fingerprinted individually (module loads, helper files, dependency content).
const CODE_TREES = Object.freeze(["utils", "node_modules"]);
const GIT = process.platform === "win32" ? "C:/Program Files/Git/cmd/git.exe" : "git";
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const canonical = value => JSON.stringify(value, (key, item) => (typeof item === "bigint" ? String(item) : item));
const within = (child, parent) => parent === "." || child === parent || child.startsWith(`${parent}/`);

// Explicit, immutable cache policy of one check. `never` (default): the check always executes.
// `snapshot`: a PASS may be reused while the reviewed input trees, every traced observation, the
// check definition, the environment and the tooling are unchanged.
class CheckCachePolicy {
  static of(definition) {
    const cache = definition.cache || { policy: "never" };
    if (cache.policy === "never") return Object.freeze({ policy: "never" });
    if (cache.policy !== "snapshot") throw new Error(`Unknown cache policy for ${definition.id}: ${cache.policy}`);
    const inputPaths = [...new Set(cache.inputPaths || [])].sort();
    const environmentKeys = [...new Set(cache.environmentKeys || [])].sort();
    if (inputPaths.length === 0) throw new Error(`Snapshot cache policy needs inputPaths: ${definition.id}`);
    for (const item of inputPaths) {
      if (typeof item !== "string" || !item || item.includes("\\") || path.isAbsolute(item) ||
        item.split("/").some(part => part === ".." || part === "")) {
        throw new Error(`Invalid cache input path for ${definition.id}: ${item}`);
      }
    }
    if (environmentKeys.some(key => typeof key !== "string" || !key)) {
      throw new Error(`Invalid cache environment key for ${definition.id}`);
    }
    return Object.freeze({ policy: "snapshot", inputPaths: Object.freeze(inputPaths),
      environmentKeys: Object.freeze(environmentKeys) });
  }
}

// Current values of reviewed trees and traced observations under one execution root. Values are
// memoized per epoch; the runner starts a new epoch whenever a check may have written files.
class CheckObservationValues {
  constructor(root) {
    this.root = path.resolve(root);
    this.memo = new Map();
  }

  invalidate() { this.memo.clear(); }

  // Root-relative paths, or "external:<absolute path>" for probes outside the root.
  absolute(relative) {
    if (relative.startsWith("external:")) return path.resolve(relative.slice("external:".length));
    return relative === "." ? this.root : path.join(this.root, ...relative.split("/"));
  }

  // A resolved path as the tracer records it: root-relative, node_modules-relative through the real
  // path of a linked node_modules (history base), or "external".
  #resolved(absolute) {
    const under = (parent) => {
      const relative = path.relative(parent, absolute);
      return relative.startsWith("..") || path.isAbsolute(relative) ? null : relative.replaceAll("\\", "/");
    };
    const inside = under(this.root);
    if (inside !== null) return /^node_modules\/\.cache(\/|$)/u.test(inside) ? "external" : inside || ".";
    if (this.modules === undefined) {
      try { this.modules = fs.realpathSync(path.join(this.root, "node_modules")); } catch { this.modules = null; }
    }
    const dependency = this.modules === null ? null : under(this.modules);
    if (dependency === null) return "external";
    const relative = dependency ? `node_modules/${dependency}` : "node_modules";
    return /^node_modules\/\.cache(\/|$)/u.test(relative) ? "external" : relative;
  }

  #memo(key, compute) {
    if (!this.memo.has(key)) this.memo.set(key, compute());
    return this.memo.get(key);
  }

  static metadata(stats) {
    return {
      type: stats.isFile() ? "file" : stats.isDirectory() ? "directory" : stats.isSymbolicLink() ? "symlink" : "other",
      dev: String(stats.dev), ino: String(stats.ino), mode: String(stats.mode), nlink: String(stats.nlink),
      uid: String(stats.uid), gid: String(stats.gid), size: String(stats.size),
      mtimeMs: String(stats.mtimeMs), ctimeMs: String(stats.ctimeMs), birthtimeMs: String(stats.birthtimeMs),
    };
  }

  static code(error) { return (error && error.code) || (error && error.name) || "error"; }

  // Names, types and bytes of a complete subtree (runner caches excluded).
  tree(relative) {
    return this.#memo(`tree\0${relative}`, () => {
      const base = this.absolute(relative);
      let stats;
      try { stats = fs.statSync(base); } catch (error) { return `error:${CheckObservationValues.code(error)}`; }
      if (!stats.isDirectory()) return `file:${sha(fs.readFileSync(base))}`;
      const lines = [];
      const walk = (directory, prefix) => {
        const entries = fs.readdirSync(directory, { withFileTypes: true })
          .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
        for (const entry of entries) {
          const relativeChild = prefix ? `${prefix}/${entry.name}` : entry.name;
          const full = path.join(directory, entry.name);
          if (relativeChild === "node_modules/.cache" || relativeChild === ".git") continue;
          if (entry.isDirectory()) {
            lines.push(`d\0${relativeChild}`);
            walk(full, relativeChild);
          } else if (entry.isFile()) {
            lines.push(`f\0${relativeChild}\0${sha(fs.readFileSync(full))}`);
          } else if (entry.isSymbolicLink()) {
            lines.push(`l\0${relativeChild}\0${fs.readlinkSync(full)}`);
          } else {
            lines.push(`o\0${relativeChild}`);
          }
        }
      };
      walk(base, "");
      return sha(lines.join("\n"));
    });
  }

  listing(relative, recursive) {
    return this.#memo(`list\0${relative}\0${recursive}`, () => {
      try {
        const entries = fs.readdirSync(this.absolute(relative), { withFileTypes: true, recursive })
          .map(entry => {
            const parent = path.relative(this.absolute(relative), entry.parentPath || entry.path || this.absolute(relative));
            const name = parent ? `${parent.replaceAll("\\", "/")}/${entry.name}` : entry.name;
            const type = entry.isDirectory() ? "d" : entry.isFile() ? "f" : entry.isSymbolicLink() ? "l" : "o";
            return `${type}\0${name}`;
          })
          .filter(line => !line.slice(2).startsWith("node_modules/.cache"))
          .sort();
        return sha(entries.join("\n"));
      } catch (error) {
        return `error:${CheckObservationValues.code(error)}`;
      }
    });
  }

  // The current value of one recorded observation.
  value(observation) {
    const file = this.absolute(observation.path);
    switch (observation.kind) {
      case "read":
        return this.#memo(`read\0${observation.path}`, () => {
          try { return sha(fs.readFileSync(file)); } catch (error) { return `error:${CheckObservationValues.code(error)}`; }
        });
      case "list": return this.listing(observation.path, observation.recursive === true);
      case "tree": return this.tree(observation.path);
      case "stat":
      case "lstat":
        return this.#memo(`${observation.kind}\0${observation.path}`, () => {
          try {
            return canonical(CheckObservationValues.metadata((observation.kind === "stat" ? fs.statSync : fs.lstatSync)(file)));
          } catch (error) { return `error:${CheckObservationValues.code(error)}`; }
        });
      case "exists": return this.#memo(`exists\0${observation.path}`, () => String(fs.existsSync(file)));
      case "access":
        return this.#memo(`access\0${observation.path}\0${observation.mode}`, () => {
          try { fs.accessSync(file, observation.mode); return "ok"; } catch (error) { return CheckObservationValues.code(error); }
        });
      case "realpath":
        return this.#memo(`realpath\0${observation.path}`, () => {
          try { return this.#resolved(fs.realpathSync(file)); } catch (error) { return `error:${CheckObservationValues.code(error)}`; }
        });
      case "readlink":
        return this.#memo(`readlink\0${observation.path}`, () => {
          try { return String(fs.readlinkSync(file)); } catch (error) { return `error:${CheckObservationValues.code(error)}`; }
        });
      default:
        throw new Error(`Unknown observation kind: ${observation.kind}`);
    }
  }

  // The value an observation reported when the check executed.
  static recorded(event) {
    switch (event.kind) {
      case "read": return event.error ? `error:${event.error}` : event.sha256;
      case "stat":
      case "lstat": return event.error ? `error:${event.error}` : canonical(event.metadata);
      case "exists": return String(event.result);
      case "access": return event.outcome;
      case "realpath": return event.error ? `error:${event.error}` : event.resolved;
      case "readlink": return event.error ? `error:${event.error}` : event.value;
      default: return null;
    }
  }

  // Git output re-evaluated in the recorded working directory.
  // A reviewed shell command re-evaluated in the recorded working directory.
  command(fact) {
    return this.#memo(`command\0${fact.cwd}\0${fact.command}`, () => {
      const cwd = fact.cwd === "external" ? this.root : this.absolute(fact.cwd);
      const result = spawnSync(fact.command, { cwd, shell: true, windowsHide: true });
      return { status: result.status, sha256: sha(result.stdout || "") };
    });
  }

  git(fact) {
    return this.#memo(`git\0${fact.cwd}\0${JSON.stringify(fact.args)}`, () => {
      const result = spawnSync(GIT, fact.args, { cwd: this.absolute(fact.cwd) });
      return { status: result.status, sha256: sha(result.stdout || "") };
    });
  }
}

// A content-addressed record that a check passed for exactly these inputs, tooling and environment.
class CheckSeal {
  static identity(check, scope) {
    return { id: check.id, file: check.file, args: [...(check.args || [])], suites: [...(check.suites || [])],
      cache: CheckCachePolicy.of(check), isolation: check.isolation || "exclusive", scope };
  }

  static tooling() {
    return Object.fromEntries(TOOLING.map(file => {
      const absolute = path.join(PROJECT_ROOT, file);
      return [file, fs.existsSync(absolute) ? sha(fs.readFileSync(absolute)) : "absent"];
    }));
  }

  static environment(root, policy) {
    const file = name => {
      const absolute = path.join(root, name);
      return fs.existsSync(absolute) ? sha(fs.readFileSync(absolute)) : null;
    };
    return {
      schema: SEAL_SCHEMA,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      packageSha256: file("package.json"),
      lockfileSha256: file("package-lock.json"),
      variables: Object.fromEntries((policy.environmentKeys || []).map(key => [key, process.env[key] ?? null])),
      tooling: CheckSeal.tooling(),
    };
  }

  // Full-tree fingerprints of the reviewed input paths.
  static snapshot(policy, values) {
    if (policy.policy !== "snapshot") return {};
    return Object.fromEntries(policy.inputPaths.map(item => [item, values.tree(item)]));
  }

  static events(trace) {
    return trace.split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line))
      .sort((left, right) => (left.pid - right.pid) || (left.seq - right.seq));
  }

  // Decides whether a passing execution may be sealed; returns the seal or the reasons it may not.
  static evaluate({ check, scope, root, events, values, snapshotBefore, snapshotAfter, durationMs }) {
    const policy = CheckCachePolicy.of(check);
    const writes = [...new Set(events.filter(event => event.kind === "write").map(event => event.path))].sort();
    const reasons = [];
    if (policy.policy !== "snapshot") return { eligible: false, reasons: ["cache policy never"], writes };
    if (canonical(snapshotBefore) !== canonical(snapshotAfter)) reasons.push("reviewed inputs changed during execution");
    const exited = new Set(events.filter(event => event.kind === "exit").map(event => event.pid));
    const started = events.filter(event => event.kind === "process").map(event => event.pid);
    if (started.length === 0 || started.some(pid => !exited.has(pid))) reasons.push("incomplete trace (a process ended without its exit record)");
    for (const event of events.filter(item => item.kind === "unsupported")) {
      reasons.push(`unsupported ${event.op}${event.path ? ` ${event.path}` : ""}${event.reason ? ` (${event.reason})` : ""}`);
    }
    if (writes.length > 0) reasons.push(`writes project paths: ${writes.slice(0, 3).join(", ")}${writes.length > 3 ? " …" : ""}`);
    const git = events.filter(event => event.kind === "git");
    // Reviewed shell commands do not depend on their working directory (see the tracer).
    const commands = events.filter(event => event.kind === "command");
    for (const fact of git) {
      if (fact.status !== 0 || fact.cwd === "external") reasons.push(`git ${fact.args.join(" ")} is not certifiable`);
    }
    const covered = item => (policy.inputPaths || []).some(input => within(item, input) || within(input, item)) ||
      CODE_TREES.some(tree => within(item, tree)) || item === check.file;
    const observations = [];
    const seen = new Set();
    const currentByKey = new Map();
    for (const event of events) {
      if (!["read", "list", "tree", "stat", "lstat", "exists", "access", "realpath", "readlink"].includes(event.kind)) continue;
      // Existence/metadata probes (inside or outside the root) are complete observations of their
      // own: their recorded result is exactly what is re-evaluated. Coverage applies to consumed
      // contents (reads, listings, copied trees, links).
      const probe = ["stat", "lstat", "exists", "access"].includes(event.kind);
      if (!probe && !covered(event.path)) reasons.push(`uncovered ${event.kind} ${event.path}`);
      const observation = { kind: event.kind, path: event.path,
        ...(event.kind === "list" ? { recursive: event.recursive === true } : {}),
        ...(event.kind === "access" ? { mode: event.mode } : {}) };
      const key = canonical(observation);
      // Every recorded value must still hold after the execution, not only the first one per path: a
      // path read as A, then B, then A again would otherwise be sealed as A although the check saw B.
      // Only the observation list is deduplicated.
      if (!currentByKey.has(key)) currentByKey.set(key, values.value(observation));
      const current = currentByKey.get(key);
      const reported = CheckObservationValues.recorded(event);
      if (reported !== null && reported !== current) reasons.push(`${event.kind} ${event.path} changed during execution`);
      if (seen.has(key)) continue;
      seen.add(key);
      observations.push({ ...observation, value: current });
    }
    if (reasons.length > 0) return { eligible: false, reasons: [...new Set(reasons)], writes };
    return {
      eligible: true,
      writes,
      seal: {
        identity: CheckSeal.identity(check, scope),
        environment: CheckSeal.environment(root, policy),
        snapshot: snapshotAfter,
        observations: observations.sort((left, right) => canonical(left) < canonical(right) ? -1 : 1),
        git: git.map(fact => ({ args: fact.args, cwd: fact.cwd, status: fact.status, sha256: fact.sha256 })),
        commands: commands.map(fact => ({ command: fact.command, cwd: fact.cwd, status: fact.status, sha256: fact.sha256 })),
        durationMs,
        sealedAt: new Date().toISOString(),
      },
    };
  }

  // Returns null when the seal still holds for this check, or the first reason it does not.
  static invalidation({ check, scope, root, seal, values }) {
    if (!seal) return "no seal";
    if (seal.environment?.schema !== SEAL_SCHEMA || !seal.identity || !Array.isArray(seal.observations) ||
      !seal.snapshot || !Array.isArray(seal.git) || !Array.isArray(seal.commands)) return "seal schema is not 2";
    const policy = CheckCachePolicy.of(check);
    if (policy.policy !== "snapshot") return "cache policy never";
    if (canonical(seal.identity) !== canonical(CheckSeal.identity(check, scope))) return "check definition or scope changed";
    const environment = CheckSeal.environment(root, policy);
    for (const key of Object.keys(environment)) {
      if (canonical(seal.environment[key]) !== canonical(environment[key])) return `environment changed: ${key}`;
    }
    const snapshot = CheckSeal.snapshot(policy, values);
    for (const [item, value] of Object.entries(snapshot)) {
      if (seal.snapshot[item] !== value) return `reviewed input changed: ${item}`;
    }
    if (canonical(Object.keys(seal.snapshot).sort()) !== canonical(Object.keys(snapshot).sort())) {
      return "reviewed input set changed";
    }
    for (const observation of seal.observations) {
      const { value, ...query } = observation;
      if (values.value(query) !== value) return `${observation.kind} changed: ${observation.path}`;
    }
    for (const fact of seal.git) {
      const current = values.git(fact);
      if (current.status !== 0 || current.sha256 !== fact.sha256) return `git output changed: git ${fact.args.join(" ")}`;
    }
    for (const fact of seal.commands) {
      const current = values.command(fact);
      if (current.status !== fact.status || current.sha256 !== fact.sha256) return `command output changed: ${fact.command}`;
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

  // Written atomically after a successful eligible execution only.
  save(check, seal) {
    fs.mkdirSync(this.directory, { recursive: true });
    const target = this.file(check);
    const temporary = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(seal)}\n`);
    fs.renameSync(temporary, target);
  }

  remove(check) { fs.rmSync(this.file(check), { force: true }); }
}

module.exports = { CheckCachePolicy, CheckObservationValues, CheckSeal, CheckSealStore, TRACER, SEAL_SCHEMA, TOOLING,
  CODE_TREES, canonical };
