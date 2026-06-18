class Game {
  #app;
  #ready;

  constructor(canvasId, compositionRoot = new GameCompositionRoot()) {
    this.#ready = Promise.resolve(compositionRoot.build(canvasId)).then(
      (app) => {
        this.#app = app;
        return app;
      },
    );
  }

  async start() {
    const app = await this.#ready;
    return app.start();
  }

  stop() {
    this.#app?.stop();
  }

  dispose() {
    this.#app?.dispose();
  }

  get ready() {
    return this.#ready;
  }
}
