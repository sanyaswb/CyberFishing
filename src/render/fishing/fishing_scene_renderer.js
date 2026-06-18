class FishingSceneRenderer {
  #composite;

  constructor({ components }) {
    this.#composite = new CompositeRenderer({ components });
  }

  render(model) {
    if (!model.visible) return;
    this.#composite.render(model);
  }
}
