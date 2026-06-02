class BaseDebugModule {
  get key() {
    throw new Error("Debug module key is required.");
  }

  get title() {
    throw new Error("Debug module title is required.");
  }

  render() {
    throw new Error("Debug module render(context) is required.");
  }
}

class ConsoleTableDebugModule extends BaseDebugModule {
  #key;
  #title;

  constructor({ key, title }) {
    super();
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

window.BaseDebugModule = BaseDebugModule;
window.ConsoleTableDebugModule = ConsoleTableDebugModule;
