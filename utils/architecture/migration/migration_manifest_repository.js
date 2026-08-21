const fs = require("node:fs");
const path = require("node:path");

class MigrationManifestRepository {
  constructor(manifestPath) {
    this.manifestPath = manifestPath;
  }

  read() {
    if (!fs.existsSync(this.manifestPath)) return null;
    return JSON.parse(fs.readFileSync(this.manifestPath, "utf8"));
  }

  write(manifest) {
    fs.mkdirSync(path.dirname(this.manifestPath), { recursive: true });
    fs.writeFileSync(
      this.manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }
}

module.exports = { MigrationManifestRepository };
