"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");
const serialize = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

// Reads project bytes at the Stage 3.22 review checkpoint. Before the v0.24.59 release it returns
// the live bytes; afterwards an injected `beforeImage(file, bytes)` restores the release before-image
// so the recorded baseline and review replay exactly against the original starting point.
class PostFreezeWorkspace {
  constructor(root, { beforeImage = null } = {}) {
    this.root = path.resolve(root);
    this.beforeImage = beforeImage;
  }

  absolute(file) { return path.join(this.root, file); }
  exists(file) { return fs.existsSync(this.absolute(file)); }

  bytes(file) {
    const live = fs.readFileSync(this.absolute(file));
    return this.beforeImage ? Buffer.from(this.beforeImage(file, live)) : live;
  }

  text(file) { return this.bytes(file).toString("utf8"); }
  json(file) { return JSON.parse(this.text(file)); }
  fingerprint(file) { return { path: file, sha256: sha256(this.bytes(file)) }; }

  sourceFiles(directory = "src") {
    const files = [];
    const walk = relative => {
      for (const entry of fs.readdirSync(this.absolute(relative), { withFileTypes: true })) {
        const next = `${relative}/${entry.name}`;
        if (entry.isDirectory()) walk(next);
        else if (entry.isFile() && entry.name.endsWith(".js")) files.push(next);
      }
    };
    walk(directory);
    return files.sort();
  }
}

module.exports = { PostFreezeWorkspace, sha256, serialize };
