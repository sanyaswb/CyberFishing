// The browser side of the location editor's "Збереження" (spec 130): a file download, a file pick, a confirmation,
// reopening the DEV page on another location (?location=<id>) and SHA-256 through Web Crypto.
export class ZoneEditorBrowserPort {
  #window;
  #document;

  constructor({ windowTarget, documentTarget }) {
    if (!windowTarget || !documentTarget) throw new TypeError("ZoneEditorBrowserPort requires window and document");
    this.#window = windowTarget;
    this.#document = documentTarget;
  }

  download(fileName, text) {
    const url = this.#window.URL.createObjectURL(new this.#window.Blob([text], { type: "application/json" }));
    const link = this.#document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.hidden = true;
    this.#document.body.appendChild(link);
    link.click();
    link.remove();
    // The download has started from the URL by now; the next turn may release it.
    this.#window.setTimeout(() => this.#window.URL.revokeObjectURL(url), 0);
  }

  // The chosen file's text, or null when the pick is cancelled or unreadable.
  pickFile() {
    return new Promise((resolve) => {
      const input = this.#document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        file.text().then(resolve, () => resolve(null));
      }, { once: true });
      input.addEventListener("cancel", () => resolve(null), { once: true });
      input.click();
    });
  }

  confirm(message) {
    return this.#window.confirm(message) === true;
  }

  // Reloads the DEV page with ?location=<id>; the DEV startup loads that location (spec 130 D2).
  openLocation(id) {
    const url = new this.#window.URL(this.#window.location.href);
    url.searchParams.set("location", id);
    this.#window.location.assign(url.toString());
  }

  async hashText(text) {
    const bytes = new this.#window.TextEncoder().encode(text);
    const digest = await this.#window.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }
}
