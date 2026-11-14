import { ConsoleTableDebugModule } from "./console_table_debug_module.js";

export class MapDebugModule extends ConsoleTableDebugModule {
  #printer;

  constructor({ printer } = {}) {
    super({ key: "map", title: "Map And Zones" });
    this.#printer = printer;
  }

  render() {
    this.#printer.print();
  }
}
