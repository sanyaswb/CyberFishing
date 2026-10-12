export class FightSectionBase {
  constructor(
    key,
    title,
    {
      categoryKey = null,
      settingsStore,
      formatter,
      htmlBuilder,
    } = {},
  ) {
    this.key = key;
    this.title = title;
    this.categoryKey = categoryKey;
    this.settingsStore = settingsStore;
    this.formatter = formatter;
    this.htmlBuilder = htmlBuilder;
  }

  isEnabled() {
    return this.#matchesKey(this.key) || this.#matchesKey(this.categoryKey);
  }

  render(data, { force = false } = {}) {
    if (!force && !this.isEnabled()) return "";
    const body = this.rows(data).filter(Boolean).join("");
    return `<div class="debug-overlay__physics-card">
      <div class="debug-overlay__text debug-overlay__text--info debug-overlay__section-title">${this.title}</div>
      ${body}
    </div>`;
  }

  rows() {
    return [];
  }

  row(label, value, color = "#8a9bac") {
    return this.htmlBuilder.metricRow(label, value, { color });
  }

  #matchesKey(key) {
    return !!key && !!this.settingsStore?.isEnabled?.(key);
  }
}
