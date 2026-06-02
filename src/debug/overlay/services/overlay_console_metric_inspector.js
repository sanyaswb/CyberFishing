class OverlayConsoleMetricInspector {
  #resolver;

  constructor({ resolver = new OverlayMetricResolver() } = {}) {
    this.#resolver = resolver;
  }

  updateLiveData(data) {
    this.#resolver.updateLiveData(data);
  }

  inspect({ label, displayedValue, entry }) {
    if (!entry) return;

    const normalizedLabel = String(label || "").trim();
    const rows = (entry.paths || []).map((path) =>
      this.#resolver.buildParameterRow(path),
    );

    console.groupCollapsed(
      `%c[Overlay metric] ${normalizedLabel}`,
      "color:#73c2fb;font-weight:bold;",
    );
    console.log("Displayed value:", displayedValue || "n/a");
    console.log("Meaning:", entry.description || "n/a");
    console.log("Formula:", entry.formula || "n/a");
    console.table(rows);
    console.log("Live debug snapshot:", this.#resolver.buildSmallSnapshot());
    console.groupEnd();
  }
}

window.OverlayConsoleMetricInspector = OverlayConsoleMetricInspector;
