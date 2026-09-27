"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

// History-only checks of batches up to BASE.batch replay a frozen past. They run in the exact
// reconstruction of release BASE.release (with the current tooling copied in) instead of the live
// tree, so their sealed inputs change only when their tooling changes. The reconstruction peels
// every newer batch with its recorded before-images; any drift fails the reconstruction itself.
const BASE = Object.freeze({ release: "0.24.63", batch: "025" });
const DATA = Object.freeze(["src", "architecture", "dist/stage-3-compat-runtime", "index.html", "package.json",
  "package-lock.json", "CHANGELOG.md", "refactor_Task.txt"]);
const sha = value => crypto.createHash("sha256").update(value).digest("hex");

class HistoryBase {
  constructor(root) {
    this.root = path.resolve(root);
    // One base per project root: snapshot copies share node_modules with the live tree.
    this.cache = path.join(this.root, "node_modules", ".cache", "cyber-history-base", sha(this.root).slice(0, 12));
    this.directory = path.join(this.cache, BASE.release);
  }

  // Checks registered only in the history suite whose batch is not newer than the base.
  static covers(check) {
    if (check.suites.length !== 1 || check.suites[0] !== "history") return false;
    const batch = check.id.match(/^stage-3-batch-(\d{3})-/u)?.[1];
    return !batch || batch <= BASE.batch;
  }

  #walk(root, relative, visit) {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) return;
    if (fs.statSync(absolute).isFile()) { visit(relative); return; }
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = `${relative}/${entry.name}`;
      if (entry.isDirectory()) this.#walk(root, child, visit);
      else if (entry.isFile()) visit(child);
    }
  }

  // Fingerprint of the project data under root (the live tree or the base).
  fingerprint(root = this.root) {
    const lines = [];
    for (const item of DATA) {
      this.#walk(root, item, file => lines.push(`${file}\0${sha(fs.readFileSync(path.join(root, file)))}`));
    }
    return sha(lines.join("\n"));
  }

  #copyInto(sourceRoot, target) {
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(target, { recursive: true });
    for (const item of DATA) {
      const source = path.join(sourceRoot, item);
      if (fs.existsSync(source)) fs.cpSync(source, path.join(target, item), { recursive: true });
    }
  }

  async #reconstruct(target) {
    const state = JSON.parse(fs.readFileSync(path.join(this.root, "architecture/migration/stage_3_execution_state.json")));
    if (state.releaseVersion === BASE.release && state.activeBatchId === null) {
      this.#copyInto(this.root, target);
      return;
    }
    // The first shared batch after the base reverses itself and every newer batch.
    const { StageThreeBatchRegistry } = require("../../architecture/stage_three_batches/core/batch_definition");
    const { StageThreeHistoricalWorkspace } = require("../../architecture/stage_three_batches/lifecycle/historical_workspace");
    const next = String(Number(BASE.batch) + 1).padStart(3, "0");
    await new StageThreeHistoricalWorkspace(StageThreeBatchRegistry.load(next), StageThreeBatchRegistry)
      .run(this.root, prior => this.#copyInto(prior, target));
    const reconstructed = JSON.parse(fs.readFileSync(path.join(target, "architecture/migration/stage_3_execution_state.json")));
    if (reconstructed.releaseVersion !== BASE.release || reconstructed.activeBatchId !== null) {
      throw new Error(`History base reconstruction is not release ${BASE.release}`);
    }
  }

  // Returns the base project root with the current tooling. The base is reused only while both the
  // live data and the base itself are byte-identical to the last reconstruction.
  async prepare() {
    const marker = path.join(this.cache, `${BASE.release}.json`);
    const head = this.fingerprint();
    const recorded = fs.existsSync(marker) ? JSON.parse(fs.readFileSync(marker, "utf8")) : null;
    const reusable = recorded && recorded.head === head && fs.existsSync(this.directory) &&
      this.fingerprint(this.directory) === recorded.base;
    if (!reusable) {
      await this.#reconstruct(this.directory);
      fs.mkdirSync(this.cache, { recursive: true });
      fs.writeFileSync(marker, JSON.stringify({ head, base: this.fingerprint(this.directory) }));
    }
    const utils = path.join(this.directory, "utils");
    fs.rmSync(utils, { recursive: true, force: true });
    fs.cpSync(path.join(this.root, "utils"), utils, { recursive: true });
    const modules = path.join(this.directory, "node_modules");
    if (!fs.existsSync(modules)) fs.symlinkSync(path.join(this.root, "node_modules"), modules, "junction");
    return this.directory;
  }
}

module.exports = { HistoryBase, BASE };
