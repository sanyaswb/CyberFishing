class RenderComponent {
  id;
  order;
  renderer;
  selectModel;
  isVisible;

  constructor({ id, order = 0, renderer, selectModel, isVisible = null }) {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) {
      throw new TypeError("RenderComponent requires id");
    }
    if (!renderer || typeof renderer.render !== "function") {
      throw new TypeError(`RenderComponent "${normalizedId}" requires renderer.render(model)`);
    }
    if (typeof selectModel !== "function") {
      throw new TypeError(`RenderComponent "${normalizedId}" requires selectModel(model)`);
    }
    if (isVisible !== null && typeof isVisible !== "function") {
      throw new TypeError(`RenderComponent "${normalizedId}" requires isVisible(model)`);
    }
    this.id = normalizedId;
    this.order = Number(order) || 0;
    this.renderer = renderer;
    this.selectModel = selectModel;
    this.isVisible = isVisible || RenderComponent.defaultIsVisible;
    Object.freeze(this);
  }

  static defaultIsVisible(model) {
    return !!model && model.visible !== false;
  }
}
