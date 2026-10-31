"use strict";

// TK-167 / incident I-10: shipped text files are valid single-encoded UTF-8. A tool that read a UTF-8 file as the ANSI
// code page and wrote it back as UTF-8 (Windows PowerShell 5.1 Get-Content without -Encoding) turned the version badge's
// aria-label "Поточна версія гри" into "ÐŸÐ¾Ñ‚Ð¾Ñ‡Ð½Ð°…" in index.html and dev.html (6363e51c, v0.48.45..v0.49.35).
// Double-encoded Cyrillic shows as Ð or Ñ followed by what a UTF-8 continuation byte (0x80..0xBF) becomes in
// Windows-1252. Specs, tasks and docs may quote the broken text, so they are not scanned.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../../..");
const SHIPPED = /^(?:[^/]+\.html|src\/.+\.(?:js|css|json)|assets\/.+\.(?:svg|json|atlas)|vendor\/manifest\.json)$/u;
const CP1252_CONTINUATION = " -¿€‚ƒ„…†‡ˆ‰Š‹ŒŽ"
  + "‘’“”•–—˜™š›œžŸ";
const DOUBLE_ENCODED = new RegExp(`[ÐÑ][${CP1252_CONTINUATION}]`, "u");

function findDoubleEncoded(text) {
  const lines = text.split("\n");
  const index = lines.findIndex((line) => DOUBLE_ENCODED.test(line));
  return index === -1 ? null : { line: index + 1, text: lines[index].trim().slice(0, 80) };
}

// The detector itself: the broken badge label is caught, correct Cyrillic, Latin and plain symbols are not.
assert(findDoubleEncoded('aria-label="ÐŸÐ¾Ñ‚Ð¾Ñ‡Ð½Ð° Ð²ÐµÑ€ÑÑ–Ñ Ð³Ñ€Ð¸"'), "double-encoded Cyrillic is detected");
assert.equal(findDoubleEncoded('aria-label="Поточна версія гри"'), null, "correct Cyrillic passes");
assert.equal(findDoubleEncoded("const x = \"Café — 50 °C, © 2026\";"), null, "Latin text and symbols pass");

const files = spawnSync("git", ["ls-files", "-z"], { cwd: ROOT }).stdout.toString("utf8").split("\0")
  .filter((file) => SHIPPED.test(file) && fs.existsSync(path.join(ROOT, file)));
assert(files.includes("index.html") && files.includes("dev.html") && files.length > 500, "the shipped text files are scanned");
for (const file of files) {
  const bytes = fs.readFileSync(path.join(ROOT, file));
  const text = bytes.toString("utf8");
  assert(!text.includes("�"), `${file} is not valid UTF-8 (replacement character)`);
  const found = findDoubleEncoded(text);
  assert.equal(found, null, found && `${file}:${found.line} holds double-encoded UTF-8: ${found.text}`);
}
console.log(`Text encoding passed: ${files.length} shipped text files are single-encoded UTF-8 (no replacement characters, no `
  + "Windows-1252 double encoding).");
