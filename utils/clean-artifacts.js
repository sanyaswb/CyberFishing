"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MAX_RECORDS = 50;
const SERVICE_DIRECTORIES = ["tmp", "temp", "logs", "archive", "archives", "generated"];
const TEXT_EXTENSIONS = new Set([".log", ".txt", ".out", ".jsonl", ".ndjson"]);
const LINE_ENDING_WARNING = /^warning: in the working copy of .*, (?:LF|CRLF) will be replaced by (?:CRLF|LF) the next time Git touches it$/u;

// Only generated service text is eligible; source, baselines and structured data are left intact.
function trimServiceFile(filePath) {
  const bytes = fs.readFileSync(filePath);
  const utf16 = bytes[0] === 0xff && bytes[1] === 0xfe;
  const encoding = utf16 ? "utf16le" : "utf8";
  const source = bytes.toString(encoding);
  if (source.includes("\0") || !Buffer.from(source, encoding).equals(bytes)) return "unchanged";
  const bom = source.startsWith("\ufeff") ? "\ufeff" : "";
  const records = source.replace(/^\ufeff/u, "").split(/\r\n|\n|\r/u)
    .filter((line) => line.trim() && !LINE_ENDING_WARNING.test(line));
  if (records.length === 0) {
    fs.unlinkSync(filePath);
    return "removed";
  }
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const retained = bom + records.slice(-MAX_RECORDS).join(newline) + newline;
  if (retained === source) return "unchanged";
  fs.writeFileSync(filePath, retained, encoding);
  return "trimmed";
}

function trimServiceLogs(rootDir) {
  const result = { trimmed: 0, removed: 0, unchanged: 0 };
  const visit = (directory, serviceText = false) => {
    if (!fs.existsSync(directory) || fs.lstatSync(directory).isSymbolicLink()) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory() && serviceText) visit(filePath, true);
      if (!entry.isFile()) continue;
      const extension = path.extname(entry.name).toLowerCase();
      if (serviceText ? TEXT_EXTENSIONS.has(extension) : extension === ".log") {
        result[trimServiceFile(filePath)] += 1;
      }
    }
  };
  for (const parent of [rootDir, path.join(rootDir, "utils")]) {
    if (!fs.existsSync(parent) || fs.lstatSync(parent).isSymbolicLink()) continue;
    visit(parent);
    for (const name of SERVICE_DIRECTORIES) visit(path.join(parent, name), true);
  }
  return result;
}

if (require.main === module) {
  try {
    const result = trimServiceLogs(path.resolve(__dirname, ".."));
    console.log(`Service artifacts: ${result.trimmed} trimmed, ${result.removed} empty/noise-only files removed; maximum ${MAX_RECORDS} records per file.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { MAX_RECORDS, trimServiceLogs };
