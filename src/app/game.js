class Game {
  #app;

  constructor(canvasId, compositionRoot = new GameCompositionRoot()) {
    this.#app = compositionRoot.build(canvasId);
  }

  start() {
    this.#app.start();
  }

  stop() {
    this.#app.stop();
  }

  dispose() {
    this.#app.dispose();
  }
}
