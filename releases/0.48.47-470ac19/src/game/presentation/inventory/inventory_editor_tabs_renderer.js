// Item editor tabs in every layout: taps, swipes and Left/Right/Home/End share one active parameter page.
// Empty cells start a cancellable pick in every layout. Portrait retains the editor's inline choices;
// landscape/desktop highlights compatible items in the visible list. Repeating the target equips its first candidate.
// CSS shows the inline choices only in portrait. A long press on a filled cell keeps its removal action. Taps align the tab row (spec 093). Another root, a removed address or resetView() resets
// the active page to the root item.
export class InventoryEditorTabsRenderer {
  #dom;
  #resolver;
  #items;
  #parameters;
  #swipe;
  #rowScroll;
  #labels;
  #longPressDurationMs;
  #scrollAligner;
  #rootKey = null;
  #activeKey = null;
  #current = null;

  constructor({ domFactory, resolver, itemRenderer, parametersRenderer, swipeController, rowScrollController, labels,
    longPressDurationMs, scrollAligner }) {
    this.#dom = domFactory;
    this.#resolver = resolver;
    this.#items = itemRenderer;
    this.#parameters = parametersRenderer;
    this.#swipe = swipeController;
    this.#rowScroll = rowScrollController;
    this.#labels = labels;
    this.#longPressDurationMs = longPressDurationMs;
    this.#scrollAligner = scrollAligner;
  }

  // The items shown on the tab pages, for in-place parameter updates.
  items(model) {
    return this.#resolver.resolve(model).map((tab) => tab.item).filter(Boolean);
  }

  // A newly opened editor starts on its root item, even one viewed before.
  resetView() {
    this.#rootKey = null;
  }

  // swipeSurfaces: more elements whose horizontal swipe switches the page (the editor's preview).
  // inlineChoices(): true while the editor offers inline choices instead of the item list beside it.
  render(model, { onSocketActivate = null, onSocketLongPress = null, onSocketItemActivate = null, onWarning = null,
    inlineChoices = () => true, onTabSelect = null } = {}, { swipeSurfaces = [] } = {}) {
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
    const tabNodes = tabs.map((tab) => this.#renderTab(tab, { onSocketActivate, onSocketLongPress, onWarning, inlineChoices }));
    const pages = tabs.map((tab) => this.#renderPage(tab));
    row.append(...tabNodes);
    panel.append(...pages);
    row.addEventListener("keydown", (event) => this.#key(event));
    block.append(row, panel);
    if (this.#current) {
      for (const surface of this.#current.surfaces) this.#swipe.detach(surface);
      this.#rowScroll.detach(this.#current.row);
    }
    const surfaces = [panel, ...swipeSurfaces];
    for (const surface of surfaces) {
      this.#swipe.attach(surface, { pageCount: tabs.length, getIndex: () => this.#activeIndex(),
        onSelect: (index) => this.#select(this.#current.tabs[index].key) });
    }
    this.#rowScroll.attach(row);
    this.#current = { tabs, tabNodes, pages, row, panel, surfaces, onSocketItemActivate, onWarning, onTabSelect,
      candidateKey: null, candidates: null };
    this.#apply();
    return block;
  }

  #renderTab(tab, { onSocketActivate, onSocketLongPress, onWarning, inlineChoices }) {
    const node = this.#dom.element("div", `inventory-editor-tabs__tab inventory-editor-tabs__tab--${tab.kind}`);
    node.dataset.tabKey = tab.key;
    if (tab.kind === "socket") {
      const filled = Boolean(tab.item);
      node.classList.toggle("inventory-editor-tabs__tab--highlighted", tab.socket.highlighted === true);
      // Tabs show only the item; its scales live in the parameters (spec 093).
      node.appendChild(this.#items.renderSlot({ ...tab.socket, highlighted: false }, { variant: "socket", showAttachments: false,
        showResourceMeter: false, showTooltip: false,
        onActivate: filled ? () => this.#showByTap(tab.key) : () => {
          this.#showByTap(tab.key);
          onSocketActivate?.(tab.socket);
        },
        onLongPress: filled ? () => onSocketLongPress?.(tab.socket) : null,
        longPressDurationMs: this.#longPressDurationMs,
        // Inline: no stock still opens the page with the shop stub. Locked prerequisites, and every unavailable cell
        // beside the item list, retain their warning.
        onUnavailable: (warning) => tab.socket.canSelectCompatibleItem && inlineChoices()
          ? this.#showByTap(tab.key) : onWarning?.(warning) }));
      if (tab.socket.highlighted) {
        const highlight = this.#dom.element("span", "inventory-editor-tabs__highlight");
        highlight.setAttribute("aria-hidden", "true");
        node.appendChild(highlight);
      }
      return node;
    }
    const card = this.#items.renderItem(tab.item, { variant: "socket", showAttachments: false, showMetadata: false,
      showResourceMeter: false, showTooltip: false, onActivate: () => this.#showByTap(tab.key) });
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
      // An empty cell shows no "<cell>: empty" line (owner, 2026-10-17); it stays the page's accessible name.
      if (tab.item) page.appendChild(this.#dom.element("p", "inventory-editor-tabs__empty", this.#labels.noParameters(name)));
      else page.setAttribute("aria-label", this.#labels.emptyCell(name));
      if (!tab.item && tab.socket?.warning) {
        page.appendChild(this.#dom.element("p", "inventory-editor-tabs__empty", tab.socket.warning));
      }
    }
    return page;
  }

  #renderCandidates(socket, { onSocketItemActivate, onWarning }) {
    const candidates = this.#dom.element("div", "inventory-editor-tabs__candidates");
    candidates.setAttribute("aria-label", this.#labels.compatibleItems(socket.label));
    const items = socket.compatibleItems || [];
    if (items.length) {
      const grid = this.#dom.element("div", "inventory-editor-tabs__candidate-grid");
      for (const item of items) {
        grid.appendChild(this.#items.renderInventoryItem(item, {
          onActivate: () => onSocketItemActivate?.(socket, item),
        }));
      }
      candidates.appendChild(grid);
    } else {
      const shop = this.#dom.button("inventory-action inventory-action--muted", this.#labels.shop);
      shop.addEventListener("click", () => onWarning?.(this.#labels.shopInDevelopment));
      candidates.appendChild(shop);
    }
    return candidates;
  }

  // A tap shows the tab's parameters and brings the tab row to the top of the editor, as far as the content allows.
  #showByTap(key) {
    this.#select(key);
    this.#scrollAligner.alignToTop(this.#current.row);
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
    // Only the visible empty cell needs a candidate grid; multiple hook slots must not multiply the inventory DOM.
    const tab = this.#current.tabs[index];
    this.#current.onTabSelect?.(tab);
    const candidateKey = !tab.item && tab.socket?.canSelectCompatibleItem ? tab.key : null;
    if (candidateKey !== this.#current.candidateKey) {
      this.#current.candidates?.remove();
      this.#current.candidates = candidateKey ? this.#renderCandidates(tab.socket, this.#current) : null;
      this.#current.candidateKey = candidateKey;
      if (this.#current.candidates) this.#current.pages[index].appendChild(this.#current.candidates);
    }
    this.#current.panel.classList.toggle("inventory-editor-tabs__panel--first-active", index === 0);
    // A growing active last tab reaches the row's right edge; a lone root tab keeps half the width (spec 091).
    this.#current.panel.classList.toggle("inventory-editor-tabs__panel--last-active",
      this.#current.tabs.length > 1 && index === this.#current.tabs.length - 1);
  }
}
