"use strict";

// Preloaded into every check process (and its node child processes) when the runner seals checks:
//   NODE_OPTIONS=--require <this file>, CYBER_CHECK_TRACE=<trace file>, CYBER_CHECK_ROOT=<project root>
// It records which project files the check read, which directories it listed, which paths it probed,
// which modules it loaded, which project files it wrote, and the output of git commands. The runner
// turns these facts into a content-addressed seal; nothing here changes check behavior.
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");

const TRACE = process.env.CYBER_CHECK_TRACE;
const ROOT = process.env.CYBER_CHECK_ROOT && path.resolve(process.env.CYBER_CHECK_ROOT);

if (TRACE && ROOT) {
  const raw = {
    appendFileSync: fs.appendFileSync, readFileSync: fs.readFileSync, existsSync: fs.existsSync,
    statSync: fs.statSync, lstatSync: fs.lstatSync, readdirSync: fs.readdirSync,
  };
  const seen = new Set();
  const inside = file => {
    if (typeof file !== "string" && !(file instanceof URL) && !Buffer.isBuffer(file)) return null;
    let absolute;
    try { absolute = path.resolve(file instanceof URL ? new URL(file).pathname.replace(/^\/([A-Za-z]:)/u, "$1") : String(file)); }
    catch { return null; }
    const relative = path.relative(ROOT, absolute);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
    const normalized = relative.replaceAll("\\", "/");
    if (normalized === "node_modules" || normalized.startsWith("node_modules/") || normalized.startsWith(".git/")) return null;
    return normalized;
  };
  const record = (kind, target) => {
    const key = `${kind}\0${target}`;
    if (seen.has(key)) return;
    seen.add(key);
    raw.appendFileSync(TRACE, `${JSON.stringify({ kind, path: target })}\n`);
  };
  const wrap = (object, name, kind, argument = 0) => {
    const original = object[name];
    if (typeof original !== "function") return;
    object[name] = function traced(...args) {
      const target = inside(args[argument]);
      if (target !== null) record(kind, target);
      return original.apply(this, args);
    };
  };
  for (const name of ["readFileSync", "readFile", "openSync", "open", "createReadStream"]) wrap(fs, name, "read");
  for (const name of ["readFile", "open"]) wrap(fs.promises, name, "read");
  for (const name of ["readdirSync", "readdir", "opendirSync", "opendir"]) wrap(fs, name, "list");
  for (const name of ["readdir", "opendir"]) wrap(fs.promises, name, "list");
  for (const name of ["existsSync", "statSync", "lstatSync", "accessSync", "stat", "lstat", "access", "realpathSync"]) {
    wrap(fs, name, "probe");
  }
  for (const name of ["stat", "lstat", "access"]) wrap(fs.promises, name, "probe");
  wrap(fs, "copyFileSync", "read");
  wrap(fs, "cpSync", "tree");
  for (const name of ["writeFileSync", "writeFile", "appendFileSync", "rmSync", "unlinkSync", "mkdirSync",
    "renameSync", "rmdirSync", "createWriteStream"]) wrap(fs, name, "write");
  for (const name of ["writeFile", "rm", "unlink", "mkdir", "rename"]) wrap(fs.promises, name, "write");
  wrap(fs, "renameSync", "write", 1);
  wrap(fs, "copyFileSync", "write", 1);

  const load = Module._load;
  Module._load = function tracedLoad(request, parent, isMain) {
    try {
      const target = inside(Module._resolveFilename(request, parent, isMain));
      if (target !== null) record("read", target);
    } catch { /* unresolved requests fail in the real loader */ }
    return load.apply(this, arguments);
  };

  // git output is an input of checks that pin source checkpoints.
  const isGit = command => /(^|[\\/])git(\.exe)?$/iu.test(String(command || ""));
  for (const name of ["execFileSync", "spawnSync"]) {
    const original = childProcess[name];
    childProcess[name] = function tracedGit(command, args, ...rest) {
      const result = original.call(this, command, args, ...rest);
      if (isGit(command) && Array.isArray(args)) {
        const output = name === "spawnSync" ? result.stdout : result;
        const digest = crypto.createHash("sha256").update(output == null ? "" : output).digest("hex");
        const key = `git\0${JSON.stringify(args)}`;
        if (!seen.has(key)) {
          seen.add(key);
          raw.appendFileSync(TRACE, `${JSON.stringify({ kind: "git", args, sha256: digest })}\n`);
        }
      }
      return result;
    };
  }
}
