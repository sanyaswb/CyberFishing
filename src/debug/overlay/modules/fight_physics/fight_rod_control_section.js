class FightRodControlSection {
  #sections;

  constructor({
    settingsStore = typeof window !== "undefined"
      ? window.OverlaySettingsStore
      : null,
    formatter = new OverlayValueFormatter(),
    htmlBuilder = new OverlayHtmlBuilder(),
    sections = null,
  } = {}) {
    const sectionOptions = { settingsStore, formatter, htmlBuilder };
    this.#sections =
      sections ||
      [
        new FightRodControlInputSection(sectionOptions),
        new FightRodControlForceSection(sectionOptions),
        new FightRodControlGeometrySection(sectionOptions),
        new FightRodControlVisualSection(sectionOptions),
      ];
  }

  render(data, { force = false } = {}) {
    return this.#sections
      .map((section) => section.render(data, { force }))
      .join("");
  }
}

window.FightRodControlSection = FightRodControlSection;
