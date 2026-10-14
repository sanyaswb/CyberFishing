"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { MAX_RECORDS, trimServiceLogs } = require("./clean-artifacts.js");

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-fishing-artifacts-"));
const root = path.join(sandbox, "project");
const records = Array.from({ length: 675 }, (_, index) => `record ${index + 1}`);
const warning = "warning: in the working copy of 'releases/old/src/file.js', LF will be replaced by CRLF the next time Git touches it";
const write = (file, source, encoding = "utf8") => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source, encoding);
  return target;
};

try {
  assert.equal(MAX_RECORDS, 50);
  const longLog = write("utils/tmp/run.log", records.join("\n") + "\n");
  const warningLog = write("utils/tmp/stage.log", Array(675).fill(warning).join("\n"));
  const emptyLog = write("utils/tmp/empty.log", "\n\r\n  \n");
  const shortLog = write("utils/latest.log", "Passed 43 checks.\n");
  const rootLog = write("release.log", warning + "\r\nRelease succeeded.\r\n");
  const archivedLog = write("utils/archive/old/output.txt", records.join("\r\n") + "\r\n");
  const utf16Log = write("temp/windows.log", "\ufeff" + records.join("\r\n") + "\r\n", "utf16le");
  const jsonlLog = write("logs/events.jsonl", records.map((record) => JSON.stringify({ record })).join("\n"));
  const protectedFiles = [
    write("docs/history.txt", records.join("\n")),
    write("utils/testing/baselines/result.txt", records.join("\n")),
    write("utils/generated/snapshot.json", JSON.stringify({ records }, null, 2)),
    write("utils/tmp/fixture.js", records.join("\n")),
    write("utils/tmp/binary.txt", Buffer.from([0, 1, 2, 3])),
    write("utils/tmp/unknown-encoding.txt", Buffer.from([0xff, 0x80, 0x81])),
  ];
  const originals = protectedFiles.map((file) => fs.readFileSync(file));
  const outside = path.join(sandbox, "outside");
  fs.mkdirSync(outside);
  const outsideLog = path.join(outside, "untouched.log");
  fs.writeFileSync(outsideLog, records.join("\n"));
  fs.symlinkSync(outside, path.join(root, "utils/tmp/external"), process.platform === "win32" ? "junction" : "dir");

  const result = trimServiceLogs(root);
  assert.deepEqual(result, { trimmed: 5, removed: 2, unchanged: 3 });
  assert.equal(fs.readFileSync(longLog, "utf8"), records.slice(-50).join("\n") + "\n");
  assert.equal(fs.existsSync(warningLog), false);
  assert.equal(fs.existsSync(emptyLog), false);
  assert.equal(fs.readFileSync(shortLog, "utf8"), "Passed 43 checks.\n");
  assert.equal(fs.readFileSync(rootLog, "utf8"), "Release succeeded.\r\n");
  assert.equal(fs.readFileSync(archivedLog, "utf8"), records.slice(-50).join("\r\n") + "\r\n");
  assert.equal(fs.readFileSync(utf16Log, "utf16le"), "\ufeff" + records.slice(-50).join("\r\n") + "\r\n");
  assert.deepEqual(fs.readFileSync(jsonlLog, "utf8").trim().split("\n").map(JSON.parse),
    records.slice(-50).map((record) => ({ record })));
  protectedFiles.forEach((file, index) => assert.deepEqual(fs.readFileSync(file), originals[index]));
  assert.equal(fs.readFileSync(outsideLog, "utf8"), records.join("\n"));
  assert.deepEqual(trimServiceLogs(root), { trimmed: 0, removed: 0, unchanged: 8 });

  const linkedRoot = path.join(sandbox, "linked-project");
  fs.mkdirSync(linkedRoot);
  fs.symlinkSync(outside, path.join(linkedRoot, "utils"), process.platform === "win32" ? "junction" : "dir");
  const outsideNested = path.join(outside, "tmp");
  fs.mkdirSync(outsideNested);
  const linkedLog = path.join(outsideNested, "linked.log");
  fs.writeFileSync(linkedLog, records.join("\n"));
  trimServiceLogs(linkedRoot);
  assert.equal(fs.readFileSync(linkedLog, "utf8"), records.join("\n"));
  console.log("Service artifacts passed: 50 latest records, noise removal, idempotence, UTF-16/CRLF, JSONL, protected files and external links.");
} finally {
  assert.equal(path.dirname(sandbox), path.resolve(os.tmpdir()));
  assert.match(path.basename(sandbox), /^cyber-fishing-artifacts-[\w-]+$/u);
  fs.rmSync(sandbox, { recursive: true, force: true });
}
