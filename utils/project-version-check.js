const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const VERSION_FILE = path.join(ROOT, "src/config/project_version.js");
const INDEX_FILE = path.join(ROOT, "index.html");

const context = vm.createContext({ console, window: {} });
vm.runInContext(fs.readFileSync(VERSION_FILE, "utf8"), context, {
  filename: "src/config/project_version.js",
});

const version = vm.runInContext("PROJECT_VERSION_CONFIG.version", context);
const label = vm.runInContext("PROJECT_VERSION_CONFIG.label", context);
const html = fs.readFileSync(INDEX_FILE, "utf8");

const errors = [];
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  errors.push(`Invalid semantic version: ${version}`);
}
if (!html.includes("src/config/project_version.js")) {
  errors.push("index.html does not load src/config/project_version.js");
}
if (!html.includes("src/ui/version_badge.js")) {
  errors.push("index.html does not load src/ui/version_badge.js");
}
if (!html.includes("gameVersionBadge")) {
  errors.push("index.html does not contain #gameVersionBadge");
}

if (errors.length) {
  console.error("Project version check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Project version check passed: ${label}`);
