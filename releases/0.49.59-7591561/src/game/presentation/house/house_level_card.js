// One level card: the segment meter and, when present, the next-level row. DOM is rebuilt only when the level state changes.
export class HouseLevelCard {
  #domFactory;
  #segments;
  #list;
  #labels;
  #key = null;

  constructor({ domFactory, segments, list = null, labels }) {
    this.#domFactory = domFactory;
    this.#segments = segments;
    this.#list = list;
    this.#labels = labels;
  }

  render(level, maxLevel, targetLevel, progress, describe = null) {
    const segments = this.#segments, list = this.#list;
    const key = `${level}:${maxLevel}:${targetLevel}`;
    if (this.#key !== key) {
      const bars = [];
      for (let index = 1; index <= maxLevel; index++) {
        const bar = this.#domFactory.element("span", "inventory-parameter__segment house__level-segment");
        if (index <= level) bar.classList.add("inventory-parameter__segment--filled");
        if (index === targetLevel) bar.classList.add("house__level-segment--pending");
        bars.push(bar);
      }
      segments.replaceChildren(...bars);
      const nextLevel = level < maxLevel ? level + 1 : null;
      if (list) list.hidden = nextLevel === null;
      if (list && nextLevel === null) list.replaceChildren();
      else if (list) {
        const benefit = describe(nextLevel);
        const row = this.#domFactory.element("li", "house__level-step");
        if (nextLevel === targetLevel) row.classList.add("house__level-step--pending");
        row.append(this.#domFactory.element("span", "house__level-name", this.#labels.level(nextLevel)),
          this.#domFactory.element("strong", "house__level-bonus", benefit.bonus),
          this.#domFactory.element("small", "house__level-detail", benefit.detail));
        list.replaceChildren(row);
      }
      this.#key = key;
    }
    segments.setAttribute("role", "progressbar");
    segments.setAttribute("aria-valuemin", "0");
    segments.setAttribute("aria-valuemax", String(maxLevel));
    segments.setAttribute("aria-valuenow", String(level + progress));
    if (targetLevel !== null) segments.children[targetLevel - 1]?.style.setProperty("--house-progress", `${Math.round(progress * 100)}%`);
  }
}
