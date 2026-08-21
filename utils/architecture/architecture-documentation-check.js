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

class ArchitectureDocumentationCheck {
  constructor({ policyPath, documentPath, renderer }) {
    this.policyPath = policyPath;
    this.documentPath = documentPath;
    this.renderer = renderer;
  }

  run() {
    if (!fs.existsSync(this.documentPath)) {
      throw new Error(
        "Architecture document is missing. Run: npm run architecture:docs",
      );
    }
    const policy = ArchitecturePolicy.load(this.policyPath);
    const expected = this.renderer.render(policy);
    const actual = fs.readFileSync(this.documentPath, "utf8");
    if (actual !== expected) {
      throw new Error(
        "Architecture document is out of sync with module_architecture.json. " +
          "Run: npm run architecture:docs",
      );
    }
    console.log("Architecture documentation matches the executable policy.");
  }
}

new ArchitectureDocumentationCheck({
  policyPath: POLICY_PATH,
  documentPath: DOCUMENT_PATH,
  renderer: new ArchitectureDocumentRenderer(),
}).run();
