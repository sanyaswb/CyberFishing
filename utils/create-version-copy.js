const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");

const ROOT_DIR = path.resolve(__dirname, "..");

const VERSION_COPY_CONFIG = Object.freeze({
  versionsDir: "D:\\dev\\cyber fishing\\versions",
  folderPrefix: "scr_v",
  versionFile: "src/config/project_version.js",
  entries: Object.freeze([
    "src",
    "utils",
    "CHANGELOG.md",
    "index.html",
  ]),
});

class CliArguments {
  constructor(argv) {
    this.args = argv.slice(2);
  }

  has(flag) {
    return this.args.includes(flag);
  }

  getValue(flag) {
    const index = this.args.indexOf(flag);
    if (index === -1 || index === this.args.length - 1) return "";
    return this.args[index + 1];
  }
}

class ProjectVersionReader {
  constructor({ rootDir, versionFile }) {
    this.versionPath = path.join(rootDir, versionFile);
  }

  read() {
    const source = fs.readFileSync(this.versionPath, "utf8");
    const match = source.match(/const\s+CURRENT_PROJECT_VERSION\s*=\s*"([^"]+)";/u);

    if (!match) {
      throw new Error(`Cannot read CURRENT_PROJECT_VERSION from ${this.versionPath}`);
    }

    return match[1];
  }
}

class VersionCopyPlan {
  constructor({ rootDir, config, folderName }) {
    this.rootDir = rootDir;
    this.config = config;
    this.folderName = folderName;
    this.targetDir = path.join(config.versionsDir, folderName);
  }

  getEntries() {
    return this.config.entries.map((entry) => ({
      name: entry,
      sourcePath: path.join(this.rootDir, entry),
      targetPath: path.join(this.targetDir, entry),
    }));
  }
}

class ConsoleConflictResolver {
  constructor({ input = process.stdin, output = process.stdout } = {}) {
    this.input = input;
    this.output = output;
  }

  async resolve(targetDir) {
    const rl = readline.createInterface({
      input: this.input,
      output: this.output,
    });

    try {
      this.output.write(`Version copy already exists: ${targetDir}\n`);
      const answer = await rl.question("Choose action: overwrite (o), rename (r), cancel (c): ");
      const normalized = answer.trim().toLowerCase();

      if (normalized === "o" || normalized === "overwrite") return { action: "overwrite" };
      if (normalized === "r" || normalized === "rename") {
        const nextName = await rl.question("New folder name: ");
        return { action: "rename", folderName: nextName.trim() };
      }

      return { action: "cancel" };
    } finally {
      rl.close();
    }
  }
}

class VersionCopyWriter {
  constructor({ versionsDir }) {
    this.versionsDir = path.resolve(versionsDir);
  }

  prepareTarget(targetDir, { overwrite }) {
    const resolvedTarget = path.resolve(targetDir);
    this.#assertInsideVersionsDir(resolvedTarget);

    fs.mkdirSync(this.versionsDir, { recursive: true });

    if (!fs.existsSync(resolvedTarget)) return;
    if (!overwrite) {
      throw new Error(`Target already exists: ${resolvedTarget}`);
    }

    fs.rmSync(resolvedTarget, { recursive: true, force: true });
  }

  copy(plan) {
    fs.mkdirSync(plan.targetDir, { recursive: true });

    for (const entry of plan.getEntries()) {
      if (!fs.existsSync(entry.sourcePath)) {
        throw new Error(`Configured source does not exist: ${entry.sourcePath}`);
      }

      fs.cpSync(entry.sourcePath, entry.targetPath, {
        recursive: true,
        errorOnExist: false,
        force: true,
      });
    }
  }

  #assertInsideVersionsDir(targetDir) {
    const relative = path.relative(this.versionsDir, targetDir);
    if (relative.startsWith("..") || path.isAbsolute(relative) || relative === "") {
      throw new Error(`Refusing to overwrite unsafe target: ${targetDir}`);
    }
  }
}

class CreateVersionCopyCommand {
  constructor({
    rootDir = ROOT_DIR,
    config = VERSION_COPY_CONFIG,
    args = new CliArguments(process.argv),
    resolver = new ConsoleConflictResolver(),
    writer = new VersionCopyWriter({ versionsDir: config.versionsDir }),
    versionReader = new ProjectVersionReader({ rootDir, versionFile: config.versionFile }),
  } = {}) {
    this.rootDir = rootDir;
    this.config = config;
    this.args = args;
    this.resolver = resolver;
    this.writer = writer;
    this.versionReader = versionReader;
  }

  async run() {
    const folderName = this.#getRequestedFolderName();
    const resolution = await this.#resolvePlan(folderName);

    if (!resolution) {
      console.log("Version copy canceled.");
      return;
    }

    this.writer.prepareTarget(resolution.plan.targetDir, {
      overwrite: resolution.overwrite,
    });
    this.writer.copy(resolution.plan);

    console.log(`Created version copy: ${resolution.plan.targetDir}`);
    console.log("Copied entries:");
    for (const entry of resolution.plan.getEntries()) {
      console.log(`- ${entry.name}`);
    }
  }

  #getRequestedFolderName() {
    const explicitName = this.args.getValue("--name");
    if (explicitName) return explicitName;

    const version = this.versionReader.read();
    return `${this.config.folderPrefix}${version}`;
  }

  async #resolvePlan(folderName) {
    let nextFolderName = folderName;

    while (true) {
      const plan = new VersionCopyPlan({
        rootDir: this.rootDir,
        config: this.config,
        folderName: nextFolderName,
      });

      if (!fs.existsSync(plan.targetDir)) return { plan, overwrite: false };
      if (this.args.has("--overwrite")) return { plan, overwrite: true };

      const resolution = await this.resolver.resolve(plan.targetDir);
      if (resolution.action === "overwrite") return { plan, overwrite: true };

      if (resolution.action === "rename") {
        if (!resolution.folderName) {
          throw new Error("New folder name cannot be empty.");
        }

        nextFolderName = resolution.folderName;
        continue;
      }

      return null;
    }
  }
}

new CreateVersionCopyCommand().run().catch((error) => {
  console.error(`Version copy failed: ${error.message}`);
  process.exitCode = 1;
});
