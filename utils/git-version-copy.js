const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname, "..");

class ChangelogCommitSubjectReader {
  constructor({ changelogPath }) {
    this.changelogPath = changelogPath;
  }

  read() {
    const source = fs.readFileSync(this.changelogPath, "utf8");
    const line = source
      .split(/\r?\n/u)
      .find((entry) => /^##\s+/u.test(entry));
    if (!line) {
      throw new Error("Cannot find latest changelog heading like '## v0.0.0 - Title'.");
    }
    return line.replace(/^##\s+/u, "").trim();
  }
}

class CommandRunner {
  constructor({ cwd }) {
    this.cwd = cwd;
  }

  run(command, args, options = {}) {
    const useShell = this.#shouldUseShell(command);
    const result = spawnSync(
      useShell ? this.#toShellCommand(command, args) : this.#resolveCommand(command),
      useShell ? [] : args,
      {
      cwd: this.cwd,
      stdio: options.capture ? "pipe" : "inherit",
      encoding: "utf8",
      shell: useShell,
      },
    );

    if (result.error) {
      throw result.error;
    }
    if (options.allowFailure) return result;
    if (result.status !== 0) {
      throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
    }
    return result;
  }

  #resolveCommand(command) {
    if (command === "node") return process.execPath;
    return command;
  }

  #shouldUseShell(command) {
    return process.platform === "win32" && command === "npm";
  }

  #toShellCommand(command, args) {
    return [this.#resolveCommand(command), ...args.map((arg) => this.#quoteShellArg(arg))]
      .join(" ");
  }

  #quoteShellArg(value) {
    const text = String(value);
    if (/^[\w:./-]+$/u.test(text)) return text;
    return `"${text.replace(/(["^&|<>])/gu, "^$1")}"`;
  }
}

class GitVersionCopyWorkflow {
  constructor({
    rootDir,
    runner = new CommandRunner({ cwd: rootDir }),
    subjectReader = new ChangelogCommitSubjectReader({
      changelogPath: path.join(rootDir, "CHANGELOG.md"),
    }),
  }) {
    this.rootDir = rootDir;
    this.runner = runner;
    this.subjectReader = subjectReader;
  }

  run() {
    const subject = this.#resolveCommitSubject();

    this.runner.run("npm", ["run", "git:add"]);

    if (!this.#hasStagedChanges()) {
      console.log("No staged changes after git:add; skipping git commit.");
      this.#runVersionCopy();
      return;
    }

    this.runner.run("git", ["commit", "-m", subject]);
    this.#runVersionCopy();
  }

  #resolveCommitSubject() {
    const subject = this.subjectReader.read();
    const lastSubject = this.#lastCommitSubject();
    if (lastSubject !== subject) return subject;

    return `${subject} (follow-up ${this.#timestamp()})`;
  }

  #lastCommitSubject() {
    const result = this.runner.run(
      "git",
      ["log", "-1", "--pretty=%s"],
      { capture: true, allowFailure: true },
    );
    if (result.status !== 0) return "";
    return String(result.stdout || "").trim();
  }

  #hasStagedChanges() {
    const result = this.runner.run(
      "git",
      ["diff", "--cached", "--quiet"],
      { allowFailure: true },
    );
    return result.status !== 0;
  }

  #runVersionCopy() {
    this.runner.run("node", ["utils/create-version-copy.js"]);
  }

  #timestamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      "-",
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds()),
    ].join("");
  }
}

new GitVersionCopyWorkflow({ rootDir: ROOT_DIR }).run();
