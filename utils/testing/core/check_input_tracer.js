"use strict";

// Preloaded into every traced check process (and its node child processes):
//   NODE_OPTIONS=--require <this file>, CYBER_CHECK_TRACE=<trace file>, CYBER_CHECK_ROOT=<execution root>
// It records one JSON event per distinct observation, in order, and never changes check behavior
// (node children only gain this tracer in their environment):
//   read     file contents consumed (readFile/open for reading/streams/copy sources/CJS and ESM loads)
//   list     a directory listing (root included as "."), with the recursive flag
//   tree     a recursive copy source (cpSync/cp): the whole subtree was consumed
//   stat     stat/lstat with the full returned metadata (atime excluded) or the error code
//   exists   existsSync result
//   access   accessSync/access mode and outcome
//   realpath the resolved path (or error code)
//   readlink the link target (or error code)
//   write    any creation, modification, rename, copy target or removal
//   git      git arguments, working directory, exit status and output digest
//   command  a reviewed shell command, its working directory, exit status and output digest
//   exit     the end of a traced process (a trace without it is incomplete)
//   unsupported  an operation the cache cannot reproduce faithfully (the check is then not cacheable)
// Paths are relative to the execution root ("." is the root). node_modules is recorded (installed
// dependencies are inputs), also through its real path when the root links it (history base).
// The runner-owned node_modules/.cache and any path outside the root and the temporary directory are
// unverified inputs: touching them makes the check non-cacheable. Temporary workspaces must be
// derived from recorded root inputs (reviewed per check before it opts into a cache policy).
const fs = require("node:fs");
const path = require("node:path");
const url = require("node:url");
const Module = require("node:module");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");

const TRACE = process.env.CYBER_CHECK_TRACE;
const ROOT = process.env.CYBER_CHECK_ROOT && path.resolve(process.env.CYBER_CHECK_ROOT);
const TRACER = __filename;
const os = require("node:os");

