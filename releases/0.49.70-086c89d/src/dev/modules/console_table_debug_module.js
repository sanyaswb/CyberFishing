import { BaseDebugModule } from "./base_debug_module.js";

export class ConsoleTableDebugModule extends BaseDebugModule {
  #key;
  #title;

  constructor({ key, title, configSource }) {
    super();
    this.configSource = configSource;
    this.#key = key;
    this.#title = title;
  }

  get key() {
    return this.#key;
  }

  get title() {
    return this.#title;
  }
}
