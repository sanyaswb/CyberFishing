// «НАЛАШТУВАННЯ (CONFIG)» (spec 174 B3, moved from DevTools; spec 180 D6, stage E): every CONFIG group in the code's
// order with the code's keys — debug too (it also has its own module), the keys data is identified by read-only; only the
// catalogs merged into CONFIG (locations.map, spawns.fishes) stay in «Бази».
const RAW = Object.freeze({ raw: true });

export class ConfigModule {
  #config;

  constructor({ config }) {
    this.#config = config;
  }

  mount(host, { createSection, tree }) {
    const content = createSection("НАЛАШТУВАННЯ (CONFIG)", host, ["CONFIG"], { icon: "sliders" });
    for (const key of Object.keys(this.#config)) {
      if (tree.skips(["CONFIG"], key, RAW)) continue;
      // TK-308: each group's rows are drawn when it is first opened.
      tree.section(key, content, ["CONFIG", key], this.#config[key], RAW);
    }
  }
}
