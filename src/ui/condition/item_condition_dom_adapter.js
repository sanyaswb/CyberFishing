class ItemConditionDomAdapter {
  static #property = "--item-condition-percent";

  apply(element, condition) {
    this.clear(element);
    if (!element?.style || !element.classList || !condition?.available) {
      return null;
    }
    const percent = Math.max(0, Math.min(100, Number(condition.percent) || 0));
    element.classList.add("has-item-condition");
    element.style.setProperty(ItemConditionDomAdapter.#property, `${percent}%`);
    if (element.dataset) element.dataset.conditionPercent = String(percent);
    return condition;
  }

  clear(element) {
    if (!element) return;
    element.classList?.remove("has-item-condition");
    element.style?.removeProperty(ItemConditionDomAdapter.#property);
    if (element.dataset) delete element.dataset.conditionPercent;
  }
}
