import { RadioDevSection } from "../radio_dev_section.js";

// «📻 РАДІО» as a panel module (spec 174 B3, moved from DevTools) over the radio's DEV port.
export class RadioModule {
  #config;
  #radio;
  #files;
  #gameVersion;

  constructor({ config, radio, files = null, gameVersion = "" }) {
    this.#config = config;
    this.#radio = radio;
    this.#files = files;
    this.#gameVersion = gameVersion;
  }

  mount(host, { ui, createSection, tree, edits }) {
    new RadioDevSection({
      ui,
      radio: this.#radio,
      createSection: (label, parent, path) => createSection(label, parent, path),
      config: () => this.#config.radio,
      renderConfigTree: (value, parent, path, options) => tree.render(value, parent, path, options),
      setConfig: (path, value) => edits.update(path, value),
      files: this.#files,
      gameVersion: this.#gameVersion,
    }).render(host);
  }
}
