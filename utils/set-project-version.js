const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const VERSION_FILE = path.join(ROOT, "src/config/project_version.js");

const nextVersion = process.argv[2];
const nextCodename = process.argv.slice(3).join(" ").trim();

if (!nextVersion || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(nextVersion)) {
  console.error("Usage: node utils/set-project-version.js <semver> [codename]");
  console.error("Example: node utils/set-project-version.js 0.17.5 architecture-cleanup");
  process.exit(1);
}

let source = fs.readFileSync(VERSION_FILE, "utf8");
source = source.replace(
  /const CURRENT_PROJECT_VERSION = "[^"]+";/u,
  `const CURRENT_PROJECT_VERSION = "${nextVersion}";`,
);

if (nextCodename) {
  source = source.replace(
    /codename: "[^"]+",/u,
    `codename: "${nextCodename.replace(/"/gu, "\\\"")}",`,
  );
}

const today = new Date().toISOString().slice(0, 10);
source = source.replace(/updatedAt: "[^"]+",/u, `updatedAt: "${today}",`);

fs.writeFileSync(VERSION_FILE, source);
console.log(`Updated project version to v${nextVersion}`);
