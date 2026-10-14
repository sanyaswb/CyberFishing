import { inventorySlotIconPath } from "../inventory/inventory_slot_icons.js";

// The inventory's keepnet section (spec 067): the summary (illustration, occupancy, status, help) belongs in the
// inventory's left container and the content (groups, details, filters, fish cards) in its right host. The toolbar
// keepnet button opens the inventory at this section.
export class KeepnetSectionView {
  #document;
  #liveBait;
  #model;
  #cards;
  #meters;
  #labels;
  #openSection;
  #toggleSection;
  #filter = { kind: "all", speciesId: "all" };
  #detailSpecies = null;
  #pendingRelease = null;
  #notice = "";
  #button;
  #summary;
  #content;
  #helpButton;
  #helpText;
  #back;
  #heading;
  #kind;
  #list;
  #capacity;
  #count;
  #species;
  #status;
  #visible = false;
  #signature = "";
  #speciesSignature = "";
  #rendered = new Map();
  #cardFocusables = [];

  constructor({ documentRef, liveBait, model, cards, labels, resourceMeterRenderer, openSection, toggleSection,
    buttonMountNode }) {
    this.#document = documentRef;
    this.#liveBait = liveBait;
    this.#model = model;
    this.#cards = cards;
    this.#meters = resourceMeterRenderer;
    this.#labels = labels;
    this.#openSection = openSection;
    this.#toggleSection = toggleSection;
    this.#button = this.#el("button", "keepnet-button game-toolbar-button game-toolbar-button--keepnet");
    this.#button.append(this.#icon("keepnet-button__icon"));
    this.#button.type = "button";
    this.#button.title = labels.open;
    this.#button.setAttribute("aria-label", labels.open);
    this.#button.addEventListener("click", this.#toggle);
    this.#summary = this.#el("section", "keepnet-section__summary");
    this.#summary.setAttribute("aria-label", labels.title);
    this.#helpButton = this.#el("button", "keepnet-section__help", "?");
    this.#helpButton.type = "button";
    this.#helpButton.setAttribute("aria-label", labels.help);
    this.#helpButton.setAttribute("aria-expanded", "false");
    this.#helpButton.setAttribute("aria-controls", "keepnet-help");
    this.#helpButton.addEventListener("click", () => this.#setHelpVisible(true));
    this.#helpText = this.#el("div", "keepnet-section__help-text", `${labels.status}\n${labels.note}`);
    this.#helpText.id = "keepnet-help";
    this.#helpText.hidden = true;
    this.#helpText.setAttribute("role", "note");
    const visual = this.#el("div", "keepnet-section__visual");
    visual.append(this.#icon("keepnet-section__icon", labels.title), this.#helpButton, this.#helpText);
    this.#capacity = this.#meters.create({ id: "keepnet-capacity", percent: 0,
      remainingPercent: 100, label: labels.capacity }, { variant: "summary", showIcon: false });
    this.#capacity.classList.add("keepnet-section__capacity");
    this.#count = this.#el("p", "keepnet-section__count");
    this.#status = this.#el("p", "keepnet-section__status");
    this.#status.setAttribute("role", "status");
    this.#summary.append(visual, this.#count, this.#capacity, this.#status);
    this.#content = this.#el("section", "keepnet-section__content");
    this.#content.setAttribute("aria-label", labels.title);
    this.#back = this.#el("button", "keepnet-section__back", labels.back);
    this.#back.type = "button";
    this.#back.addEventListener("click", this.#goBack);
    this.#heading = this.#el("h3", "keepnet-section__section-title");
    const filters = this.#el("div", "keepnet-section__filters");
    this.#kind = this.#el("select", "keepnet-section__filter");
    this.#kind.setAttribute("aria-label", labels.kindLabel);
    for (const [value, label] of labels.kinds) this.#kind.append(this.#option(value, label));
    this.#kind.value = "all";
    this.#kind.addEventListener("change", () => {
      this.#filter.kind = this.#kind.value;
      this.#pendingRelease = null;
      this.refresh();
    });
    this.#species = this.#el("select", "keepnet-section__filter");
    this.#species.setAttribute("aria-label", labels.speciesLabel);
    this.#species.addEventListener("change", () => {
      this.#filter.speciesId = this.#species.value;
      this.#detailSpecies = null;
      this.#pendingRelease = null;
      this.refresh();
    });
    filters.append(this.#kind, this.#species);
    this.#list = this.#el("div", "keepnet-section__list");
    // Shared collection (spec 074): back/heading/filters panel, a gap, then the fish list over the faded keepnet,
    // which CSS shows only in portrait.
    const controls = this.#el("div", "keepnet-section__controls inventory-collection__controls inventory-panel");
    const items = this.#el("div", "keepnet-section__items inventory-collection__items inventory-panel");
    const backdrop = this.#icon("keepnet-section__backdrop");
    backdrop.classList.add("inventory-collection__backdrop");
    controls.append(this.#back, this.#heading, filters);
    items.append(backdrop, this.#list);
    this.#content.classList.add("inventory-collection");
    this.#content.append(controls, items);
    this.#summary.addEventListener("keydown", this.#handleKey);
    this.#content.addEventListener("keydown", this.#handleKey);
    buttonMountNode.appendChild(this.#button);
    this.refresh();
  }
  get summaryNode() { return this.#summary; }
  get contentNode() { return this.#content; }
  // Game timers refresh the keepnet only while its section is visible.
  get isOpen() { return this.#visible; }
  setVisible(visible) {
    if (visible === this.#visible) return;
    this.#visible = visible;
    if (visible) {
      this.#notice = "";
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
      this.#kind.value = "all";
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
    this.#meters.updateReading(this.#capacity, { percent: model.capacityPercent,
      remainingPercent: 100 - model.capacityPercent,
      label: `${this.#labels.capacity}: ${this.#labels.count(model.count, model.capacity, model.liveCount, model.reservedCount)}` });
    const count = this.#labels.occupancy(model.count + model.reservedCount, model.capacity);
    if (this.#count.textContent !== count) this.#count.textContent = count;
    const status = model.error ? this.#labels.error(model.error) : this.#notice;
    if (this.#status.textContent !== status) this.#status.textContent = status;
    this.#status.hidden = !status;
    this.#back.hidden = !group;
    this.#heading.hidden = !group;
    this.#heading.textContent = group ? this.#labels.details(group.name, group.count) : "";
    const speciesSignature = JSON.stringify(model.species);
    if (speciesSignature !== this.#speciesSignature) {
      this.#species.replaceChildren(this.#option("all", this.#labels.allSpecies),
        ...model.species.map((item) => this.#option(item.id, item.name)));
      this.#speciesSignature = speciesSignature;
    }
    this.#species.value = model.speciesId;
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
        (group ? this.#back : this.#kind)).focus();
      else if (active === this.#back && !group) this.#kind.focus();
    }
    if (group) for (const fish of group.fish) this.#rendered.get(fish.id)?.update(fish);
  }
  dispose() {
    this.setVisible(false);
    this.#setHelpVisible(false);
    this.#button.removeEventListener("click", this.#toggle);
    this.#summary.removeEventListener("keydown", this.#handleKey);
    this.#content.removeEventListener("keydown", this.#handleKey);
    this.#button.remove(); this.#summary.remove(); this.#content.remove();
    this.#rendered.clear(); this.#cardFocusables = [];
  }
  #openSpecies = (id) => {
    this.#detailSpecies = id; this.#pendingRelease = null;
    this.refresh(); this.#content.scrollTop = 0; this.#back.focus();
  };
  #goBack = () => {
    const id = this.#detailSpecies;
    this.#detailSpecies = null; this.#pendingRelease = null;
    this.refresh(); this.#content.scrollTop = 0;
    (this.#cardFocusables.find((el) => el.dataset.keepnetFocus === `species:${id}`) || this.#kind).focus();
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
  #option(value, label) { const option = this.#el("option", "", label); option.value = value; return option; }
  #icon(className, alt = "") {
    const image = this.#el("img", className);
    image.src = inventorySlotIconPath("keepnet");
    image.alt = alt;
    image.draggable = false;
    return image;
  }
  #setHelpVisible(visible) {
    if (!this.#helpText || this.#helpText.hidden === !visible) return;
    this.#helpText.hidden = !visible;
    this.#helpButton.setAttribute("aria-expanded", String(visible));
    if (visible) this.#document.addEventListener("click", this.#dismissHelp, true);
    else this.#document.removeEventListener("click", this.#dismissHelp, true);
  }
  // Capture sees the next click even on controls that shield their bubbling events.
  #dismissHelp = (event) => {
    this.#setHelpVisible(false);
    // A second press on ? dismisses the hint without reopening it in the button's handler.
    if (this.#helpButton.contains(event.target)) event.stopPropagation();
  };
  #toggle = () => this.#toggleSection();
  // Escape steps back inside the section (hint, pending release, species details); otherwise it is not handled here.
  #handleKey = (event) => {
    if (event.key !== "Escape") return;
    if (!this.#helpText.hidden) this.#setHelpVisible(false);
    else if (this.#pendingRelease) { this.#pendingRelease = null; this.refresh(); }
    else if (this.#detailSpecies) this.#goBack();
    else return;
    event.preventDefault(); event.stopPropagation();
  };
}
