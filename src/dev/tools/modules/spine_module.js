import { SpineRodDevSection } from "../spine_rod_dev_section.js";
import { SpineBoatDevSection } from "../spine_boat_dev_section.js";

// «SPINE» as a panel module (spec 174 B3, moved from DevTools): the rod (spec 099) and the bait boat (spec 150) over
// their controllers' DEV ports, each with its live config.
export class SpineModule {
  #config;
  #rodSpine;
  #boatSpine;

  constructor({ config, rodSpine = null, boatSpine = null }) {
    this.#config = config;
    this.#rodSpine = rodSpine;
    this.#boatSpine = boatSpine;
  }

  mount(host, { ui, createSection, tree }) {
    if (!this.#rodSpine && !this.#boatSpine) return;
    const spine = createSection("SPINE", host, ["SPINE"]);
    const section = (label, parent, path) => createSection(label, parent, path);
    if (this.#rodSpine) {
      new SpineRodDevSection({ ui, controller: this.#rodSpine, createSection: section,
        renderConfigTree: (parent) => tree.render(this.#config.ui.rod.spine, parent, ["CONFIG", "ui", "rod", "spine"]),
      }).render(spine);
    }
    if (this.#boatSpine) {
      new SpineBoatDevSection({ ui, controller: this.#boatSpine, createSection: section,
        renderConfigTree: (parent) => tree.render(this.#config.ui.boat, parent, ["CONFIG", "ui", "boat"]),
      }).render(spine);
    }
  }
}
