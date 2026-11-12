"use strict";

// Shared steps of the "apply an exported DEV file to a data module" commands (apply:zones, apply:radio).
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const readline = require("node:readline");
const { spawnSync } = require("node:child_process");

// The backup's name in the machine's local time (TK-078), as the owner reads the clock: yyyymmdd-hhmmss.
function stamp(date) {
  const pad = value => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function gitDirectory(root, command) {
  const result = spawnSync("git", ["rev-parse", "--git-common-dir"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} needs a Git checkout`);
  return path.resolve(root, result.stdout.trim());
}

function askYes(question) {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => prompt.question(question, (answer) => {
    prompt.close();
    resolve(/^(y|yes|т|так)$/iu.test(answer.trim()));
  }));
}

function isDirty(root, target) {
  const status = spawnSync("git", ["status", "--porcelain", "--", target], { cwd: root, encoding: "utf8" });
  return status.status !== 0 || status.stdout.trim() !== "";
}

// The exported file a command names (TK-285): a path as given, from the directory the command was run in; a bare file
// name that is not there is looked for in the user's Downloads folder, where the browser saved it, so the command
// DevTools shows after an export works as copied.
function resolveExportedFile(cwd, argument, { exists = fs.existsSync, downloads = path.join(os.homedir(), "Downloads") } = {}) {
  const direct = path.resolve(cwd, argument);
  if (exists(direct) || path.basename(argument) !== argument) return direct;
  const downloaded = path.join(downloads, argument);
  return exists(downloaded) ? downloaded : direct;
}

function runChecks(root, checks) {
  for (const check of checks) {
    const result = spawnSync(process.execPath, ["utils/run-checks.js", "--check", check], { cwd: root, encoding: "utf8" });
    console.log(`Перевірка ${check}: ${result.status === 0 ? "пройшла" : "НЕ пройшла"}`);
    if (result.status !== 0) console.log(`${result.stdout}${result.stderr}`.trim().split("\n").slice(-15).join("\n"));
  }
}

module.exports = { stamp, gitDirectory, askYes, isDirty, runChecks, resolveExportedFile };
