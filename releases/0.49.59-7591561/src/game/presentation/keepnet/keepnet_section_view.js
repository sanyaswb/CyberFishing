// The inventory's keepnet section (spec 067), laid out like the backpack section (spec 088): the summary (the keepnet
// view: image with help, capacity scale, status) belongs in the inventory's left container and the content (filters
// panel, then the fish-list pager whose second page repeats the keepnet view for portrait) in its right host. The
// toolbar keepnet button opens the inventory at this section.
export class KeepnetSectionView {
  #document;
  #liveBait;
  #model;
  #cards;
  #overviews;
  #filtersRenderer;
  #pager;
  #labels;
  #openSection;
  #toggleSection;
  #filter = { kind: "all", speciesId: "all" };
  #detailSpecies = null;
  #pendingRelease = null;
  #notice = "";
  #button;
  #buttonImage;
  #buttonPlaceholder;
  #backdrop;
  #imageResolver;
  #imageAsset;
  #assets;
  #summary;
  #pagerOverview;
  #content;
  #helpButtons;
  #helpText;
  #hints;
  #helpOpen = false;
  #back;
  #heading;
  #detail;
  #filters;
  #list;
  #visible = false;
  #signature = "";
  #rendered = new Map();
  #cardFocusables = [];

  constructor({ documentRef, liveBait, model, cards, labels, overviewRenderer, filtersRenderer, pagerRenderer,
    hintRenderer, imageResolver, openSection, toggleSection, buttonMountNode, listScrollController, onPagerEdge = null,
    shortcutIcon, assets }) {
    // assets: the AssetRegistry; the stage art and the shortcut's sprite symbol ({ asset, symbol }) are asset ids.
    if (!assets || typeof assets.pathOf !== "function") throw new TypeError("KeepnetSectionView requires assets");
    this.#assets = assets;
    this.#document = documentRef;
    this.#hints = hintRenderer;
    this.#liveBait = liveBait;
    this.#model = model;
    this.#cards = cards;
    this.#overviews = overviewRenderer;
    this.#filtersRenderer = filtersRenderer;
    this.#pager = pagerRenderer;
    this.#labels = labels;
    this.#imageResolver = imageResolver;
    this.#imageAsset = imageResolver.resolve(0);
    this.#openSection = openSection;
    this.#toggleSection = toggleSection;
    this.#button = this.#el("button", "keepnet-button game-toolbar-button game-toolbar-button--keepnet");
    // Spec 157 TK-174: until the game is ready the toolbar button shows the sections sprite's keepnet symbol; its
    // stage art (lazy and not yet in the page, so not requested) replaces it after showShortcutArtwork().
    this.#buttonImage = this.#icon("keepnet-button__icon");
    this.#buttonPlaceholder = this.#spriteIcon(shortcutIcon, "keepnet-button__placeholder");
    this.#button.append(this.#buttonPlaceholder);
    this.#button.type = "button";
    this.#button.title = labels.open;
    this.#button.setAttribute("aria-label", labels.open);
    this.#button.addEventListener("click", this.#toggle);
    const showHelp = () => this.#setHelpVisible(true);
    this.#summary = this.#overviews.create({ className: "keepnet-section__summary", onHelp: showHelp });
    this.#pagerOverview = this.#overviews.create({ onHelp: showHelp });
    this.#helpButtons = [this.#summary, this.#pagerOverview].map((view) => this.#overviews.helpButton(view))
      .filter(Boolean);
    this.#helpText = this.#hints.create({ className: "keepnet-section__help-text", closeLabel: labels.closeHelp,
      role: "note", onClose: () => this.#setHelpVisible(false) });
    this.#helpText.id = "keepnet-help";
    this.#content = this.#el("section", "keepnet-section__content");
    this.#content.setAttribute("aria-label", labels.title);
    this.#back = this.#el("button", "keepnet-section__back", labels.back);
    this.#back.type = "button";
    this.#back.addEventListener("click", this.#goBack);
    this.#heading = this.#el("h3", "keepnet-section__section-title");
    // The species details row takes no space (and no column gap) while the list shows all species.
    this.#detail = this.#el("div", "keepnet-section__detail");
    this.#detail.append(this.#back, this.#heading);
    this.#filters = this.#filtersRenderer.create({
      onKind: (kind) => {
        this.#filter.kind = kind;
        this.#pendingRelease = null;
        this.refresh();
      },
      onSpecies: (speciesId) => {
        this.#filter.speciesId = speciesId;
        this.#detailSpecies = null;
        this.#pendingRelease = null;
        this.refresh();
      },
    });
    this.#list = this.#el("div", "keepnet-section__list inventory-collection__list");
    // Dragging over a fish card scrolls the list instead of opening the card (spec 076).
    listScrollController.attach(this.#list);
    // Shared collection (spec 074): the filters panel at the top, a gap, then the items panel, which in portrait is a
    // pager like the backpack's: the fish list over the faded keepnet, and the keepnet view.
    const controls = this.#el("div", "keepnet-section__controls inventory-collection__controls inventory-panel");
    const backdrop = this.#icon("keepnet-section__backdrop");
    this.#backdrop = backdrop;
    backdrop.classList.add("inventory-collection__backdrop");
    controls.append(this.#filters, this.#detail);
    const pager = this.#pager.create([[backdrop, this.#list], [this.#pagerOverview]], {
      viewportClassName: "keepnet-section__items inventory-collection__items inventory-panel", onEdge: onPagerEdge });
    this.#content.classList.add("inventory-collection");
    this.#content.append(controls, pager);
    this.#summary.addEventListener("keydown", this.#handleKey);
    this.#content.addEventListener("keydown", this.#handleKey);
    buttonMountNode.appendChild(this.#button);
    this.refresh();
  }
  get summaryNode() { return this.#summary; }
  setShortcutVisible(visible) { this.#button.hidden = !visible; }
  // Spec 157 TK-174: requests the button's stage art and shows it in place of the sprite icon once it has loaded.
  showShortcutArtwork() {
    if (!this.#buttonPlaceholder) return;
    const placeholder = this.#buttonPlaceholder;
    this.#buttonPlaceholder = null;
    this.#buttonImage.addEventListener("load", () => placeholder.replaceWith(this.#buttonImage), { once: true });
    this.#buttonImage.loading = "eager";
  }
  // The help hint; its host places it in its hint region (the inventory's, spec 086).
  get helpNode() { return this.#helpText; }
  get contentNode() { return this.#content; }
  // Game timers refresh the keepnet only while its section is visible.
  get isOpen() { return this.#visible; }
  setVisible(visible) {
    if (visible === this.#visible) return;
    this.#visible = visible;
    if (visible) {
      this.#notice = "";
      // Opening the section starts on the fish list, like the backpack's item list.
      this.#pager.select(0);
      this.#liveBait.advance();
      this.refresh();
    } else {
      this.#setHelpVisible(false);
      this.#pendingRelease = null;
    }
  }
  showCatchResult(result) {
    if (result.ok && !result.notice) return;
    this.#openSection();
    this.#notice = result.ok ? this.#labels.fallback : this.#labels.error(result.reason);
    if (result.fishId) {
      const fish = this.#liveBait.getView().liveBaits.find((entry) => entry.id === result.fishId);
      this.#filter = { kind: "all", speciesId: "all" };
      this.#detailSpecies = fish ? fish.hasAnomaly !== false || fish.isUnique !== false
        ? `fish:${fish.id}` : fish.sourceSpeciesId : null;
    }
    this.refresh();
  }
  refresh() {
    if (!this.#visible && this.#signature) return;
    const model = this.#model.build(this.#liveBait.getView(), this.#filter);
    this.#filter.speciesId = model.speciesId;
    const group = model.groups.find((entry) => entry.id === this.#detailSpecies);
    if (!group) this.#detailSpecies = null;
    if (!model.filtered.some((fish) => fish.id === this.#pendingRelease)) this.#pendingRelease = null;
    const reading = { percent: model.capacityPercent,
      value: this.#labels.occupancy(model.count + model.reservedCount, model.capacity),
      label: `${this.#labels.capacity}: ${this.#labels.count(model.count, model.capacity, model.liveCount, model.reservedCount)}`,
      status: model.error ? this.#labels.error(model.error) : this.#notice };
    this.#overviews.update(this.#summary, reading);
    this.#overviews.update(this.#pagerOverview, reading);
    const imageAsset = this.#imageResolver.resolve(model.capacityPercent);
    if (this.#imageAsset !== imageAsset) {
      const source = this.#assets.pathOf(imageAsset);
      this.#buttonImage.src = source;
      this.#backdrop.src = source;
      this.#imageAsset = imageAsset;
    }
    this.#detail.hidden = !group;
    this.#back.hidden = !group;
    this.#heading.hidden = !group;
    this.#heading.textContent = group ? this.#labels.details(group.name, group.count) : "";
    this.#filtersRenderer.update(this.#filters, { kind: model.kind, species: model.species, speciesId: model.speciesId });
    // Timer-only updates retain images, focused controls and scroll position.
    const signature = JSON.stringify([this.#detailSpecies, this.#pendingRelease, model.kind,
      model.speciesId, model.aquarium?.owned,
      model.filtered.map(({ remainingMs, ...fish }) => fish)]);
    if (signature !== this.#signature) {
      const active = this.#document.activeElement;
      const focusKey = active?.dataset?.keepnetFocus;
      const hadCardFocus = this.#cardFocusables.includes(active);
      const scroll = this.#content.scrollTop;
      this.#rendered.clear();
      const rendered = group ? group.fish.map((fish) => {
        const card = this.#cards.fish(fish, { aquarium: model.aquarium,
          pendingRelease: this.#pendingRelease, onAction: this.#act });
        this.#rendered.set(fish.id, card);
        return card;
      }) : model.groups.map((item) => this.#cards.group(item, this.#openSpecies));
      this.#cardFocusables = rendered.flatMap((card) => card.focusables);
      this.#list.replaceChildren(...(rendered.length ? rendered.map((card) => card.element) :
        [this.#el("p", "keepnet-section__empty", this.#labels.empty)]));
      this.#signature = signature;
      this.#content.scrollTop = scroll;
      if (hadCardFocus) (this.#cardFocusables.find((el) => el.dataset.keepnetFocus === focusKey) ||
        (group ? this.#back : this.#activeKind())).focus();
      else if (active === this.#back && !group) this.#activeKind().focus();
    }
    if (group) for (const fish of group.fish) this.#rendered.get(fish.id)?.update(fish);
  }
  dispose() {
    this.setVisible(false);
    this.#setHelpVisible(false);
    this.#hints.dispose(this.#helpText);
    this.#button.removeEventListener("click", this.#toggle);
    this.#summary.removeEventListener("keydown", this.#handleKey);
    this.#content.removeEventListener("keydown", this.#handleKey);
    this.#button.remove(); this.#summary.remove(); this.#content.remove(); this.#helpText.remove();
    this.#rendered.clear(); this.#cardFocusables = [];
  }
  #activeKind() { return this.#filtersRenderer.activeKind(this.#filters); }
  #openSpecies = (id) => {
    this.#detailSpecies = id; this.#pendingRelease = null;
    this.refresh(); this.#content.scrollTop = 0; this.#back.focus();
  };
  #goBack = () => {
    const id = this.#detailSpecies;
    this.#detailSpecies = null; this.#pendingRelease = null;
    this.refresh(); this.#content.scrollTop = 0;
    (this.#cardFocusables.find((el) => el.dataset.keepnetFocus === `species:${id}`) || this.#activeKind()).focus();
  };
  #act = (fish, action) => {
    if (action === "release" || action === "cancel-release") {
      this.#pendingRelease = action === "release" ? fish.id : null;
      this.refresh();
      const key = `${fish.id}:${action === "release" ? "cancel-release" : "release"}`;
      this.#cardFocusables.find((el) => el.dataset.keepnetFocus === key)?.focus();
      return;
    }
    const commands = {
      convert: () => this.#liveBait.convertStoredCatch(fish.id),
      select: () => this.#liveBait.selectBait(fish.id),
      deselect: () => this.#liveBait.selectBait(null),
      transfer: () => this.#liveBait.transferToAquarium(fish.id),
      "confirm-release": () => fish.kind === "catch" ? this.#liveBait.releaseCatch(fish.id) : this.#liveBait.releaseBait(fish.id),
    };
    const result = commands[action]?.();
    if (!result) return;
    this.#pendingRelease = null;
    this.#notice = result.ok ? this.#labels.done : this.#labels.error(result.reason);
    if (result.ok && ["convert", "transfer"].includes(action)) {
      const view = this.#liveBait.getView();
      const converted = view.liveBaits.find((entry) => entry.id === fish.id);
      if (converted?.location === "aquarium") this.#notice = this.#labels.moved;
      else if (view.aquarium.owned) this.#notice = this.#labels.fallback;
    }
    this.refresh();
  };
  #el(tag, className, text = null) {
    const el = this.#document.createElement(tag);
    if (className) el.className = className;
    if (text !== null) el.textContent = text;
    return el;
  }
  #spriteIcon({ asset, symbol }, className) {
    const href = `${this.#assets.pathOf(asset)}#${symbol}`;
    const namespace = "http://www.w3.org/2000/svg";
    const icon = this.#document.createElementNS(namespace, "svg");
    icon.setAttribute("class", className);
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("focusable", "false");
    const use = this.#document.createElementNS(namespace, "use");
    use.setAttribute("href", href);
    icon.appendChild(use);
    return icon;
  }
  #icon(className, alt = "") {
    const image = this.#el("img", className);
    // Spec 157 R6: lazy before src, so a hidden image (closed inventory, hidden toolbar button) waits until it is shown.
    image.loading = "lazy";
    image.decoding = "async";
    image.src = this.#assets.pathOf(this.#imageAsset);
    image.alt = alt;
    image.draggable = false;
    return image;
  }
  #setHelpVisible(visible) {
    if (!this.#helpText || this.#helpOpen === visible) return;
    this.#helpOpen = visible;
    if (visible) this.#hints.show(this.#helpText, `${this.#labels.status}\n${this.#labels.note}`);
    else this.#hints.hide(this.#helpText);
    for (const button of this.#helpButtons) button.setAttribute("aria-expanded", String(visible));
    if (visible) this.#document.addEventListener("click", this.#dismissHelp, true);
    else this.#document.removeEventListener("click", this.#dismissHelp, true);
  }
  // Capture sees the next click even on controls that shield their bubbling events. Reading (scrolling, selecting)
  // inside the hint keeps it open; its close button and every click elsewhere dismiss it.
  #dismissHelp = (event) => {
    if (this.#helpText.contains(event.target) && !event.target.closest?.(".ui-hint__close")) return;
    this.#setHelpVisible(false);
    // A second press on ? dismisses the hint without reopening it in the button's handler.
    if (this.#helpButtons.some((button) => button.contains(event.target))) event.stopPropagation();
  };
  #toggle = () => this.#toggleSection();
  // Escape steps back inside the section (hint, pending release, species details); otherwise it is not handled here.
  #handleKey = (event) => {
    if (event.key !== "Escape") return;
    if (this.#helpOpen) this.#setHelpVisible(false);
    else if (this.#pendingRelease) { this.#pendingRelease = null; this.refresh(); }
    else if (this.#detailSpecies) this.#goBack();
    else return;
    event.preventDefault(); event.stopPropagation();
  };
}
