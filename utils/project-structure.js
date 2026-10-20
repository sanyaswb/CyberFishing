const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { ReleaseFileSet } = require("./build-pages-release.js");

const ROOT = path.resolve(__dirname, "..");

function trackedFiles(rootDir = ROOT) {
  const args = ["ls-files", "-z"];
  const options = { cwd: rootDir, encoding: "utf8", windowsHide: true };
  let result = spawnSync(process.env.GIT_EXECUTABLE || "git", args, options);
  if (result.error?.code === "ENOENT" && !process.env.GIT_EXECUTABLE && process.platform === "win32") {
    result = spawnSync(path.join(process.env.ProgramFiles || "C:/Program Files", "Git/cmd/git.exe"), args, options);
  }
  if (result.error || result.status !== 0) {
    throw result.error || new Error(result.stderr.trim() || "git ls-files failed");
  }
  return result.stdout.split("\0").filter(file => file && fs.existsSync(path.join(rootDir, file)));
}

// Follow the current production page, not every file in the repository. The release collector
// owns stylesheet/module traversal, dynamic runtime assets and vendor licence selection.
function productionFiles({ rootDir = ROOT, files = trackedFiles(rootDir) } = {}) {
  const available = new Set(files);
  const read = file => fs.readFileSync(path.join(rootDir, file));
  return ReleaseFileSet.collect({
    paths: () => available,
    has: file => available.has(file),
    read,
    readAll: requested => new Map(requested.map(file => [file, read(file)])),
  }, { pages: ["index.html"] });
}

function renderTree(files) {
  const root = new Map();
  for (const file of files) {
    let branch = root;
    for (const part of file.split("/")) {
      if (!branch.has(part)) branch.set(part, new Map());
      branch = branch.get(part);
    }
  }
  const lines = [];
  function visit(branch, prefix) {
    const entries = [...branch].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    entries.forEach(([name, children], index) => {
      const last = index === entries.length - 1;
      lines.push(prefix + (last ? "└── " : "├── ") + name);
      visit(children, prefix + (last ? "   " : "│  "));
    });
  }
  visit(root, "");
  return lines.join("\n") + "\n";
}

if (require.main === module) {
  const files = productionFiles();
  fs.writeFileSync(path.join(ROOT, "project-structure.txt"), renderTree(files), "utf8");
  console.log(`Production structure generated from ${files.length} release files.`);
}

module.exports = { trackedFiles, productionFiles, renderTree };
