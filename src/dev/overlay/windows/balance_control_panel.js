// The content of a fight balance window (spec 168 D2): a form of read-only lines, action buttons and collapsible sections
// of controls (a slider with a number field and ↺ for a number, a switch for a boolean). The DOM is built once per form
// key; later renders of the same key only write changed values, and a control being dragged, focused or typed into is
// never overwritten. Changes go to onChange(path, value); buttons to onAction(id).
//
// form: { key, readouts: [{ label, value }], note, actions: [{ id, label }], sections: [section] }
// section: { id, title, rows: [row], sections: [section] }
// row: { path: [...], label, kind: "number" | "boolean", value, limits: { min, max, step }, base }
const pathKey = (path) => path.map(String).join(".");

export class BalanceControlPanel {
  #documentTarget;
  #onChange;
  #onAction;
  #sectionState;
  #root = null;
  #formKey = null;
  #bindings = new Map();
  #readouts = [];
  #note = null;

  // sectionState: { isOpen(id), setOpen(id, open) } remembers which sections are expanded.
  constructor({ documentTarget, onChange, onAction = () => {}, sectionState }) {
    this.#documentTarget = documentTarget;
    this.#onChange = onChange;
    this.#onAction = onAction;
    this.#sectionState = sectionState;
  }

  get formKey() {
    return this.#formKey;
  }

  // Renders the form into parent: a new key (another fish, rod or field set) rebuilds, the same key updates values.
  render(form, parent) {
    if (this.#root === null || this.#formKey !== form.key || this.#root.parentNode !== parent) {
      this.#build(form, parent);
      return;
    }
    form.readouts.forEach((readout, index) => {
      const cell = this.#readouts[index];
      const text = String(readout.value);
      if (cell && cell.textContent !== text) cell.textContent = text;
    });
    if (this.#note && this.#note.textContent !== (form.note ?? "")) this.#note.textContent = form.note ?? "";
    for (const row of BalanceControlPanel.rowsOf(form)) this.#bindings.get(pathKey(row.path))?.update(row);
  }

  dispose() {
    this.#root?.remove();
    this.#root = null;
    this.#formKey = null;
    this.#bindings.clear();
  }

  static rowsOf(form) {
    const rows = [];
    const collect = (section) => {
      rows.push(...section.rows);
      for (const child of section.sections ?? []) collect(child);
    };
    for (const section of form.sections) collect(section);
    return rows;
  }

  #build(form, parent) {
    this.#root?.remove();
    this.#bindings.clear();
    this.#readouts = [];
    this.#formKey = form.key;
    const root = this.#element("div", "debug-overlay__panel");
    for (const readout of form.readouts) {
      const row = this.#element("div", "debug-overlay__row");
      const value = this.#element("span", "debug-overlay__value", String(readout.value));
      row.append(this.#element("span", "debug-overlay__label", readout.label), value);
      this.#readouts.push(value);
      root.append(row);
    }
    this.#note = this.#element("div", "debug-overlay__note debug-overlay__text debug-overlay__text--muted", form.note ?? "");
    root.append(this.#note);
    if (form.actions.length > 0) {
      const actions = this.#element("div", "debug-overlay__tabs");
      for (const action of form.actions) {
        const button = this.#element("button", "debug-overlay__tab", action.label);
        button.type = "button";
        button.addEventListener("click", () => this.#onAction(action.id));
        actions.append(button);
      }
      root.append(actions);
    }
    for (const section of form.sections) root.append(this.#section(section, false));
    parent.append(root);
    this.#root = root;
  }

  #section(section, nested) {
    const details = this.#element("details", `debug-overlay__details${nested ? " debug-overlay__details--sub" : ""}`);
    details.id = `balance-${section.id}`;
    details.open = this.#sectionState.isOpen(section.id);
    details.addEventListener("toggle", () => this.#sectionState.setOpen(section.id, details.open));
    const summary = this.#element("summary", "debug-overlay__summary");
    summary.append(this.#element("span", "debug-overlay__label", section.title));
    const body = this.#element("div", "debug-overlay__details-body");
    for (const row of section.rows) body.append(this.#row(row));
    for (const child of section.sections ?? []) body.append(this.#section(child, true));
    details.append(summary, body);
    return details;
  }

  #row(row) {
    const element = this.#element("div", "debug-overlay__control-row");
    element.append(this.#element("span", "debug-overlay__control-label", row.label));
    const binding = row.kind === "boolean" ? this.#switchControl(row, element) : this.#numberControl(row, element);
    this.#bindings.set(pathKey(row.path), binding);
    return element;
  }

  #switchControl(row, element) {
    const toggle = this.#element("input", "debug-overlay__switch");
    toggle.type = "checkbox";
    toggle.checked = row.value === true;
    toggle.addEventListener("change", () => this.#onChange(row.path, toggle.checked));
    element.append(toggle);
    return { update: (next) => { if (toggle.checked !== (next.value === true)) toggle.checked = next.value === true; } };
  }

  #numberControl(row, element) {
    const slider = this.#element("input", "debug-overlay__slider");
    slider.type = "range";
    const number = this.#element("input", "debug-overlay__number");
    number.type = "number";
    let editing = false;
    const setLimits = (limits) => {
      for (const name of ["min", "max", "step"]) {
        const text = String(limits[name]);
        if (slider.getAttribute(name) !== text) slider.setAttribute(name, text);
      }
      if (number.getAttribute("step") !== String(limits.step)) number.setAttribute("step", String(limits.step));
    };
    const show = (value) => {
      const text = Number.isFinite(value) ? String(Math.round(value * 1e6) / 1e6) : "";
      if (slider.value !== text) slider.value = text;
      if (number.value !== text) number.value = text;
    };
    setLimits(row.limits);
    show(Number(row.value));
    const send = (value) => {
      if (!Number.isFinite(value)) return;
      show(value);
      this.#onChange(row.path, value);
    };
    slider.addEventListener("pointerdown", () => { editing = true; });
    slider.addEventListener("pointerup", () => { editing = false; });
    slider.addEventListener("pointercancel", () => { editing = false; });
    slider.addEventListener("input", () => send(Number(slider.value)));
    number.addEventListener("focus", () => { editing = true; });
    number.addEventListener("blur", () => { editing = false; });
    number.addEventListener("change", () => send(Number(number.value)));
    element.append(slider, number);
    if (Number.isFinite(Number(row.base))) {
      const reset = this.#element("button", "debug-overlay__reset", "↺");
      reset.type = "button";
      reset.title = `Базове: ${row.base}`;
      reset.addEventListener("click", () => send(Number(row.base)));
      element.append(reset);
    }
    return {
      update: (next) => {
        if (editing) return;
        setLimits(next.limits);
        show(Number(next.value));
      },
    };
  }

  #element(tag, className, text = null) {
    const element = this.#documentTarget.createElement(tag);
    element.className = className;
    if (text !== null) element.textContent = text;
    return element;
  }
}
