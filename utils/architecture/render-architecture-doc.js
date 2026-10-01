const fs = require("node:fs");
const path = require("node:path");
const { ArchitecturePolicy } = require("./core/architecture_policy");
const {
  ArchitectureDocumentRenderer,
} = require("./core/architecture_document_renderer");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const POLICY_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "module_architecture.json",
);
const DOCUMENT_PATH = path.join(
  PROJECT_ROOT,
  "docs",
  "architecture",
  "module_architecture.md",
);

class ArchitectureDocumentCommand {
  constructor({ policyPath, documentPath, renderer }) {
    this.policyPath = policyPath;
    this.documentPath = documentPath;
    this.renderer = renderer;
  }

  run() {
    const policy = ArchitecturePolicy.load(this.policyPath);
    const document = this.renderer.render(policy);
    fs.mkdirSync(path.dirname(this.documentPath), { recursive: true });
    fs.writeFileSync(this.documentPath, document);
    console.log(`Architecture document written to ${this.documentPath}`);
  }
}

new ArchitectureDocumentCommand({
  policyPath: POLICY_PATH,
  documentPath: DOCUMENT_PATH,
  renderer: new ArchitectureDocumentRenderer(),
}).run();
