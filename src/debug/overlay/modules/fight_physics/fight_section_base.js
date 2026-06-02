class FightSectionBase {
  constructor(key, title, { settingsStore = window.OverlaySettingsStore } = {}) {
    this.key = key;
    this.title = title;
    this.settingsStore = settingsStore;
    this.formatter = new OverlayValueFormatter();
    this.htmlBuilder = new OverlayHtmlBuilder();
  }

  isEnabled() {
    return this.settingsStore.isEnabled("fightPhysics") || this.settingsStore.isEnabled(this.key);
  }

  render(data) {
    if (!this.isEnabled()) return "";
    const body = this.rows(data).filter(Boolean).join("");
    return `<div style="margin-bottom:10px; background:rgba(0,0,0,0.22); border-left:3px solid #73c2fb; padding:6px; border-radius:4px;">
      <div style="color:#73c2fb; font-weight:bold; margin-bottom:5px; font-size:12px; text-transform:uppercase;">${this.title}</div>
      ${body}
    </div>`;
  }

  rows() {
    return [];
  }

  row(label, value, color = "#8a9bac") {
    return this.htmlBuilder.metricRow(label, value, { color });
  }
}

window.FightSectionBase = FightSectionBase;
