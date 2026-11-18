export class Game {
  #app;
  #ready;

  constructor(canvasId, compositionRoot) {
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

  // Spec 179 D12 (TK-371): the house over the game — the tackle must be put away to go in; inside the world goes on.
  requestHouseEntry() {
    return this.#app?.requestHouseEntry() === true;
  }

  enterHouse() {
    this.#app?.enterHouse();
  }

  leaveHouse() {
    this.#app?.leaveHouse();
  }

  dispose() {
    this.#app?.dispose();
  }

  get ready() {
    return this.#ready;
  }
}
