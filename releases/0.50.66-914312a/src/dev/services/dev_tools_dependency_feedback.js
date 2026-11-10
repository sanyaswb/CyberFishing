export class DevToolsDependencyFeedback {
  #scheduler;
  #durationMs;
  #timer = null;
  #path = "";
  #rows = [];
  #source = null;

  constructor({ scheduler, durationMs }) {
    this.#scheduler = scheduler;
    this.#durationMs = durationMs;
  }

  show(path, rows, source = null) {
    this.clear();
    this.#path = path.join(".");
    this.#rows = rows;
    this.#source = source;
    for (const row of rows) {
      for (let parent = row.parentNode; parent; parent = parent.parentNode) {
        if (parent.classList?.contains("devtools__section-content") && parent.style.display === "none") {
          parent.parentNode.children[0].click();
        }
      }
      row.classList.add("devtools__row--blocked-prerequisite");
      row.setAttribute("aria-invalid", "true");
    }
    rows[0]?.scrollIntoView?.({ block: "nearest" });
    if (rows.length) this.#timer = this.#scheduler.setTimeout(() => this.clear(), this.#durationMs);
  }

  resolve(path) {
    if (path.join(".") === this.#path) this.clear();
  }

  releaseWithin(container) {
    if ((this.#source && container.contains(this.#source)) || this.#rows.some(row => container.contains(row))) this.clear();
  }

  clear() {
    if (this.#timer !== null) this.#scheduler.clearTimeout(this.#timer);
    this.#timer = null;
    for (const row of this.#rows) {
      row.classList.remove("devtools__row--blocked-prerequisite");
      row.removeAttribute("aria-invalid");
    }
    this.#rows = [];
    this.#source = null;
    this.#path = "";
  }

  dispose() { this.clear(); }
}
