const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const espree = require("espree");
const { SourceFileScanner } = require("./migration/source_file_scanner");
const {
  LegacyScriptOrderReader,
} = require("./migration/legacy_script_order_reader");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const SOURCE_ROOT = path.join(PROJECT_ROOT, "src");

class CommandArguments {
  constructor(argv) {
    this.argv = argv;
  }

  parse() {
    return {
      outputPath: this.#readValue("--write"),
      gitExecutable: this.#readValue("--git-executable") || "git",
      verifiedChecks: this.#readNumber("--verified-checks"),
    };
  }

  #readNumber(option) {
    const value = this.#readValue(option);
    if (value === null) return null;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0) {
      throw new Error(`${option} requires a non-negative integer`);
    }
    return number;
  }

  #readValue(option) {
    const index = this.argv.indexOf(option);
    if (index < 0) return null;
    const value = this.argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${option} requires a value`);
    }
    return value;
  }
}

class JavaScriptArchitectureScanner {
  scan(filePath, currentPath) {
    const syntaxTree = this.#parse(fs.readFileSync(filePath, "utf8"));
    const result = {
      importDeclarations: 0,
      exportDeclarations: 0,
      globalAssignments: [],
    };
    this.#walk(syntaxTree, (node) => {
      if (node.type === "ImportDeclaration") {
        result.importDeclarations += 1;
      }
      if (
        node.type === "ExportNamedDeclaration" ||
        node.type === "ExportDefaultDeclaration" ||
        node.type === "ExportAllDeclaration"
      ) {
        result.exportDeclarations += 1;
      }
      if (node.type === "AssignmentExpression") {
        const assignment = this.#readGlobalAssignment(node.left);
        if (assignment) {
          result.globalAssignments.push({
            scope: assignment.scope,
            property: assignment.property,
            currentPath,
            line: node.loc.start.line,
            operator: node.operator,
          });
        }
      }
    });
    return result;
  }

  #parse(source) {
    const options = {
      ecmaVersion: "latest",
      loc: true,
    };
    try {
      return espree.parse(source, { ...options, sourceType: "script" });
    } catch (scriptError) {
      try {
        return espree.parse(source, { ...options, sourceType: "module" });
      } catch {
        throw scriptError;
      }
    }
  }

  #readGlobalAssignment(left) {
    if (left.type !== "MemberExpression") return null;
    if (left.object.type !== "Identifier") return null;
    if (left.object.name !== "window" && left.object.name !== "globalThis") {
      return null;
    }
    if (!left.computed && left.property.type === "Identifier") {
      return { scope: left.object.name, property: left.property.name };
    }
    if (
      left.computed &&
      left.property.type === "Literal" &&
      typeof left.property.value === "string"
    ) {
      return { scope: left.object.name, property: left.property.value };
    }
    return { scope: left.object.name, property: "<dynamic>" };
  }

  #walk(node, visit) {
    if (!node || typeof node !== "object") return;
    visit(node);
    for (const [key, value] of Object.entries(node)) {
      if (key === "loc" || key === "range") continue;
      if (Array.isArray(value)) {
        for (const child of value) this.#walk(child, visit);
      } else {
        this.#walk(value, visit);
      }
    }
  }
}

class ProjectVersionReader {
  constructor(versionFilePath) {
    this.versionFilePath = versionFilePath;
  }

  read() {
    const source = fs.readFileSync(this.versionFilePath, "utf8");
    const match = source.match(/CURRENT_PROJECT_VERSION\s*=\s*["']([^"']+)["']/);
    if (!match) throw new Error("CURRENT_PROJECT_VERSION was not found");
    return match[1];
  }
}

class GitRevisionReader {
  constructor({ executable, projectRoot }) {
    this.executable = executable;
    this.projectRoot = projectRoot;
  }

  readCommit() {
    return this.#run(["rev-parse", "HEAD"]);
  }

  readBranch() {
    return this.#run(["branch", "--show-current"]);
  }

  #run(args) {
    return execFileSync(this.executable, args, {
      cwd: this.projectRoot,
      encoding: "utf8",
    }).trim();
  }
}

class ArchitectureBaselineCollector {
  constructor({
    projectRoot,
    sourceCatalog,
    scriptInventory,
    sourceScanner,
    versionReader,
    gitRevisionReader,
  }) {
    this.projectRoot = projectRoot;
    this.sourceCatalog = sourceCatalog;
    this.scriptInventory = scriptInventory;
    this.sourceScanner = sourceScanner;
    this.versionReader = versionReader;
    this.gitRevisionReader = gitRevisionReader;
  }

  collect({ verifiedChecks = null } = {}) {
    const sourceFiles = this.sourceCatalog
      .scan()
      .map((sourceFile) => sourceFile.absolutePath);
    const legacyScripts = this.scriptInventory.read().map((script) => ({
      legacyLoadOrder: script.legacyLoadOrder,
      currentPath: script.currentPath,
      source: script.source,
      type: script.type,
    }));
    const globalAssignments = [];
    let importDeclarations = 0;
    let exportDeclarations = 0;

    for (const filePath of sourceFiles) {
      const currentPath = this.#relative(filePath);
      const scan = this.sourceScanner.scan(filePath, currentPath);
      importDeclarations += scan.importDeclarations;
      exportDeclarations += scan.exportDeclarations;
      globalAssignments.push(...scan.globalAssignments);
    }

    const windowAssignments = globalAssignments.filter(
      (assignment) => assignment.scope === "window",
    );
    const globalThisAssignments = globalAssignments.filter(
      (assignment) => assignment.scope === "globalThis",
    );
    const projectVersion = this.versionReader.read();

    return {
      schemaVersion: 1,
      projectVersion,
      generatedAt: new Date().toISOString(),
      repository: {
        commit: this.gitRevisionReader.readCommit(),
        branch: this.gitRevisionReader.readBranch(),
      },
      verification: {
        command: "node utils/run-checks.js --suite all",
        status: verifiedChecks === null ? "not-recorded" : "passed",
        passedChecks: verifiedChecks,
      },
      countingRules: {
        sourceJavaScriptFiles: "All .js files recursively under src/.",
        legacyScriptTags:
          "Script elements with a src attribute in index.html, in document order.",
        esmDeclarations:
          "Top-level ESTree import/export declaration nodes parsed by Espree.",
        globalAssignments:
          "ESTree AssignmentExpression nodes whose direct left-hand object is window or globalThis; equality comparisons and property reads are excluded.",
        debugJavaScriptFiles: "All .js files recursively under src/debug/.",
      },
      metrics: {
        sourceJavaScriptFiles: sourceFiles.length,
        legacyScriptTags: legacyScripts.length,
        classicScriptTags: legacyScripts.filter(
          (script) => script.type === "classic",
        ).length,
        moduleScriptTags: legacyScripts.filter(
          (script) => script.type === "module",
        ).length,
        esmImportDeclarations: importDeclarations,
        esmExportDeclarations: exportDeclarations,
        directGlobalAssignments: globalAssignments.length,
        windowAssignments: windowAssignments.length,
        globalThisAssignments: globalThisAssignments.length,
        distinctWindowProperties: this.#distinctPropertyCount(windowAssignments),
        distinctGlobalThisProperties:
          this.#distinctPropertyCount(globalThisAssignments),
        debugJavaScriptFiles: sourceFiles.filter((filePath) =>
          this.#relative(filePath).startsWith("src/debug/"),
        ).length,
      },
      sourceFiles: sourceFiles.map((filePath) => this.#relative(filePath)),
      legacyScripts,
      globalAssignments: globalAssignments.sort((left, right) =>
        `${left.scope}:${left.currentPath}:${left.line}`.localeCompare(
          `${right.scope}:${right.currentPath}:${right.line}`,
        ),
      ),
    };
  }

  #distinctPropertyCount(assignments) {
    return new Set(assignments.map((assignment) => assignment.property)).size;
  }

  #relative(filePath) {
    return path.relative(this.projectRoot, filePath).replaceAll("\\", "/");
  }
}

class BaselineFileWriter {
  write(outputPath, baseline) {
    const absolutePath = path.resolve(PROJECT_ROOT, outputPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, `${JSON.stringify(baseline, null, 2)}\n`);
    return absolutePath;
  }
}

class CollectBaselineCommand {
  constructor({ collector, writer }) {
    this.collector = collector;
    this.writer = writer;
  }

  run(options) {
    const baseline = this.collector.collect({
      verifiedChecks: options.verifiedChecks,
    });
    if (!options.outputPath) {
      process.stdout.write(`${JSON.stringify(baseline, null, 2)}\n`);
      return;
    }
    const outputPath = this.writer.write(options.outputPath, baseline);
    console.log(`Architecture baseline written to ${outputPath}`);
  }
}

const options = new CommandArguments(process.argv.slice(2)).parse();
const gitRevisionReader = new GitRevisionReader({
  executable: options.gitExecutable,
  projectRoot: PROJECT_ROOT,
});
const collector = new ArchitectureBaselineCollector({
  projectRoot: PROJECT_ROOT,
  sourceCatalog: new SourceFileScanner({
    projectRoot: PROJECT_ROOT,
    sourceRoot: SOURCE_ROOT,
  }),
  scriptInventory: new LegacyScriptOrderReader(
    path.join(PROJECT_ROOT, "index.html"),
  ),
  sourceScanner: new JavaScriptArchitectureScanner(),
  versionReader: new ProjectVersionReader(
    path.join(SOURCE_ROOT, "config", "project_version.js"),
  ),
  gitRevisionReader,
});
new CollectBaselineCommand({
  collector,
  writer: new BaselineFileWriter(),
}).run(options);
