export class AquariumFeedPicker {
  #document; #button; #list; #preview; #hint; #labels; #onFeed; #original; #assets;
  #previewRecord;
  #items = []; #rows = new Map(); #empty; #selectionId = null; #model; #disposed = false;
  // assets: the AssetRegistry; a feed's box art is its imageAsset (spec 157 R16).
  constructor({ documentRef, button, list, preview, hint, onFeed, labels, assets }) {
    if (typeof assets?.pathOf !== "function") throw new TypeError("AquariumFeedPicker requires assets");
    this.#assets = assets;
    this.#document = documentRef; this.#button = button; this.#list = list; this.#preview = preview; this.#hint = hint;
    this.#onFeed = onFeed; this.#labels = labels;
    this.#original = { children: [...list.childNodes], hidden: list.hidden, expanded: button.getAttribute("aria-expanded"),
      disabled: button.disabled, text: button.textContent, title: button.getAttribute("title"),
      preview: [...preview.childNodes], hint: hint.hidden };
    this.#empty = this.#el("p", "house__muted", labels.empty);
    this.#previewRecord = this.#createRow(this.#toggleList);
    preview.replaceChildren(this.#previewRecord.row);
    const listId = list.getAttribute("id");
    if (listId) this.#previewRecord.row.setAttribute("aria-controls", listId);
    this.#button.addEventListener("click", this.#activate);
    this.#button.addEventListener("keydown", this.#handleKey);
    this.#list.addEventListener("keydown", this.#handleKey);
    this.#button.setAttribute("aria-expanded", "false");
  }
  update(model) {
    this.#model = model;
    this.#items = model.feedItems.filter((item) => item.count > 0);
    // Draft selection belongs to this UI. Inventory and the load gate remain service-owned.
    if (!this.#canChoose() || !this.#items.some(item => item.id === this.#selectionId)) this.#selectionId = null;
    if (!this.#canChoose()) this.close();
    const active = new Set();
    const rows = this.#items.map((item) => {
      active.add(item.id);
      let record = this.#rows.get(item.id);
      if (!record) {
        record = this.#createRow(() => this.#choose(item.id)); this.#rows.set(item.id, record);
      }
      this.#updateRow(record, item);
      record.row.disabled = !this.#canChoose();
      return record.row;
    });
    for (const id of this.#rows.keys()) if (!active.has(id)) this.#rows.delete(id);
    const next = rows.length ? rows : [this.#empty];
    if (next.length !== this.#list.children.length || next.some((row, index) => this.#list.children[index] !== row))
      this.#list.replaceChildren(...next);
    this.#renderSelection();
  }
  get isOpen() { return !this.#list.hidden; }
  close() {
    this.#selectionId = null; this.#setExpanded(false);
    if (this.#model) this.#renderSelection();
  }
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#button.removeEventListener("click", this.#activate); this.#button.removeEventListener("keydown", this.#handleKey);
    this.#list.removeEventListener("keydown", this.#handleKey);
    this.#previewRecord.row.removeEventListener("click", this.#toggleList);
    this.#list.replaceChildren(...this.#original.children); this.#list.hidden = this.#original.hidden;
    this.#preview.replaceChildren(...this.#original.preview); this.#hint.hidden = this.#original.hint;
    this.#button.disabled = this.#original.disabled; this.#button.textContent = this.#original.text;
    for (const [key, value] of [["aria-expanded", this.#original.expanded], ["title", this.#original.title]]) {
      if (value === null) this.#button.removeAttribute(key); else this.#button.setAttribute(key, value);
    }
    this.#rows.clear();
  }
  #canChoose() {
    return !this.#disposed && !this.#model?.error && this.#model?.aquarium.owned &&
      this.#model.aquarium.count > 0 && this.#model.aquarium.canLoadFeed !== false;
  }
  #activate = () => {
    if (!this.#canChoose()) return;
    if (!this.#selectionId) {
      this.#toggleList(); return;
    }
    const result = this.#onFeed(this.#selectionId, 1);
    if (result?.ok) {
      this.close();
      (this.#button.disabled ? this.#hint.hidden ? this.#preview : this.#hint : this.#button).focus();
    }
  };
  #choose(id) {
    if (!this.#canChoose() || !this.#items.some(item => item.id === id)) return;
    this.#selectionId = id; this.#setExpanded(false); this.#renderSelection(); this.#button.focus();
  }
  #toggleList = () => {
    if (this.#canChoose()) this.#setExpanded(!this.isOpen);
  };
  #setExpanded(expanded) {
    this.#list.hidden = !expanded;
    this.#button.setAttribute("aria-expanded", String(expanded));
    this.#previewRecord.row.setAttribute("aria-expanded", String(expanded));
  }
  #renderSelection() {
    for (const [id, record] of this.#rows) {
      const selected = id === this.#selectionId;
      record.row.setAttribute("aria-pressed", String(selected)); record.row.classList.toggle("inventory-action--primary", selected);
    }
    const feed = this.#model.aquarium.feed;
    const draft = this.#items.find(item => item.id === this.#selectionId);
    const item = draft || feed ||
      this.#items.find(item => item.id === this.#model.selectedFeedId) || this.#items[0];
    this.#updateRow(this.#previewRecord, item, !draft && feed ? this.#model.feedCountdownLabel || "" : "",
      !draft && feed ? feed.quantity : item?.count, !draft && feed ? this.#model.feedTimeLabel || "" : "");
    this.#previewRecord.row.disabled = !this.#canChoose();
    this.#button.disabled = !this.#canChoose();
    this.#text(this.#button, this.#selectionId || (this.#button.disabled && this.#items.length > 0) ? this.#labels.load : this.#labels.feed);
    const locked = this.#model.aquarium.canLoadFeed === false && feed?.remainingMs > 0;
    this.#hint.hidden = !locked; this.#text(this.#hint, this.#labels.locked);
    if (locked) this.#button.setAttribute("title", this.#labels.locked); else this.#button.removeAttribute("title");
  }
  #handleKey = (event) => {
    if (event.key !== "Escape" || !this.isOpen) return;
    event.preventDefault(); event.stopPropagation(); this.close(); this.#button.focus();
  };
  #createRow(onChoose) {
    const row = this.#el("button", "inventory-action house__feed-item"); row.type = "button";
    row.addEventListener("click", onChoose);
    const thumbnail = this.#el("span", "house__feed-thumbnail inventory-item-card");
    const image = this.#el("img", "house__feed-item-image"); image.alt = "";
    const quantity = this.#el("span", "inventory-item-card__quantity"); thumbnail.append(image, quantity);
    const details = this.#el("span", "house__feed-item-details");
    const name = this.#el("span", "house__feed-item-name");
    const meta = this.#el("span", "house__feed-item-meta"); details.append(name, meta);
    row.append(thumbnail, details);
    return { row, image, quantity, details, name, meta, imageAsset: null };
  }
  #updateRow(record, item, description = "", quantity = item?.count, accessibleDescription = description) {
    record.image.hidden = !item;
    record.quantity.hidden = !Number.isFinite(quantity);
    if (item && record.imageAsset !== item.imageAsset) {
      record.image.src = this.#assets.pathOf(item.imageAsset); record.imageAsset = item.imageAsset;
    }
    this.#text(record.name, item?.name || this.#labels.noSelection);
    this.#text(record.quantity, Number.isFinite(quantity) ? quantity : "");
    this.#text(record.meta, description); record.meta.hidden = !description;
    record.row.setAttribute("aria-label", item ? [this.#labels.item(item.name, quantity || 0), accessibleDescription].filter(Boolean).join(" · ") : this.#labels.noSelection);
  }
  #text(node, value) { if (node.textContent !== String(value)) node.textContent = String(value); }
  #el(tag, className, text) {
    const node = this.#document.createElement(tag); node.className = className;
    if (text !== undefined) node.textContent = text; return node;
  }
}
