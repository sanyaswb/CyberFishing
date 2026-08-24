const fs = require("node:fs");
const path = require("node:path");

class DomainAuditArtifactWriter {
  constructor(filePath) {
    this.filePath = filePath;
  }

  write(document) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(
      this.filePath,
      `${JSON.stringify(document, null, 2)}\n`,
      "utf8",
    );
  }
}

module.exports = { DomainAuditArtifactWriter };
