class MapDebugModule extends ConsoleTableDebugModule {
  #printer;

  constructor({ printer = new LocationDebugPrinter() } = {}) {
    super({ key: "map", title: "Map And Zones" });
    this.#printer = printer;
  }

  render() {
    this.#printer.print();
  }
}

window.MapDebugModule = MapDebugModule;
