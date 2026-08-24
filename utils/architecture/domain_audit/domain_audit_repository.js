const fs = require("node:fs");
const { DomainAuditDocument } = require("./domain_audit_models");

class DomainAuditRepository {
  constructor(filePath) {
    this.filePath = filePath;
  }

  exists() {
    return fs.existsSync(this.filePath);
  }

  readBytes() {
    return fs.readFileSync(this.filePath, "utf8");
  }

  read() {
    return new DomainAuditDocument(JSON.parse(this.readBytes()));
  }
}

module.exports = { DomainAuditRepository };
