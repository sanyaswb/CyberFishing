const OPEN_KEY = "openMetricHints";
// The DevTools roots a metric's parameter can be opened in (TK-309).
const REVEALABLE_ROOTS = Object.freeze(["CONFIG.", "HOOKED_FISH.", "ITEM_DB.", "FISH_DB.", "MAP_DB."]);

// TK-396 (spec 186 Q2, owner: «підказка під рядком»): a metric's explanation on the screen, like a DevTools «i» hint —
// the owner on a phone has no console. A press on a metric's name opens it under the row and a second one closes it:
// what the metric is, its formula, its parameters with their values now, and a button that opens each parameter
// DevTools can show. Which hints are open lives in the overlay's view state (OverlayViewStateStore), so a change
// redraws the windows and the hint stays open across the overlay's updates (it is part of the rendered HTML).
export class OverlayMetricHints {
  #catalog;
  #resolver;
  #viewState;

  // catalog: OverlayMetricCatalog (getEntry); resolver: OverlayMetricResolver (buildParameterRow, fed the live data);
  // viewState: OverlayViewStateStore.
  constructor({ catalog, resolver, viewState }) {
    this.#catalog = catalog;
    this.#resolver = resolver;
    this.#viewState = viewState;
  }

  isOpen(metricKey) {
    return this.#viewState.get(OPEN_KEY, []).includes(metricKey);
  }

  toggle(metricKey) {
    const open = this.#viewState.get(OPEN_KEY, []);
    this.#viewState.set(OPEN_KEY, Object.freeze(open.includes(metricKey)
      ? open.filter((key) => key !== metricKey)
      : [...open, metricKey]));
  }

  // The hint's HTML for an open metric; builder: OverlayHtmlBuilder (escaping and the DevTools link).
  render(metricKey, builder) {
    const entry = this.#catalog.getEntry(metricKey);
    if (!entry) {
      return "<div class=\"debug-overlay__hint\" role=\"note\">"
        + "<div class=\"debug-overlay__hint-text\">Для цієї метрики опису ще немає.</div></div>";
    }
    const lines = [];
    if (entry.description) lines.push(`<div class="debug-overlay__hint-text">${builder.escapeHtml(entry.description)}</div>`);
    if (entry.formula) lines.push(`<div class="debug-overlay__hint-formula">${builder.escapeHtml(entry.formula)}</div>`);
    const paths = Array.isArray(entry.paths) ? entry.paths : [];
    for (const path of paths) {
      const row = this.#resolver.buildParameterRow(path);
      const value = row.status === "ok" ? String(row.value) : "—";
      const name = REVEALABLE_ROOTS.some((root) => path.startsWith(root)) && !path.includes("<")
        ? builder.devLink(path, path)
        : builder.escapeHtml(path);
      lines.push(`<div class="debug-overlay__hint-param"><span class="debug-overlay__hint-path">${name}</span>`
        + `<span class="debug-overlay__hint-value">${builder.escapeHtml(value)}</span></div>`);
    }
    return `<div class="debug-overlay__hint" role="note">${lines.join("")}</div>`;
  }
}
