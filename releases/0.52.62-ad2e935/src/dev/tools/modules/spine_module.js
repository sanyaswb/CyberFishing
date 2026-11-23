import { SpineDevSection } from "../spine_dev_section.js";

// «SPINE» as a panel module (spec 174 B3, moved from DevTools): the rod (spec 099) and the bait boat (spec 150) over
// their controllers' DEV ports, each with its live config. TK-389: one section class, two subjects; the skeleton's file
// goes through the DEV file port (files) or, without one, is not offered.
export class SpineModule {
  #config;
  #rodSpine;
  #boatSpine;
  #files;

  constructor({ config, rodSpine = null, boatSpine = null, files = null }) {
    this.#config = config;
    this.#rodSpine = rodSpine;
    this.#boatSpine = boatSpine;
    this.#files = files;
  }

  mount(host, { ui, createSection, tree }) {
    if (!this.#rodSpine && !this.#boatSpine) return;
    const spine = createSection("SPINE", host, ["SPINE"], { icon: "spine" });
    const section = (label, parent, path) => createSection(label, parent, path);
    const files = this.#files;
    if (this.#rodSpine) {
      new SpineDevSection({ ui, subject: SpineDevSection.ROD, controller: this.#rodSpine, createSection: section, files,
        renderConfigTree: (parent) => tree.render(this.#config.ui.rod.spine, parent, ["CONFIG", "ui", "rod", "spine"]),
      }).render(spine);
    }
    if (this.#boatSpine) {
      new SpineDevSection({ ui, subject: SpineDevSection.BOAT, controller: this.#boatSpine, createSection: section, files,
        renderConfigTree: (parent) => tree.render(this.#config.ui.boat, parent, ["CONFIG", "ui", "boat"]),
      }).render(spine);
    }
  }
}
