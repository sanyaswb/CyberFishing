export class FightRodControlSection {
  #sections;

  constructor({
    settingsStore,
    formatter,
    htmlBuilder,
    sections = null,
  } = {}) {
    this.#sections = sections;
  }

  render(data, { force = false } = {}) {
    return this.#sections
      .map((section) => section.render(data, { force }))
      .join("");
  }
}
