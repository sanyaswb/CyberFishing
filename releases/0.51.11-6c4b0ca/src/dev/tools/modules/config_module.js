// «НАЛАШТУВАННЯ (CONFIG)» (spec 174 B3, moved from DevTools): every CONFIG group except debug (its own module) as a
// section of editable parameters.
export class ConfigModule {
  #config;

  constructor({ config }) {
    this.#config = config;
  }

  mount(host, { createSection, tree }) {
    const content = createSection("НАЛАШТУВАННЯ (CONFIG)", host, ["CONFIG"], { icon: "sliders" });
    for (const key of Object.keys(this.#config)) {
      if (tree.skips(["CONFIG"], key)) continue;
      // TK-308: each group's rows are drawn when it is first opened.
      tree.section(key, content, ["CONFIG", key], this.#config[key]);
    }
  }
}
