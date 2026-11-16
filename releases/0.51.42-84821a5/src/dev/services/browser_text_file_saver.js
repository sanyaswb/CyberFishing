// Saves text as a downloaded file (TK-168: the startup report as JSON from a phone): a Blob URL on a temporary hidden
// download link, clicked once and removed; the URL is released a second later so the browser can start the download.
export class BrowserTextFileSaver {
  static RELEASE_DELAY_MS = 1000;

  #documentTarget;
  #windowTarget;

  constructor({ documentTarget, windowTarget }) {
    if (typeof documentTarget?.createElement !== "function") throw new TypeError("BrowserTextFileSaver requires documentTarget");
    if (typeof windowTarget?.URL?.createObjectURL !== "function") throw new TypeError("BrowserTextFileSaver requires windowTarget");
    this.#documentTarget = documentTarget;
    this.#windowTarget = windowTarget;
  }

  save(text, fileName, type = "application/json") {
    const url = this.#windowTarget.URL.createObjectURL(new this.#windowTarget.Blob([text], { type }));
    const link = this.#documentTarget.createElement("a");
    link.href = url;
    link.download = fileName;
    link.hidden = true;
    this.#documentTarget.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
      this.#windowTarget.setTimeout(() => this.#windowTarget.URL.revokeObjectURL(url), BrowserTextFileSaver.RELEASE_DELAY_MS);
    }
  }
}
