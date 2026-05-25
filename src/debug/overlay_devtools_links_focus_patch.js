(function patchOverlayDevToolsLinkFocus() {
  if (typeof DevToolsPathNavigator === "undefined") return;

  DevToolsPathNavigator.prototype.focusPath = async function focusPath(path) {
    const normalizedPath = this.normalizePath(path);
    if (!normalizedPath) return false;

    await this.ensureDevToolsOpen();

    for (let attempt = 0; attempt < 4; attempt++) {
      await this.delay(attempt === 0 ? 80 : 120);
      await this.nextFrame();
      this.expandAllSections(document, 12);
      await this.nextFrame();

      const row = this.findRowForPath(normalizedPath);
      if (!row) continue;

      this.expandAncestorSections(row);
      await this.nextFrame();
      row.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      this.flashRow(row);
      return true;
    }

    console.warn("[Overlay → DevTools] Parameter path not found:", normalizedPath);
    return false;
  };

  DevToolsPathNavigator.prototype.findRowForPath = function findRowForPath(path) {
    const exact = this.findExactPathElement(path);
    if (exact) return exact;

    const parts = String(path).split(".").filter(Boolean);
    const root = parts.shift();
    const leaf = parts[parts.length - 1];
    if (!root || !leaf) return null;

    if (root === "CONFIG") {
      const scope = this.expandConfigPath(parts);
      return (
        this.findRowByFullPath(path) ||
        this.findRowByLeaf(scope || document, leaf) ||
        this.findRowByLeaf(document, leaf)
      );
    }

    if (root === "HOOKED_FISH") {
      const activeScope = this.expandSectionByText(document, "ACTIVE FISH") || document;
      this.expandAllSections(activeScope, 12);
      return (
        this.findRowByFullPath(path) ||
        this.findRowByLeaf(activeScope, leaf) ||
        this.findRowByLeaf(document, leaf)
      );
    }

    return this.findRowByFullPath(path) || this.findRowByLeaf(document, leaf);
  };

  DevToolsPathNavigator.prototype.findExactPathElement = function findExactPathElement(path) {
    const escaped = this.escapeCssString(path);
    const exactRow = document.querySelector(`.devtools-row[data-devtools-path="${escaped}"]`);
    if (exactRow) return exactRow;

    const exactLabel = document.querySelector(`.devtools-label[data-devtools-path="${escaped}"]`);
    if (exactLabel) return exactLabel.closest(".devtools-row") || exactLabel;

    return null;
  };

  DevToolsPathNavigator.prototype.findRowByFullPath = function findRowByFullPath(path) {
    const rows = [...document.querySelectorAll(".devtools-row")];
    const normalizedPath = this.normalizeLabel(path);
    return rows.find((row) => {
      const label = row.querySelector(".devtools-label");
      if (!label) return false;
      const title = this.normalizeLabel(label.title);
      const datasetPath = this.normalizeLabel(row.dataset.devtoolsPath || label.dataset.devtoolsPath || "");
      return datasetPath === normalizedPath || title.includes(normalizedPath);
    }) || null;
  };

  DevToolsPathNavigator.prototype.expandAncestorSections = function expandAncestorSections(element) {
    let current = element;
    const visited = new Set();

    while (current) {
      const section = current.closest?.(".devtools-section");
      if (!section || visited.has(section)) break;
      visited.add(section);
      this.expandSection(section);
      current = section.parentElement;
    }
  };

  DevToolsPathNavigator.prototype.escapeCssString = function escapeCssString(value) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(value);
    }
    return String(value).replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');
  };
})();
