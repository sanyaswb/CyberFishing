export class OverlayModule {
  constructor(
    key,
    {
      configSource,
      settingsStore,
      htmlBuilder,
    } = {},
  ) {
    this.configSource = configSource;
    this.key = key;
    this.settingsStore = settingsStore;
    this.htmlBuilder = htmlBuilder;
  }

  isActive(data) {
    return !!this.settingsStore?.isEnabled?.(this.key) && this.shouldRender(data);
  }

  shouldRender() {
    return true;
  }

  render() {
    return "";
  }

  formatHeader(title, color = "#00ccff") {
    return this.htmlBuilder.formatHeader(title, color);
  }

  metricRow(label, value, options = {}) {
    return this.htmlBuilder.metricRow(label, value, options);
  }

  escapeAttr(value) {
    return this.htmlBuilder.escapeAttr(value);
  }

  getStateColor(state) {
    return this.htmlBuilder.getStateColor(state);
  }
}
