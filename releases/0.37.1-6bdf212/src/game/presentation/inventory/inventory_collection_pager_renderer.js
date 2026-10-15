// Two-page pager of the portrait backpack (spec 075): tabs in the main tab style above a viewport whose track holds
// the pages. The page index is presentation state kept here across list re-renders; CSS decides where the pager is
// active (portrait) and otherwise shows only the first page.
export class InventoryCollectionPagerRenderer {
  #dom;
  #tabs;
  #swipe;
  #config;
  #index = 0;
  #current = null;

  constructor({ domFactory, tabsRenderer, swipeController, config }) {
    this.#dom = domFactory;
    this.#tabs = tabsRenderer;
    this.#swipe = swipeController;
    this.#config = config;
  }

  // pages: the nodes of each page; they become the page's direct children, so the page (a flex column) bounds them.
  // onEdge receives a swipe past the first (-1) or the last (+1) page (spec 087).
  create(pages, { viewportClassName = "", onEdge = null } = {}) {
    const pager = this.#dom.element("div", "inventory-pager");
    const ids = this.#config.items.map((item) => item.id);
    const tabs = this.#tabs.create({ activeId: ids[this.#index], onSelect: (id) => this.select(ids.indexOf(id)) });
    tabs.classList.add("inventory-pager__tabs");
    const viewport = this.#dom.element("div", `inventory-pager__viewport ${viewportClassName}`.trim());
    const track = this.#dom.element("div", "inventory-pager__track");
    pages.forEach((nodes, index) => {
      const host = this.#dom.element("div", `inventory-pager__page inventory-pager__page--${ids[index]}`);
      host.append(...nodes);
      track.appendChild(host);
    });
    viewport.appendChild(track);
    pager.append(tabs, viewport);
    if (this.#current) this.#swipe.detach(this.#current.viewport);
    this.#swipe.attach(viewport, { pageCount: pages.length, getIndex: () => this.#index, onSelect: (index) => this.select(index),
      onEdge });
    this.#current = { tabs, viewport };
    this.#apply();
    return pager;
  }

  select(index) {
    if (index < 0 || index === this.#index) return;
    this.#index = index;
    this.#apply();
  }

  selectLast() {
    this.select(this.#config.items.length - 1);
  }

  #apply() {
    if (!this.#current) return;
    this.#tabs.update(this.#current.tabs, this.#config.items[this.#index].id);
    this.#current.viewport.style.setProperty("--inventory-pager-index", String(this.#index));
  }
}
