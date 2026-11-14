export class DevToolsDependencyFeedback {
  #scheduler;
  #durationMs;
  #timer = null;
  #path = "";
  #rows = [];
  #source = null;
  #revealTimer = null;
  #revealedTargets = [];

  constructor({ scheduler, durationMs }) {
    this.#scheduler = scheduler;
    this.#durationMs = durationMs;
  }

  show(path, rows, source = null) {
    this.#clearBlocked();
    this.#path = path.join(".");
    this.#rows = rows;
    this.#source = source;
    for (const row of rows) {
      this.#expandAncestorSections(row);
      row.classList.add("devtools__row--blocked-prerequisite");
      row.setAttribute("aria-invalid", "true");
    }
    rows[0]?.scrollIntoView?.({ block: "nearest" });
    if (rows.length) this.#timer = this.#scheduler.setTimeout(() => this.#clearBlocked(), this.#durationMs);
  }

  // Spec 177 (TK-296): expand collapsed ancestors, scroll into view and highlight revealed rows in green.
  showRevealed(rows = []) {
    this.clearRevealed();
    const list = Array.isArray(rows) ? rows.filter(Boolean) : [rows].filter(Boolean);
    if (!list.length) return;
    for (const row of list) {
      this.#expandAncestorSections(row);
      const highlightTarget = row.classList?.contains("devtools__section")
        ? row.children?.[0] || row
        : row;
      highlightTarget.classList?.add("devtools__row--revealed");
      this.#revealedTargets.push(highlightTarget);
    }
    list[0]?.scrollIntoView?.({ block: "center" });
    this.#revealTimer = this.#scheduler.setTimeout(() => this.clearRevealed(), this.#durationMs);
  }

  resolve(path) {
    if (path.join(".") === this.#path) this.#clearBlocked();
  }

  releaseWithin(container) {
    if ((this.#source && container.contains(this.#source)) || this.#rows.some(row => container.contains(row))) {
      this.#clearBlocked();
    }
    if (this.#revealedTargets.some(target => container.contains(target))) this.clearRevealed();
  }

  clearRevealed() {
    if (this.#revealTimer !== null) this.#scheduler.clearTimeout(this.#revealTimer);
    this.#revealTimer = null;
    for (const target of this.#revealedTargets) {
      target.classList?.remove("devtools__row--revealed");
    }
    this.#revealedTargets = [];
  }

  clear() {
    this.#clearBlocked();
    this.clearRevealed();
  }

  dispose() { this.clear(); }

  #clearBlocked() {
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

  #expandAncestorSections(row) {
    if (row.classList?.contains("devtools__section")) {
      const content = row.children?.[1];
      if (content?.classList?.contains("devtools__section-content") && content.style.display === "none") {
        row.children?.[0]?.click?.();
      }
    }
    for (let parent = row.parentNode; parent; parent = parent.parentNode) {
      if (parent.classList?.contains("devtools__section-content") && parent.style.display === "none") {
        parent.parentNode?.children?.[0]?.click?.();
      }
    }
  }
}
