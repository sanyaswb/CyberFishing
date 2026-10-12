import { KeepnetViewModel } from "./keepnet_view_model.js";

export class KeepnetUI {
  #document;
  #liveBait;
  #inventoryUI;
  #model = new KeepnetViewModel();
  #filter = { kind: "all", speciesId: "all" };
  #root;
  #button;
  #lastFocus = null;
  #open = false;
  #list;
  #count;
  #species;
  #status;
  constructor({ documentRef, liveBait, inventoryUI }) {
    this.#document = documentRef;
    this.#liveBait = liveBait;
    this.#inventoryUI = inventoryUI;
    this.#button = this.#el("button", "keepnet-button", "🐟 Садок");
    this.#button.type = "button";
    this.#button.setAttribute("aria-label", "Відкрити садок");
    this.#button.addEventListener("click", this.#toggle);
    this.#root = this.#el("div", "keepnet-modal");
    this.#root.setAttribute("role", "dialog");
    this.#root.setAttribute("aria-modal", "true");
    this.#root.setAttribute("aria-label", "Садок");
    this.#root.setAttribute("aria-hidden", "true");
    const header = this.#el("header", "keepnet-modal__header");
    header.append(this.#el("h2", "keepnet-modal__title", "Садок"));
    const close = this.#el("button", "keepnet-modal__close", "Закрити ×");
    close.type = "button";
    close.addEventListener("click", () => this.close());
    header.append(close);
    const main = this.#el("main", "keepnet-modal__main");
    const left = this.#el("section", "keepnet-modal__left");
    left.append(this.#el("div", "keepnet-modal__visual", "🐟"), this.#el("h3", "keepnet-modal__section-title", "Параметри садка"));
    this.#count = this.#el("p", "keepnet-modal__count");
    this.#status = this.#el("p", "keepnet-modal__status");
    left.append(this.#count, this.#status, this.#el("p", "keepnet-modal__note", "У садку немає прикормки. Живці мають власний відлік життя."));
    const right = this.#el("section", "keepnet-modal__right");
    right.append(this.#el("h3", "keepnet-modal__section-title", "Збережена риба"));
    const filters = this.#el("div", "keepnet-modal__filters");
    const kind = this.#el("select", "keepnet-modal__filter");
    kind.setAttribute("aria-label", "Тип риби");
    for (const [value, label] of [["all", "Уся риба"], ["catch", "Забраний улов"], ["live_bait", "Живці"]]) {
      const option = this.#el("option", "", label); option.value = value; kind.append(option);
    }
    kind.addEventListener("change", () => { this.#filter.kind = kind.value; this.refresh(); });
    this.#species = this.#el("select", "keepnet-modal__filter");
    this.#species.setAttribute("aria-label", "Вид риби");
    this.#species.addEventListener("change", () => { this.#filter.speciesId = this.#species.value; this.refresh(); });
    filters.append(kind, this.#species);
    this.#list = this.#el("div", "keepnet-modal__list");
    right.append(filters, this.#list);
    main.append(left, right);
    this.#root.append(header, main);
    this.#root.addEventListener("keydown", this.#handleKey);
    documentRef.body.append(this.#button, this.#root);
    this.refresh();
  }
  get isOpen() { return this.#open; }
  open() {
    this.#inventoryUI?.close();
    this.#lastFocus = this.#document.activeElement;
    this.#open = true;
    this.#root.classList.add("keepnet-modal--open");
    this.#root.removeAttribute("aria-hidden");
    this.refresh();
    this.#root.querySelector(".keepnet-modal__close").focus();
  }
  close() {
    if (!this.#open) return;
    this.#open = false;
    this.#root.classList.remove("keepnet-modal--open");
    this.#root.setAttribute("aria-hidden", "true");
    this.#lastFocus?.focus?.();
    this.#lastFocus = null;
  }
  refresh() {
    if (!this.#open && this.#list.childNodes.length > 0) return;
    const model = this.#model.build(this.#liveBait.getView(), this.#filter);
    this.#count.textContent = `${model.count} / ${model.capacity} риб · ${model.liveCount} живців`;
    this.#status.textContent = model.error ? `Помилка збереження: ${model.error}` : "Прикормка доступна лише в акваріумі";
    const current = this.#filter.speciesId;
    this.#species.replaceChildren();
    const allOption = this.#el("option", "", "Усі види"); allOption.value = "all"; this.#species.append(allOption);
    for (const item of model.species) { const option = this.#el("option", "", item.name); option.value = item.id; this.#species.append(option); }
    this.#species.value = model.species.some((item) => item.id === current) ? current : "all";
    this.#filter.speciesId = this.#species.value;
    this.#list.replaceChildren(...(model.filtered.length ? model.filtered.map((fish) => this.#fishCard(fish)) :
      [this.#el("p", "keepnet-modal__empty", "За цими фільтрами риби немає.")]));
  }
  dispose() { this.#button.removeEventListener("click", this.#toggle); this.#root.removeEventListener("keydown", this.#handleKey); this.#button.remove(); this.#root.remove(); }
  #fishCard(fish) {
    const card = this.#el("article", "keepnet-modal__fish");
    card.append(this.#el("strong", "keepnet-modal__fish-name", fish.name),
      this.#el("span", "keepnet-modal__fish-weight", `${Math.round(fish.weightKg * 1000)} г`));
    if (fish.kind === "live_bait") {
      const seconds = Math.max(0, Math.ceil(fish.remainingMs / 1000));
      const minutes = Math.floor(seconds / 60);
      card.append(this.#el("span", "keepnet-modal__fish-timer", `Живець · ${minutes}:${String(seconds % 60).padStart(2, "0")}`));
    }
    return card;
  }
  #el(tag, className, text = null) {
    const el = this.#document.createElement(tag);
    if (className) el.className = className;
    if (text !== null) el.textContent = text;
    return el;
  }
  #toggle = () => this.#open ? this.close() : this.open();
  #handleKey = (event) => { if (event.key === "Escape") this.close(); };
}
