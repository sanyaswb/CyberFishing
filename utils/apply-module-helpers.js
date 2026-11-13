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

function describeLeafChanges(changes, direction) {
  const value = (item) => (item === undefined ? "немає" : JSON.stringify(item));
  const lines = changes.map((change) => `  ${change.path}: ${value(change.from)} -> ${value(change.to)}`);
  return `  (${direction})\n${lines.join("\n")}`;
}

// Shared workflow for apply:zones / apply:radio / apply:weather (spec 176): JSON parse, domain plan preparation,
// dirty check on changed modules only, conflict check (--force), diff output, confirmation (--yes), backup, write, checks.
async function runModuleApply({
  fileText,
  prepare,
  isDirty: checkDirty,
  confirm,
  backupDir,
  runChecks: executeChecks,
  log,
  now,
  yes = false,
  force = false,
}) {
  const refuse = (reason) => {
    log(`Не застосовано: ${reason}`);
    return "refused";
  };
  let file;
  try {
    file = JSON.parse(fileText);
  } catch (error) {
    return refuse(`файл не є JSON (${error.message})`);
  }
  const plan = await prepare(file, refuse);
  if (!plan) return "refused";
  const pending = plan.parts.filter((part) => part.changes.length > 0);
  for (const part of pending) {
    if (checkDirty(part.target)) {
      return refuse(`${part.target} має незакомічені зміни; закомітьте або відкиньте їх, щоб не затерти ручні правки`);
    }
  }
  const conflicts = plan.parts.filter((part) => part.currentHash !== part.baseHash);
  if (conflicts.length) {
    for (const part of conflicts) {
      log(part.conflictMessage);
      log(part.describe(part.changes, "код -> файл"));
    }
    if (!force) return refuse(plan.forceMessage);
  }
  if (!pending.length) {
    log(plan.unchangedMessage);
    return "unchanged";
  }
  for (const part of pending) {
    log(`Зміни для ${part.target}:`);
    log(part.describe(part.changes, "зараз -> буде"));
  }
  const targets = pending.map((part) => part.target).join(", ");
  if (!yes && !(await confirm(`Застосувати до ${targets}? (y/N) `))) {
    log("Скасовано. Нічого не змінено.");
    return "cancelled";
  }
  fs.mkdirSync(backupDir, { recursive: true });
  const prefix = stamp(now());
  for (const part of pending) {
    const backup = path.join(backupDir, part.backupFile(prefix));
    fs.copyFileSync(part.target, backup);
    fs.writeFileSync(part.target, part.source());
    log(`Записано ${part.target}. Бекап: ${backup}`);
    log(`Відкат: copy "${backup}" "${part.target}"`);
  }
  executeChecks();
  log(plan.reloadHint);
  return "applied";
}

module.exports = {
  stamp,
  gitDirectory,
  askYes,
  isDirty,
  runChecks,
  resolveExportedFile,
  describeLeafChanges,
  runModuleApply,
};
