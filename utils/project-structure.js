const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");

function trackedFiles() {
  const args = ["ls-files", "-z"];
  const options = { cwd: ROOT, encoding: "utf8", windowsHide: true };
  let result = spawnSync(process.env.GIT_EXECUTABLE || "git", args, options);
  if (result.error?.code === "ENOENT" && !process.env.GIT_EXECUTABLE && process.platform === "win32") {
    result = spawnSync(path.join(process.env.ProgramFiles || "C:/Program Files", "Git/cmd/git.exe"), args, options);
  }
  if (result.error || result.status !== 0) {
    throw result.error || new Error(result.stderr.trim() || "git ls-files failed");
  }
  return result.stdout.split("\0").filter(Boolean);
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
  const files = trackedFiles();
  fs.writeFileSync(path.join(ROOT, "project-structure.txt"), renderTree(files), "utf8");
  console.log(`Project structure generated from ${files.length} Git-tracked files.`);
}

module.exports = { trackedFiles, renderTree };
