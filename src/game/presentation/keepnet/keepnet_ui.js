export class KeepnetUI {
  #document;
  #liveBait;
  #inventoryUI;
  #model;
  #cards;
  #labels;
  #filter = { kind: "all", speciesId: "all" };
  #detailSpecies = null;
  #pendingRelease = null;
  #notice = "";
  #root;
  #button;
  #closeButton;
  #back;
  #heading;
  #right;
  #main;
  #kind;
  #list;
  #count;
  #species;
  #status;
  #lastFocus = null;
  #open = false;
  #signature = "";
  #speciesSignature = "";
  #rendered = new Map();
  #cardFocusables = [];

  constructor({ documentRef, liveBait, inventoryUI, model, cards, labels }) {
    this.#document = documentRef;
    this.#liveBait = liveBait;
    this.#inventoryUI = inventoryUI;
    this.#model = model;
    this.#cards = cards;
    this.#labels = labels;
    this.#button = this.#el("button", "keepnet-button", labels.button);
    this.#button.type = "button";
    this.#button.setAttribute("aria-label", labels.open);
    this.#button.addEventListener("click", this.#toggle);
    this.#root = this.#el("div", "keepnet-modal");
    this.#root.setAttribute("role", "dialog");
    this.#root.setAttribute("aria-modal", "true");
    this.#root.setAttribute("aria-label", labels.title);
    this.#root.setAttribute("aria-hidden", "true");
    const header = this.#el("header", "keepnet-modal__header");
    header.append(this.#el("h2", "keepnet-modal__title", labels.title));
    this.#closeButton = this.#el("button", "keepnet-modal__close", labels.close);
    this.#closeButton.type = "button";
    this.#closeButton.addEventListener("click", () => this.close());
    header.append(this.#closeButton);
    const main = this.#el("main", "keepnet-modal__main");
    this.#main = main;
    const left = this.#el("section", "keepnet-modal__left");
    left.append(this.#el("div", "keepnet-modal__visual", "🐟"), this.#el("h3", "keepnet-modal__section-title", labels.parameters));
    this.#count = this.#el("p", "keepnet-modal__count");
    this.#status = this.#el("p", "keepnet-modal__status");
    this.#status.setAttribute("role", "status");
    left.append(this.#count, this.#status, this.#el("p", "keepnet-modal__note", labels.note));
    this.#right = this.#el("section", "keepnet-modal__right");
    this.#back = this.#el("button", "keepnet-modal__back", labels.back);
    this.#back.type = "button";
    this.#back.addEventListener("click", this.#goBack);
    this.#heading = this.#el("h3", "keepnet-modal__section-title", labels.contents);
    const filters = this.#el("div", "keepnet-modal__filters");
    this.#kind = this.#el("select", "keepnet-modal__filter");
    this.#kind.setAttribute("aria-label", labels.kindLabel);
    for (const [value, label] of labels.kinds) this.#kind.append(this.#option(value, label));
    this.#kind.value = "all";
    this.#kind.addEventListener("change", () => {
      this.#filter.kind = this.#kind.value;
      this.#pendingRelease = null;
      this.refresh();
    });
    this.#species = this.#el("select", "keepnet-modal__filter");
    this.#species.setAttribute("aria-label", labels.speciesLabel);
    this.#species.addEventListener("change", () => {
      this.#filter.speciesId = this.#species.value;
      this.#detailSpecies = null;
      this.#pendingRelease = null;
      this.refresh();
    });
    filters.append(this.#kind, this.#species);
    this.#list = this.#el("div", "keepnet-modal__list");
    this.#right.append(this.#back, this.#heading, filters, this.#list);
    main.append(left, this.#right);
    this.#root.append(header, main);
    this.#root.addEventListener("keydown", this.#handleKey);
    documentRef.body.append(this.#button, this.#root);
    this.refresh();
  }
  get isOpen() { return this.#open; }
  showCatchResult(result) {
    if (result.ok && !result.notice) return;
    this.open();
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
  open() {
    if (this.#open) return;
    this.#inventoryUI?.close();
    this.#lastFocus = this.#document.activeElement;
    this.#open = true;
    this.#notice = "";
    this.#root.classList.add("keepnet-modal--open");
    this.#root.removeAttribute("aria-hidden");
    this.#liveBait.advance();
    this.refresh();
    this.#closeButton.focus();
  }
  close() {
    if (!this.#open) return;
    this.#open = false;
    this.#pendingRelease = null;
    this.#root.classList.remove("keepnet-modal--open");
    this.#root.setAttribute("aria-hidden", "true");
    this.#lastFocus?.focus?.();
    this.#lastFocus = null;
  }
  refresh() {
    if (!this.#open && this.#signature) return;
    const model = this.#model.build(this.#liveBait.getView(), this.#filter);
    this.#filter.speciesId = model.speciesId;
    const group = model.groups.find((entry) => entry.id === this.#detailSpecies);
    if (!group) this.#detailSpecies = null;
    if (!model.filtered.some((fish) => fish.id === this.#pendingRelease)) this.#pendingRelease = null;
    this.#count.textContent = this.#labels.count(model.count, model.capacity, model.liveCount, model.reservedCount);
    const status = model.error ? this.#labels.error(model.error) : this.#notice || this.#labels.status;
    if (this.#status.textContent !== status) this.#status.textContent = status;
    this.#back.hidden = !group;
    this.#heading.textContent = group ? this.#labels.details(group.name, group.count) : this.#labels.contents;
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
      const scroll = this.#right.scrollTop;
      const mobileScroll = this.#main.scrollTop;
      this.#rendered.clear();
      const rendered = group ? group.fish.map((fish) => {
        const card = this.#cards.fish(fish, { aquarium: model.aquarium,
          pendingRelease: this.#pendingRelease, onAction: this.#act });
        this.#rendered.set(fish.id, card);
        return card;
      }) : model.groups.map((item) => this.#cards.group(item, this.#openSpecies));
      this.#cardFocusables = rendered.flatMap((card) => card.focusables);
      this.#list.replaceChildren(...(rendered.length ? rendered.map((card) => card.element) :
        [this.#el("p", "keepnet-modal__empty", this.#labels.empty)]));
      this.#signature = signature;
      this.#right.scrollTop = scroll;
      this.#main.scrollTop = mobileScroll;
      if (hadCardFocus) (this.#cardFocusables.find((el) => el.dataset.keepnetFocus === focusKey) ||
        (group ? this.#back : this.#closeButton)).focus();
      else if (active === this.#back && !group) this.#closeButton.focus();
    }
    if (group) for (const fish of group.fish) this.#rendered.get(fish.id)?.update(fish);
  }
  dispose() {
    this.close();
    this.#button.removeEventListener("click", this.#toggle);
    this.#root.removeEventListener("keydown", this.#handleKey);
    this.#button.remove(); this.#root.remove();
    this.#rendered.clear(); this.#cardFocusables = [];
  }
  #openSpecies = (id) => {
    this.#detailSpecies = id; this.#pendingRelease = null;
    this.refresh(); this.#right.scrollTop = 0; this.#main.scrollTop = 0; this.#back.focus();
  };
  #goBack = () => {
    const id = this.#detailSpecies;
    this.#detailSpecies = null; this.#pendingRelease = null;
    this.refresh(); this.#right.scrollTop = 0; this.#main.scrollTop = 0;
    (this.#cardFocusables.find((el) => el.dataset.keepnetFocus === `species:${id}`) || this.#closeButton).focus();
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
  #toggle = () => this.#open ? this.close() : this.open();
  #handleKey = (event) => {
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation();
      if (this.#pendingRelease) { this.#pendingRelease = null; this.refresh(); }
      else if (this.#detailSpecies) this.#goBack();
      else this.close();
    } else if (event.key === "Tab") {
      const controls = [this.#closeButton, ...(!this.#back.hidden ? [this.#back] : []),
        this.#kind, this.#species, ...this.#cardFocusables];
      const index = controls.indexOf(this.#document.activeElement);
      if (index < 0 || (event.shiftKey && index === 0) || (!event.shiftKey && index === controls.length - 1)) {
        event.preventDefault();
        controls[event.shiftKey ? controls.length - 1 : 0].focus();
      }
    }
  };
}
