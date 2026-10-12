export class AquariumFeedPicker {
  #document;
  #button;
  #list;
  #dialog;
  #range;
  #quantity;
  #minus;
  #plus;
  #confirm;
  #title;
  #items = [];
  #signature = "";
  #selection = null;
  #onFeed;
  #labels;
  #lastFocus = null;
  constructor({ documentRef, button, list, onFeed, labels }) {
    this.#document = documentRef; this.#button = button; this.#list = list;
    this.#onFeed = onFeed; this.#labels = labels;
    this.#button.addEventListener("click", this.#toggle);
    this.#button.setAttribute("aria-expanded", "false");
    this.#dialog = this.#el("dialog", "house__feed-dialog");
    this.#dialog.setAttribute("aria-label", labels.quantityTitle);
    this.#title = this.#el("h3", "house__feed-dialog-title");
    this.#quantity = this.#el("output", "house__feed-quantity");
    this.#range = this.#el("input", "house__feed-range");
    this.#range.type = "range"; this.#range.min = "1"; this.#range.step = "1";
    this.#range.setAttribute("aria-label", labels.quantityTitle);
    this.#range.addEventListener("input", () => this.#setQuantity(Number(this.#range.value)));
    const controls = this.#el("div", "house__feed-quantity-controls");
    this.#minus = this.#square("−", labels.minus, () => this.#setQuantity(this.#selection.quantity - 1));
    this.#plus = this.#square("+", labels.plus, () => this.#setQuantity(this.#selection.quantity + 1));
    controls.append(this.#minus, this.#range, this.#plus);
    const actions = this.#el("div", "house__action-row");
    this.#confirm = this.#el("button", "house__button house__button--primary", labels.add);
    this.#confirm.type = "button"; this.#confirm.addEventListener("click", this.#apply);
    const cancel = this.#el("button", "house__button", labels.cancel);
    cancel.type = "button"; cancel.addEventListener("click", () => this.#close());
    actions.append(cancel, this.#confirm);
    this.#dialog.append(this.#title, this.#quantity, controls, actions);
    this.#dialog.addEventListener("cancel", (event) => { event.preventDefault(); this.#close(); });
    documentRef.body.append(this.#dialog);
  }
  update(model) {
    this.#items = model.feedItems.filter((item) => item.count > 0);
    this.#button.disabled = !model.aquarium.owned || model.aquarium.count === 0;
    const signature = JSON.stringify(this.#items.map((item) => [item.id, item.count]));
    if (signature !== this.#signature) {
      const rows = this.#items.map((item) => {
        const row = this.#el("article", "house__feed-item");
        const thumbnail = this.#el("div", "house__feed-thumbnail inventory-item-card");
        const image = this.#el("img", "house__feed-item-image"); image.src = item.imagePath; image.alt = item.name;
        const icon = this.#el("span", "house__feed-emoji", "🐟"); icon.setAttribute("aria-hidden", "true");
        thumbnail.append(image, icon, this.#el("span", "inventory-item-card__quantity", String(item.count)));
        const add = this.#square("+", this.#labels.addItem(item.name), () => this.#choose(item.id, add));
        row.append(thumbnail, this.#el("span", "house__feed-item-name", item.name), add);
        return row;
      });
      this.#list.replaceChildren(...(rows.length ? rows : [this.#el("p", "house__muted", this.#labels.empty)]));
      this.#signature = signature;
    }
    if (this.#selection) {
      const current = this.#items.find((item) => item.id === this.#selection.id);
      if (!current) this.#close();
      else { this.#selection.max = current.count; this.#setQuantity(this.#selection.quantity); }
    }
  }
  dispose() { this.#button.removeEventListener("click", this.#toggle); this.#dialog.remove(); }
  #toggle = () => {
    this.#list.hidden = !this.#list.hidden;
    this.#button.setAttribute("aria-expanded", String(!this.#list.hidden));
  };
  #choose(id, source) {
    const item = this.#items.find((entry) => entry.id === id);
    if (!item) return;
    if (item.count === 1) { this.#onFeed(id, 1); return; }
    this.#lastFocus = source;
    this.#selection = { id, max: item.count, quantity: 1 };
    this.#title.textContent = item.name;
    this.#setQuantity(1); this.#dialog.showModal(); this.#range.focus();
  }
  #setQuantity(quantity) {
    if (!this.#selection) return;
    const value = Math.max(1, Math.min(this.#selection.max, Math.round(quantity)));
    this.#selection.quantity = value;
    this.#range.max = String(this.#selection.max); this.#range.value = String(value);
    this.#quantity.textContent = this.#labels.quantity(value, this.#selection.max);
    this.#minus.disabled = value === 1; this.#plus.disabled = value === this.#selection.max;
  }
  #apply = () => {
    if (!this.#selection) return;
    const { id, quantity } = this.#selection;
    const result = this.#onFeed(id, quantity);
    if (result?.ok) this.#close();
  };
  #close() {
    if (this.#dialog.open) this.#dialog.close();
    this.#selection = null;
    (this.#lastFocus?.isConnected ? this.#lastFocus : this.#button).focus();
    this.#lastFocus = null;
  }
  #square(text, label, action) {
    const button = this.#el("button", "house__feed-square", text);
    button.type = "button"; button.setAttribute("aria-label", label); button.addEventListener("click", action); return button;
  }
  #el(tag, className, text) {
    const node = this.#document.createElement(tag); node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
}
