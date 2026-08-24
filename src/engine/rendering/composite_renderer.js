const componentsByRenderer = new WeakMap();

export class CompositeRenderer {
  constructor({ components }) {
    if (!Array.isArray(components)) {
      throw new TypeError("CompositeRenderer requires components");
    }
    const ids = new Set();
    const sorted = components.slice();
    sorted.sort((left, right) => left.order - right.order);
    for (let index = 0; index < sorted.length; index += 1) {
      const component = sorted[index];
      if (!component || typeof component.selectModel !== "function") {
        throw new TypeError(`CompositeRenderer component ${index} is invalid`);
      }
      if (ids.has(component.id)) {
        throw new Error(`Duplicate render component id: ${component.id}`);
      }
      ids.add(component.id);
    }
    componentsByRenderer.set(this, Object.freeze(sorted));
  }

  render(model) {
    const components = componentsByRenderer.get(this);
    for (let index = 0; index < components.length; index += 1) {
      const component = components[index];
      const componentModel = component.selectModel(model);
      if (!component.isVisible(componentModel, model)) continue;
      component.renderer.render(componentModel);
    }
  }

  getComponentCount() {
    return componentsByRenderer.get(this).length;
  }

  getComponentIdAt(index) {
    const component = componentsByRenderer.get(this)[index];
    return component ? component.id : null;
  }
}