if (TRACE && ROOT) {
  const raw = {
    appendFileSync: fs.appendFileSync, readFileSync: fs.readFileSync, statSync: fs.statSync, lstatSync: fs.lstatSync, existsSync: fs.existsSync,
    accessSync: fs.accessSync, readlinkSync: fs.readlinkSync, realpathSync: fs.realpathSync,
  };
  // Callback-style calls return nothing synchronously; their observation is measured directly.
  const measure = action => { try { return { value: action() }; } catch (error) { return { error }; } };
  const realOrNull = target => { try { return raw.realpathSync(target); } catch { return null; } };
  const MODULES = realOrNull(path.join(ROOT, "node_modules"));
  const TEMPORARY = realOrNull(os.tmpdir()) || path.resolve(os.tmpdir());
  const under = (absolute, parent) => {
    const relative = path.relative(parent, absolute);
    return relative.startsWith("..") || path.isAbsolute(relative) ? null : relative.replaceAll("\\", "/");
  };
  // Node's fs implementation calls its own exported functions (writeFileSync -> fs.openSync, cpSync
  // -> fs.copyFileSync): only the outermost call is observed, and the tracer's own I/O never is.
  let busy = false;
  const quiet = action => {
    if (busy) return action();
    busy = true;
    try { return action(); } finally { busy = false; }
  };
  // Identical repeated observations are recorded once (the first occurrence keeps its order); lines
  // are buffered and flushed in batches and at exit. The final "exit" event marks a complete trace:
  // a process that ends without it (killed) leaves an incomplete, non-cacheable record.
  let sequence = 0;
  const seen = new Set();
  let buffer = [];
  const flush = () => {
    if (buffer.length === 0) return;
    const lines = buffer.join("");
    buffer = [];
    raw.appendFileSync(TRACE, lines);
  };
  const emit = event => quiet(() => {
    const key = JSON.stringify(event);
    if (seen.has(key)) return;
    seen.add(key);
    buffer.push(`${JSON.stringify({ seq: sequence++, pid: process.pid, ...event })}\n`);
    if (buffer.length >= 2000) flush();
  });
  process.on("exit", () => quiet(() => {
    buffer.push(`${JSON.stringify({ seq: sequence++, pid: process.pid, kind: "exit" })}\n`);
    flush();
  }));
  const toPath = value => {
    if (value instanceof URL) return value.protocol === "file:" ? url.fileURLToPath(value) : null;
    if (Buffer.isBuffer(value)) return value.toString();
    if (typeof value !== "string") return null;
    if (value.startsWith("file:")) {
      try { return url.fileURLToPath(value); } catch { return null; }
    }
    return value;
  };
  const RUNNER_CACHE = /^node_modules\/\.cache(\/|$)/u;
  // { relative } for a root path ("." is the root), { temporary } or { external } otherwise; null
  // for values that are not paths.
  const locate = value => {
    const candidate = toPath(value);
    if (candidate === null) return null;
    const absolute = path.resolve(candidate);
    const relative = under(absolute, ROOT);
    if (relative !== null) return { relative: relative === "" ? "." : relative };
    const dependency = MODULES && under(absolute, MODULES);
    if (dependency !== null && dependency !== undefined) {
      return { relative: dependency === "" ? "node_modules" : `node_modules/${dependency}` };
    }
    return under(absolute, TEMPORARY) !== null ? { temporary: true } : { external: true };
  };
  // Root-relative path of an observed operation, or null when it is not recorded. The runner cache
  // and external paths are recorded as unsupported inputs.
  const inside = (value, op = null, mutating = false) => {
    const location = locate(value);
    if (!location || location.temporary) return null;
    if (location.external || RUNNER_CACHE.test(location.relative)) {
      if (op) emit({ kind: "unsupported", op, reason: location.external ? "external path" : "runner cache", mutating });
      return null;
    }
    return location.relative;
  };
  // A resolved path for recording (realpath results, git working directories).
  const resolvedPath = value => {
    const location = locate(value);
    return location && location.relative && !RUNNER_CACHE.test(location.relative) ? location.relative : "external";
  };
  // Existence and metadata probes outside the root (build tools search the ancestors of their
  // workspace for configuration files) are reproducible observations of their own: they are recorded
  // under "external:<absolute path>" and re-evaluated. Reading external contents stays unsupported.
  const probed = value => {
    const location = locate(value);
    if (!location || location.temporary) return null;
    if (!location.external && !RUNNER_CACHE.test(location.relative)) return location.relative;
    return `external:${path.resolve(toPath(value)).replaceAll("\\", "/")}`;
  };
  const absoluteOf = target => (target.startsWith("external:") ? target.slice("external:".length) : path.join(ROOT, target));
  const errorCode = error => (error && error.code) || (error && error.name) || "error";
  // Deterministic stat metadata; access time reflects reads (including fingerprinting) and is omitted.
  const metadata = stats => ({
    type: stats.isFile() ? "file" : stats.isDirectory() ? "directory" : stats.isSymbolicLink() ? "symlink" : "other",
    dev: String(stats.dev), ino: String(stats.ino), mode: String(stats.mode), nlink: String(stats.nlink),
    uid: String(stats.uid), gid: String(stats.gid), size: String(stats.size),
    mtimeMs: String(stats.mtimeMs), ctimeMs: String(stats.ctimeMs), birthtimeMs: String(stats.birthtimeMs),
  });
  const statEvent = (kind, target, follow) => {
    try {
      const stats = (follow ? raw.statSync : raw.lstatSync)(absoluteOf(target));
      return { kind, path: target, metadata: metadata(stats) };
    } catch (error) {
      return { kind, path: target, error: errorCode(error) };
    }
  };
  const isWriteFlag = flags => typeof flags === "string" && /[wa+]/u.test(flags) ||
    typeof flags === "number" && (flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT |
      fs.constants.O_TRUNC | fs.constants.O_APPEND)) !== 0;

  const wrap = (object, name, observe) => {
    const original = object[name];
    if (typeof original !== "function") return;
    object[name] = function traced(...args) {
      if (busy) return original.apply(this, args);
      let result;
      let failure = null;
      try {
        result = quiet(() => original.apply(this, args));
      } catch (error) {
        failure = error;
      }
      const finish = (value, error) => {
        try { quiet(() => observe(args, value, error, name)); } catch { emit({ kind: "unsupported", op: name, reason: "observer-failed" }); }
      };
      if (failure) {
        finish(undefined, failure);
        throw failure;
      }
      if (result && typeof result.then === "function") {
        return result.then(value => { finish(value, null); return value; }, error => { finish(undefined, error); throw error; });
      }
      // Callback APIs report through their last argument.
      if (typeof args[args.length - 1] === "function" && object === fs && !name.endsWith("Sync")) {
        finish(undefined, null);
        return result;
      }
      finish(result, null);
      return result;
    };
  };
  const onPath = (index, handler, mutating = () => false) => (args, value, error, name) => {
    const target = inside(args[index], name, mutating(args));
    if (target !== null) handler(target, args, value, error);
  };
  // The bytes a read consumed: the returned buffer or UTF-8 text (re-encoded; invalid UTF-8 then
  // conservatively differs from the file), or the file as it is right after the call.
  // Digests are memoized per unchanged file identity (size, times, inode) so repeated reads of one
  // file are hashed once; a file changed meanwhile gets a new identity and a new digest.
  const digests = new Map();
  const consumed = (target, value, encoding = null) => {
    const stats = measure(() => raw.statSync(path.join(ROOT, target))).value;
    const identity = stats && `${target}\0${stats.size}\0${stats.mtimeMs}\0${stats.ctimeMs}\0${stats.ino}`;
    if (identity && digests.has(identity)) return { sha256: digests.get(identity) };
    const result = hashConsumed(target, value, encoding);
    if (identity && result.sha256) digests.set(identity, result.sha256);
    return result;
  };
  const hashConsumed = (target, value, encoding) => {
    const outcome = Buffer.isBuffer(value) ? { value }
      : typeof value === "string" && /^utf-?8$/iu.test(String(encoding)) ? { value: Buffer.from(value, "utf8") }
        : measure(() => raw.readFileSync(path.join(ROOT, target)));
    return outcome.error ? { error: errorCode(outcome.error) }
      : { sha256: crypto.createHash("sha256").update(outcome.value).digest("hex") };
  };
  const read = onPath(0, (target, args, value, error) => emit({ kind: "read", path: target,
    ...(error ? { error: errorCode(error) } : consumed(target, value, typeof args[1] === "string" ? args[1] : args[1]?.encoding)) }));
  const write = index => onPath(index, (target, args, value, error) => emit({ kind: "write", path: target,
    ...(error ? { error: errorCode(error) } : {}) }), () => true);
  const list = onPath(0, (target, args, value, error) => {
    const options = args[1] && typeof args[1] === "object" ? args[1] : {};
    emit({ kind: "list", path: target, recursive: options.recursive === true, withFileTypes: options.withFileTypes === true,
      ...(error ? { error: errorCode(error) } : {}) });
  });
  const open = onPath(0, (target, args, value, error) => {
    const flags = args[1] ?? "r";
    if (isWriteFlag(flags)) emit({ kind: "write", path: target, ...(error ? { error: errorCode(error) } : {}) });
    else emit({ kind: "read", path: target, ...(error ? { error: errorCode(error) } : consumed(target, null)) });
  }, args => isWriteFlag(args[1] ?? "r"));
  const onProbe = handler => (args, value, error) => {
    const target = probed(args[0]);
    if (target !== null) handler(target, args);
  };
  const stat = follow => onProbe(target => emit(statEvent(follow ? "stat" : "lstat", target, follow)));
  const exists = onProbe(target => emit({ kind: "exists", path: target, result: raw.existsSync(absoluteOf(target)) }));
  const access = onProbe((target, args) => {
    const mode = typeof args[1] === "number" ? args[1] : fs.constants.F_OK;
    const outcome = measure(() => raw.accessSync(absoluteOf(target), mode));
    emit({ kind: "access", path: target, mode, outcome: outcome.error ? errorCode(outcome.error) : "ok" });
  });
  const realpath = onPath(0, target => {
    const outcome = measure(() => raw.realpathSync(path.join(ROOT, target)));
    emit(outcome.error ? { kind: "realpath", path: target, error: errorCode(outcome.error) }
      : { kind: "realpath", path: target, resolved: resolvedPath(outcome.value) });
  });
  const readlink = onPath(0, target => {
    const outcome = measure(() => raw.readlinkSync(path.join(ROOT, target)));
    emit(outcome.error ? { kind: "readlink", path: target, error: errorCode(outcome.error) }
      : { kind: "readlink", path: target, value: String(outcome.value) });
  });
  const copy = (args, value, error, name) => {
    const source = inside(args[0], name);
    if (source !== null) emit({ kind: "read", path: source, ...consumed(source, null) });
    const target = inside(args[1], name, true);
    if (target !== null) emit({ kind: "write", path: target });
  };
  const copyTree = (args, value, error, name) => {
    const source = inside(args[0], name);
    if (source !== null) emit({ kind: "tree", path: source });
    const target = inside(args[1], name, true);
    if (target !== null) emit({ kind: "write", path: target });
  };
  const rename = (args, value, error, name) => {
    for (const index of [0, 1]) {
      const target = inside(args[index], name, true);
      if (target !== null) emit({ kind: "write", path: target });
    }
  };

  const OBSERVERS = {
    readFileSync: read, readFile: read, createReadStream: read,
    openSync: open, open,
    readdirSync: list, readdir: list, opendirSync: list, opendir: list,
    statSync: stat(true), stat: stat(true), lstatSync: stat(false), lstat: stat(false),
    existsSync: exists, exists,
    accessSync: access, access,
    realpathSync: realpath, realpath,
    readlinkSync: readlink, readlink,
    copyFileSync: copy, copyFile: copy, cpSync: copyTree, cp: copyTree,
    renameSync: rename, rename,
    writeFileSync: write(0), writeFile: write(0), appendFileSync: write(0), appendFile: write(0),
    createWriteStream: write(0), rmSync: write(0), rm: write(0), unlinkSync: write(0), unlink: write(0),
    mkdirSync: write(0), mkdir: write(0), rmdirSync: write(0), rmdir: write(0), mkdtempSync: write(0), mkdtemp: write(0),
    truncateSync: write(0), truncate: write(0), utimesSync: write(0), utimes: write(0), chmodSync: write(0),
    chmod: write(0), symlinkSync: write(1), symlink: write(1), linkSync: write(1), link: write(1),
  };
  for (const [name, observer] of Object.entries(OBSERVERS)) {
    wrap(fs, name, observer);
    if (fs.promises[name]) wrap(fs.promises, name, observer);
  }
  // Operations on file descriptors reuse the path observed at open; other path operations are not
  // reproducible by the cache and make the check non-cacheable when they touch the root.
  const DESCRIPTOR = new Set(["readSync", "read", "writeSync", "write", "closeSync", "close", "fstatSync", "fstat",
    "fsyncSync", "fsync", "fdatasyncSync", "fdatasync", "ftruncateSync", "ftruncate", "readvSync", "readv",
    "writevSync", "writev", "futimesSync", "futimes", "fchmodSync", "fchmod", "fchownSync", "fchown"]);
  const unsupported = (object, label) => {
    for (const name of Object.keys(object)) {
      if (typeof object[name] !== "function" || OBSERVERS[name] || DESCRIPTOR.has(name) || !/^[a-z]/u.test(name)) continue;
      if (["watch", "watchFile", "unwatchFile"].includes(name) || name.startsWith("create") && name !== "createReadStream" &&
        name !== "createWriteStream") continue;
      const original = object[name];
      object[name] = function tracedUnknown(...args) {
        if (busy) return original.apply(this, args);
        const op = `${label}.${name}`;
        const target = quiet(() => inside(args[0], op, true));
        if (target !== null) emit({ kind: "unsupported", op, path: target });
        return quiet(() => original.apply(this, args));
      };
    }
  };
  unsupported(fs, "fs");
  unsupported(fs.promises, "fs.promises");
  for (const name of ["watch", "watchFile"]) {
    const original = fs[name];
    fs[name] = function tracedWatch(...args) {
      const target = inside(args[0], `fs.${name}`);
      if (target !== null) emit({ kind: "unsupported", op: `fs.${name}`, path: target });
      return original.apply(this, args);
    };
  }

  // CommonJS and ESM loads (module hooks cover dynamic import(), which bypasses Module._load).
  if (typeof Module.registerHooks === "function") {
    Module.registerHooks({
      load(specifier, context, nextLoad) {
        quiet(() => {
          const target = specifier.startsWith("file:") ? inside(specifier, "module.load") : null;
          if (target !== null) emit({ kind: "read", path: target, ...consumed(target, null) });
        });
        return nextLoad(specifier, context);
      },
    });
  } else {
    emit({ kind: "unsupported", op: "module.registerHooks", reason: "module loads cannot be traced" });
  }

  // Child processes. git and the reviewed shell commands are re-evaluated by the cache (arguments,
  // working directory, exit status and output are recorded); node children always inherit this
  // tracer (it is added to an explicit environment that lacks it); any other program is an
  // unverified input. Only the outermost call is observed (exec is implemented with execFile).
  // Reviewed shell commands: "net use" is vite's Windows probe of network drive mappings for its
  // safe realpath; its output does not depend on the working directory.
  const REVIEWED_SHELL_COMMANDS = new Set(["net use"]);
  const isGit = command => /(^|[\/])git(\.exe)?$/iu.test(String(command || ""));
  const isNode = command => String(command || "") === process.execPath || /(^|[\/])node(\.exe)?$/iu.test(String(command || ""));
  const optionsIndex = rest => rest.findIndex(item => item && typeof item === "object" && !Array.isArray(item));
  const optionsOf = rest => rest[optionsIndex(rest)] || {};
  const digest = output => crypto.createHash("sha256").update(output == null ? "" : output).digest("hex");
  const gitEvent = (args, options, status, stdout) => emit({ kind: "git", args: [...args].map(String),
    cwd: resolvedPath(options.cwd || process.cwd()), status, sha256: digest(stdout) });
  // Arguments with an explicit environment extended by the tracer.
  const withTracer = rest => {
    const index = optionsIndex(rest);
    const env = index >= 0 ? rest[index].env : null;
    if (!env) return rest;
    // The preload may be spelled with any separators or quoting; its file name identifies it.
    if (String(env.NODE_OPTIONS || "").includes(path.basename(TRACER)) && env.CYBER_CHECK_TRACE) {
      // A nested check runner traces this child into its own trace.
      if (env.CYBER_CHECK_TRACE !== TRACE) emit({ kind: "unsupported", op: "child", reason: "node child traced by a nested runner" });
      return rest;
    }
    const copy = [...rest];
    copy[index] = { ...rest[index], env: { ...env, CYBER_CHECK_TRACE: TRACE, CYBER_CHECK_ROOT: ROOT,
      NODE_OPTIONS: `${env.NODE_OPTIONS ? `${env.NODE_OPTIONS} ` : ""}--require ${JSON.stringify(TRACER)}` } };
    return copy;
  };
  const unverified = (op, command) => emit({ kind: "unsupported", op, command: path.basename(String(command || "")),
    reason: "unverified child process" });
  for (const name of ["spawnSync", "execFileSync"]) {
    const original = childProcess[name];
    childProcess[name] = function tracedChild(command, ...rest) {
      if (busy) return original.call(this, command, ...rest);
      const args = Array.isArray(rest[0]) ? rest[0] : [];
      const options = optionsOf(rest);
      if (isGit(command)) {
        try {
          const result = quiet(() => original.call(this, command, ...rest));
          gitEvent(args, options, name === "spawnSync" ? result.status : 0, name === "spawnSync" ? result.stdout : result);
          return result;
        } catch (error) {
          gitEvent(args, options, error.status ?? 1, error.stdout);
          throw error;
        }
      }
      if (!isNode(command)) unverified(name, command);
      return quiet(() => original.call(this, command, ...(isNode(command) ? withTracer(rest) : rest)));
    };
  }
  for (const name of ["spawn", "execFile", "fork"]) {
    const original = childProcess[name];
    childProcess[name] = function tracedAsyncChild(command, ...rest) {
      if (busy) return original.call(this, command, ...rest);
      const node = name === "fork" || isNode(command);
      if (isGit(command)) {
        emit({ kind: "unsupported", op: name, command: "git", reason: "asynchronous git output is not recorded" });
      } else if (!node) {
        unverified(name, command);
      }
      return quiet(() => original.call(this, command, ...(node ? withTracer(rest) : rest)));
    };
  }
  const execOriginal = childProcess.exec;
  childProcess.exec = function tracedExec(command, ...rest) {
    if (busy) return execOriginal.call(this, command, ...rest);
    const callback = typeof rest.at(-1) === "function" ? rest.at(-1) : null;
    if (!REVIEWED_SHELL_COMMANDS.has(String(command)) || !callback) {
      emit({ kind: "unsupported", op: "exec", reason: "shell command" });
      return quiet(() => execOriginal.call(this, command, ...rest));
    }
    const options = optionsOf(rest);
    const observed = function observedCallback(error, stdout, stderr) {
      emit({ kind: "command", command: String(command), cwd: resolvedPath(options.cwd || process.cwd()),
        status: error ? (typeof error.code === "number" ? error.code : 1) : 0, sha256: digest(stdout) });
      return callback.call(this, error, stdout, stderr);
    };
    return quiet(() => execOriginal.call(this, command, ...rest.slice(0, -1), observed));
  };
  const execSyncOriginal = childProcess.execSync;
  childProcess.execSync = function tracedExecSync(command, ...rest) {
    if (!busy) emit({ kind: "unsupported", op: "execSync", reason: "shell command" });
    return quiet(() => execSyncOriginal.call(this, command, ...rest));
  };
  try {
    const threads = require("node:worker_threads");
    const Worker = threads.Worker;
    threads.Worker = class TracedWorker extends Worker {
      constructor(...args) {
        emit({ kind: "unsupported", op: "worker_threads.Worker", reason: "worker inputs are not traced" });
        super(...args);
      }
    };
  } catch { /* worker threads unavailable */ }
  emit({ kind: "process", argv: process.argv.slice(1).map(item => inside(item) ?? path.basename(item)) });
}
