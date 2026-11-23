export class BaseDebugModule {
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
