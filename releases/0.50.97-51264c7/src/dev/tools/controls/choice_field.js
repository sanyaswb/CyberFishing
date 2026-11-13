const SEARCH_FROM_OPTIONS = 8;

// DEV list picker (spec 174 A3, TK-283): a button that shows the chosen option and opens the list under it.
// options: [{ value, label, hint = "", imageUrl = "" }] — label is the name a person reads, hint the id in the data.
// - The list opens in the flow under the field (never clipped by the panel's scrolling) with a search field from
//   eight options; typing filters by name and id.
// - Keys: Enter / Space / ArrowDown on the button open; in the list the arrows move, Enter chooses, Escape closes.
// - A value that is not among the options stays shown and marked, never replaced silently.
// onCommit(value) is called only when the choice changes.
export class ChoiceField {
  #document;
  #root;
  #button;
  #list = null;
  #search = null;
  #optionNodes = [];
  #visible = [];
  #active = -1;
  #options;
  #value;
  #onCommit;
  #ariaLabel;
  #disposers = [];

  constructor({ options, value, onCommit, ariaLabel = "", documentRef = document }) {
    this.#document = documentRef;
    this.#options = options;
    this.#value = value;
    this.#onCommit = onCommit;
    this.#ariaLabel = ariaLabel;

    this.#root = documentRef.createElement("div");
    this.#root.className = "devtools__choice";
    this.#button = documentRef.createElement("button");
    this.#button.type = "button";
    this.#button.className = "devtools__choice-button";
    this.#button.setAttribute("aria-haspopup", "listbox");
    this.#button.setAttribute("aria-expanded", "false");
    this.#root.appendChild(this.#button);
    this.#showValue();

    this.#listen(this.#button, "click", () => (this.#list ? this.#close() : this.#open()));
    this.#listen(this.#button, "keydown", (event) => {
      if (event.key !== "ArrowDown" || this.#list) return;
      event.preventDefault();
      event.stopPropagation();
      this.#open();
    });
    this.#listen(this.#root, "keydown", (event) => this.#onListKey(event));
    // Focus leaving the field closes the list (a press elsewhere in the panel, Tab).
    this.#listen(this.#root, "focusout", (event) => {
      if (this.#list && event.relatedTarget && !this.#root.contains(event.relatedTarget)) this.#close(false);
    });
  }

  get element() {
    return this.#root;
  }

  get isOpen() {
    return this.#list !== null;
  }

  setValue(value) {
    this.#value = value;
    this.#showValue();
    if (this.#list) this.#renderOptions();
  }

  dispose() {
    this.#close(false);
    for (const dispose of this.#disposers) dispose();
    this.#disposers.length = 0;
    this.#onCommit = null;
  }

  #showValue() {
    const option = this.#options.find((entry) => entry.value === this.#value);
    const parts = [];
    if (option?.imageUrl) parts.push(this.#createImage(option.imageUrl));
    const label = this.#document.createElement("span");
    label.className = "devtools__choice-label";
    label.textContent = option ? option.label : String(this.#value);
    parts.push(label);
    if (!option) {
      const unknown = this.#document.createElement("span");
      unknown.className = "devtools__choice-hint devtools__choice-hint--unknown";
      unknown.textContent = "невідомий id";
      parts.push(unknown);
    }
    const chevron = this.#document.createElement("span");
    chevron.className = "devtools__choice-chevron";
    chevron.setAttribute("aria-hidden", "true");
    parts.push(chevron);
    this.#button.replaceChildren(...parts);
    this.#button.setAttribute("aria-label",
      [this.#ariaLabel, option ? option.label : `${this.#value} (невідомий id)`].filter(Boolean).join(": "));
  }

  #open() {
    this.#list = this.#document.createElement("div");
    this.#list.className = "devtools__choice-list";
    if (this.#options.length >= SEARCH_FROM_OPTIONS) {
      this.#search = this.#document.createElement("input");
      this.#search.type = "text";
      this.#search.className = "devtools__input devtools__choice-search";
      this.#search.placeholder = "Пошук";
      this.#search.autocomplete = "off";
      this.#search.spellcheck = false;
      this.#search.setAttribute("aria-label", "Пошук у списку");
      this.#search.addEventListener("input", () => this.#renderOptions());
      this.#list.appendChild(this.#search);
    }
    const options = this.#document.createElement("div");
    options.className = "devtools__choice-options";
    options.setAttribute("role", "listbox");
    options.tabIndex = -1;
    if (this.#ariaLabel) options.setAttribute("aria-label", this.#ariaLabel);
    this.#list.appendChild(options);
    this.#root.appendChild(this.#list);
    this.#root.classList.add("devtools__choice--open");
    this.#button.setAttribute("aria-expanded", "true");
    this.#renderOptions();
    (this.#search || options).focus?.();
  }

  #close(restoreFocus = true) {
    if (!this.#list) return;
    this.#list.remove();
    this.#list = null;
    this.#search = null;
    this.#optionNodes = [];
    this.#visible = [];
    this.#active = -1;
    this.#root.classList.remove("devtools__choice--open");
    this.#button.setAttribute("aria-expanded", "false");
    if (restoreFocus) this.#button.focus?.();
  }

  #renderOptions() {
    const query = String(this.#search?.value || "").trim().toLowerCase();
    this.#visible = this.#options.filter((option) => !query ||
      String(option.label).toLowerCase().includes(query) || String(option.hint || option.value).toLowerCase().includes(query));
    const host = this.#list.children[this.#list.children.length - 1];
    this.#optionNodes = this.#visible.map((option) => {
      const node = this.#document.createElement("div");
      node.className = "devtools__choice-option";
      node.setAttribute("role", "option");
      const isSelected = option.value === this.#value;
      node.setAttribute("aria-selected", String(isSelected));
      if (isSelected) node.classList.add("devtools__choice-option--selected");
      if (option.imageUrl) node.appendChild(this.#createImage(option.imageUrl));
      const text = this.#document.createElement("span");
      text.className = "devtools__choice-text";
      const label = this.#document.createElement("span");
      label.className = "devtools__choice-label";
      label.textContent = option.label;
      text.appendChild(label);
      if (option.hint) {
        const hint = this.#document.createElement("span");
        hint.className = "devtools__choice-hint";
        hint.textContent = option.hint;
        text.appendChild(hint);
      }
      node.appendChild(text);
      node.addEventListener("click", () => this.#choose(option));
      return node;
    });
    if (this.#optionNodes.length === 0) {
      const empty = this.#document.createElement("div");
      empty.className = "devtools__choice-empty";
      empty.textContent = "Нічого не знайдено";
      host.replaceChildren(empty);
    } else host.replaceChildren(...this.#optionNodes);
    const selected = this.#visible.findIndex((option) => option.value === this.#value);
    this.#setActive(selected >= 0 ? selected : this.#visible.length > 0 ? 0 : -1);
  }

  #setActive(index) {
    this.#active = index;
    this.#optionNodes.forEach((node, at) => node.classList.toggle("devtools__choice-option--active", at === index));
    this.#optionNodes[index]?.scrollIntoView?.({ block: "nearest" });
  }

  #onListKey(event) {
    if (!this.#list) return;
    // The list's keys never reach the game (its arrows change the drag and move the rod).
    if (["Escape", "ArrowDown", "ArrowUp", "Enter"].includes(event.key)) event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      this.#close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const count = this.#visible.length;
      if (count > 0) this.#setActive((this.#active + (event.key === "ArrowDown" ? 1 : -1) + count) % count);
    } else if (event.key === "Enter" && event.target !== this.#button) {
      event.preventDefault();
      if (this.#visible[this.#active]) this.#choose(this.#visible[this.#active]);
    }
  }

  #choose(option) {
    const changed = option.value !== this.#value;
    this.#value = option.value;
    this.#showValue();
    this.#close();
    if (changed) this.#onCommit?.(option.value);
  }

  #createImage(url) {
    const image = this.#document.createElement("img");
    image.className = "devtools__choice-image";
    image.src = url;
    image.alt = "";
    image.draggable = false;
    image.loading = "lazy";
    return image;
  }

  #listen(target, type, listener) {
    target.addEventListener(type, listener);
    this.#disposers.push(() => target.removeEventListener(type, listener));
  }
}
