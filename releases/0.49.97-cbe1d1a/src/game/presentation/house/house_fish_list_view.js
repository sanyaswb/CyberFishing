// One fish list (live baits or keepnet). Rows keep their nodes across readings; only changed text is written.
export class HouseFishListView {
  #domFactory;
  #container;
  #live;
  #labels;
  #rows = new Map();
  #empty;

  constructor({ domFactory, container, live, labels }) {
    this.#domFactory = domFactory;
    this.#container = container;
    this.#live = live;
    this.#labels = labels;
    this.#empty = domFactory.element("p", "house__muted", live ? labels.emptyBait : labels.emptyKeepnet);
  }

  render(fish) {
    const live = this.#live, container = this.#container;
    const active = new Set();
    const rows = fish.map((entry) => {
      active.add(entry.id);
      let record = this.#rows.get(entry.id);
      if (!record) {
        record = { row: this.#domFactory.element("article", "house__fish"), name: this.#domFactory.element("strong", "house__fish-name"),
          meta: this.#domFactory.element("span", "house__muted house__fish-meta") };
        record.row.append(record.name, record.meta);
        if (live) {
          record.timer = this.#domFactory.element("span", "house__fish-timer");
          record.select = this.#button("select", "", entry.id);
          record.transfer = this.#button("transfer", this.#labels.transfer, entry.id);
          record.release = this.#button("releaseBait", this.#labels.release, entry.id);
          record.row.append(record.timer, record.select, record.transfer, record.release);
        } else record.row.append(this.#button("release", this.#labels.release, entry.id));
        this.#rows.set(entry.id, record);
      }
      record.name.textContent = entry.name;
      record.meta.textContent = `${entry.weightLabel} · ${live ? entry.locationLabel : this.#labels.keepnet}`;
      if (live) {
        record.timer.textContent = entry.timerLabel;
        record.select.dataset.houseAction = entry.selected ? "deselect" : "select";
        record.select.textContent = entry.actionLabel;
        record.transfer.hidden = !entry.canTransfer;
        record.release.hidden = entry.location === "hook";
      }
      return record.row;
    });
    for (const id of this.#rows.keys()) if (!active.has(id)) this.#rows.delete(id);
    const next = rows.length ? rows : [this.#empty];
    if (next.length !== container.children.length || next.some((row, index) => container.children[index] !== row))
      container.replaceChildren(...next);
  }

  dispose() {
    for (const record of this.#rows.values()) record.row.remove();
    this.#empty.remove();
    this.#rows.clear();
  }

  #button(action, label, id) {
    const button = this.#domFactory.element("button", "inventory-action house__fish-action", label);
    button.type = "button";
    button.dataset.houseAction = action;
    button.dataset.houseFishId = id;
    return button;
  }
}
