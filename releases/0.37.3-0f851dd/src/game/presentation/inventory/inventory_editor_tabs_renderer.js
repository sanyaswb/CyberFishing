// Phone item editor tabs (spec 091): one row of tabs — the editor's root item, its cells, items with parameters only —
// joined to one parameter panel that shows the active tab's page. A tap keeps each cell's own action (equip, remove,
// open, pick); a tap on the root or a view-only tab, a swipe on the panel and Left/Right/Home/End on the row only switch
// the page. The active tab key is presentation state kept here across editor re-renders: another root item, a removed
// address or resetView() returns to the root tab. CSS decides where this block is shown (portrait phones).
export class InventoryEditorTabsRenderer {
  #dom;
  #resolver;
  #items;
  #parameters;
  #swipe;
  #rowScroll;
  #labels;
  #rootKey = null;
  #activeKey = null;
  #current = null;

  constructor({ domFactory, resolver, itemRenderer, parametersRenderer, swipeController, rowScrollController, labels }) {
    this.#dom = domFactory;
    this.#resolver = resolver;
    this.#items = itemRenderer;
    this.#parameters = parametersRenderer;
    this.#swipe = swipeController;
    this.#rowScroll = rowScrollController;
    this.#labels = labels;
  }

  // A newly opened editor starts on its root item, even one viewed before.
  resetView() {
    this.#rootKey = null;
  }

  render(model, { onSocketActivate = null, onWarning = null } = {}) {
    const tabs = this.#resolver.resolve(model);
    if (!tabs.length) return null;
    if (tabs[0].key !== this.#rootKey) {
      this.#rootKey = tabs[0].key;
      this.#activeKey = this.#rootKey;
    }
    if (!tabs.some((tab) => tab.key === this.#activeKey)) this.#activeKey = this.#rootKey;
    const block = this.#dom.element("section", "inventory-editor-tabs");
    const row = this.#dom.element("div", "inventory-editor-tabs__row");
    row.classList.toggle("inventory-editor-tabs__row--single", tabs.length === 1);
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", this.#labels.row);
    const panel = this.#dom.element("div", "inventory-editor-tabs__panel");
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", this.#labels.panel);
    const tabNodes = tabs.map((tab) => this.#renderTab(tab, { onSocketActivate, onWarning }));
    const pages = tabs.map((tab) => this.#renderPage(tab));
    row.append(...tabNodes);
    panel.append(...pages);
    row.addEventListener("keydown", (event) => this.#key(event));
    block.append(row, panel);
    if (this.#current) {
      this.#swipe.detach(this.#current.panel);
      this.#rowScroll.detach(this.#current.row);
    }
    this.#swipe.attach(panel, { pageCount: tabs.length, getIndex: () => this.#activeIndex(),
      onSelect: (index) => this.#select(this.#current.tabs[index].key) });
    this.#rowScroll.attach(row);
    this.#current = { tabs, tabNodes, pages, row, panel };
    this.#apply();
    return block;
  }

  #renderTab(tab, { onSocketActivate, onWarning }) {
    const node = this.#dom.element("div", `inventory-editor-tabs__tab inventory-editor-tabs__tab--${tab.kind}`);
    node.dataset.tabKey = tab.key;
    if (tab.kind === "socket") {
      node.appendChild(this.#items.renderSlot(tab.socket, { variant: "socket", showAttachments: false, showTooltip: false,
        onActivate: () => onSocketActivate?.(tab.socket), onUnavailable: (warning) => onWarning?.(warning) }));
      return node;
    }
    const card = this.#items.renderItem(tab.item, { variant: "socket", showAttachments: false, showMetadata: false,
      showResourceMeter: false, showTooltip: false, onActivate: () => this.#select(tab.key) });
    const name = tab.label || tab.item?.name || "Предмет";
    card.setAttribute("aria-label", tab.kind === "root" ? this.#labels.root(name) : this.#labels.view(name));
    card.title = card.getAttribute("aria-label");
    node.appendChild(card);
    return node;
  }

  #renderPage(tab) {
    const page = this.#dom.element("div", "inventory-editor-tabs__page");
    page.dataset.tabKey = tab.key;
    const parameters = tab.item ? this.#parameters.render(tab.item) : null;
    if (parameters) page.appendChild(parameters);
    else {
      const name = tab.label || tab.item?.name || "Предмет";
      page.appendChild(this.#dom.element("p", "inventory-editor-tabs__empty",
        tab.item ? this.#labels.noParameters(name) : this.#labels.emptyCell(name)));
      if (!tab.item && tab.socket?.warning) {
        page.appendChild(this.#dom.element("p", "inventory-editor-tabs__empty", tab.socket.warning));
      }
    }
    return page;
  }

  #activeIndex() {
    return this.#current.tabs.findIndex((tab) => tab.key === this.#activeKey);
  }

  #select(key) {
    if (key === this.#activeKey) return;
    this.#activeKey = key;
    this.#apply();
    this.#current.tabNodes[this.#activeIndex()].scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  // Left/Right/Home/End only switch the page, like a swipe; Enter/Space stay with the focused tab's own button.
  #key(event) {
    const last = this.#current.tabs.length - 1;
    const index = this.#activeIndex();
    const next = event.key === "ArrowRight" ? Math.min(last, index + 1)
      : event.key === "ArrowLeft" ? Math.max(0, index - 1)
        : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (next < 0) return;
    event.preventDefault();
    this.#select(this.#current.tabs[next].key);
  }

  #apply() {
    const index = this.#activeIndex();
    this.#current.tabNodes.forEach((node, position) => {
      node.classList.toggle("inventory-editor-tabs__tab--active", position === index);
      if (position === index) node.setAttribute("aria-current", "true");
      else node.removeAttribute("aria-current");
    });
    this.#current.pages.forEach((page, position) => { page.hidden = position !== index; });
    this.#current.panel.classList.toggle("inventory-editor-tabs__panel--first-active", index === 0);
  }
}
