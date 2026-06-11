const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const strict = process.argv.includes("--strict");
const files = [];

function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collect(fullPath);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }
}

function count(source, pattern) {
  return (source.match(pattern) || []).length;
}

collect(path.join(ROOT, "src"));

const findings = [];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(ROOT, file).replaceAll("\\", "/");
  const globalAdds = count(
    source,
    /(?:window|document)\.addEventListener\s*\(/g,
  );
  const globalRemoves = count(
    source,
    /(?:window|document)\.removeEventListener\s*\(/g,
  );
  const intervals = count(source, /\bsetInterval\s*\(/g);
  const clearedIntervals = count(source, /\bclearInterval\s*\(/g);
  const animationFrames = count(source, /\brequestAnimationFrame\s*\(/g);
  const cancelledFrames = count(source, /\bcancelAnimationFrame\s*\(/g);

  if (globalAdds > globalRemoves) {
    findings.push({
      severity: "review",
      file: relative,
      message:
        `${globalAdds} global listener add(s), ` +
        `${globalRemoves} removal(s). Verify page-lifetime intent or dispose().`,
    });
  }
  if (intervals > clearedIntervals) {
    findings.push({
      severity: "error",
      file: relative,
      message:
        `${intervals} setInterval call(s), ` +
        `${clearedIntervals} clearInterval call(s).`,
    });
  }
  if (animationFrames > 1 && cancelledFrames === 0) {
    findings.push({
      severity: "review",
      file: relative,
      message:
        `${animationFrames} requestAnimationFrame call(s) without cancellation. ` +
        "Verify they are one-shot UI updates rather than loops.",
    });
  }
}

console.log("Memory leak static audit:");
if (findings.length === 0) {
  console.log("- no lifecycle patterns require review");
} else {
  for (const finding of findings) {
    const output = finding.severity === "error" ? console.error : console.warn;
    output(
      `- [${finding.severity}] ${finding.file}: ${finding.message}`,
    );
  }
}

const errors = findings.filter((finding) => finding.severity === "error");
console.log(
  `Summary: ${files.length} files, ${findings.length} finding(s), ` +
  `${errors.length} error(s).`,
);
if (strict && findings.length > 0) process.exitCode = 1;
else if (errors.length > 0) process.exitCode = 1;
