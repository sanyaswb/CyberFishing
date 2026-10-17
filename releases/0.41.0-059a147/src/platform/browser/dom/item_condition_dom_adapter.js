// Condition styling for an item element. The inventory's 250 ms refresh calls apply with an unchanged reading, so it
// writes only what differs: clearing and re-adding the class, the property and the data attribute on every refresh
// made the cards flash in DevTools and restyle under the pointer.
export class ItemConditionDomAdapter {
  static #property = "--item-condition-percent";

  apply(element, condition) {
    if (!element?.style || !element.classList || !condition?.available) {
      this.clear(element);
      return null;
    }
    const percent = Math.max(0, Math.min(100, Number(condition.percent) || 0));
    const value = `${percent}%`;
    if (!element.classList.contains("item-condition")) element.classList.add("item-condition");
    if (element.style.getPropertyValue(ItemConditionDomAdapter.#property) !== value) {
      element.style.setProperty(ItemConditionDomAdapter.#property, value);
    }
    if (element.dataset && element.dataset.conditionPercent !== String(percent)) {
      element.dataset.conditionPercent = String(percent);
    }
    return condition;
  }

  clear(element) {
    if (!element) return;
    if (element.classList?.contains("item-condition")) element.classList.remove("item-condition");
    if (element.style?.getPropertyValue?.(ItemConditionDomAdapter.#property)) {
      element.style.removeProperty(ItemConditionDomAdapter.#property);
    }
    if (element.dataset && "conditionPercent" in element.dataset) delete element.dataset.conditionPercent;
  }
}
