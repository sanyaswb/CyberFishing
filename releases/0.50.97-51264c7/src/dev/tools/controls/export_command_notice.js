const SVG_NS = "http://www.w3.org/2000/svg";
const COPIED_MS = 2000;

// The notice DevTools shows at the top of a section after a file export (spec 174 A5, TK-285): the downloaded file, the
// terminal command that applies it and a button that copies the command. The section that exported the file builds
// the command; this control only shows and copies it.
// copyText(text) returns a promise (the clipboard); when it is missing or refuses, the command is selected instead, so
// it can be copied by hand. onClose() is called when the notice is closed with its button.
export class ExportCommandNotice {
  #document;
  #root;
  #command;
  #commandNode;
  #copyButton;
  #status;
  #copyText;
  #scheduler;
  #copiedTimer = null;
  #disposers = [];

  constructor({ fileName, command, copyText = null, onClose = null, documentRef = document,
    scheduler = { setTimeout: (callback, ms) => setTimeout(callback, ms), clearTimeout: (id) => clearTimeout(id) } }) {
    this.#document = documentRef;
    this.#command = String(command);
    this.#copyText = copyText;
    this.#scheduler = scheduler;

    this.#root = documentRef.createElement("div");
    this.#root.className = "devtools__export";
    this.#root.setAttribute("role", "status");

    const title = documentRef.createElement("div");
    title.className = "devtools__export-title";
    title.textContent = `Файл завантажено: ${fileName}`;
    const close = documentRef.createElement("button");
    close.type = "button";
    close.className = "devtools__export-close";
    close.setAttribute("aria-label", "Закрити");
    close.appendChild(this.#icon(["M5 5l10 10", "M15 5L5 15"]));
    this.#listen(close, "click", () => { this.dispose(); onClose?.(); });

    const hint = documentRef.createElement("div");
    hint.className = "devtools__export-hint";
    hint.textContent = "Команда для термінала в теці проєкту:";

    this.#commandNode = documentRef.createElement("code");
    this.#commandNode.className = "devtools__export-command";
    this.#commandNode.textContent = this.#command;
    this.#copyButton = documentRef.createElement("button");
    this.#copyButton.type = "button";
    this.#copyButton.className = "devtools__export-copy";
    this.#copyButton.setAttribute("aria-label", "Копіювати команду");
    // Two sheets: the copy icon.
    this.#copyButton.appendChild(this.#icon(["M8 7h7a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z",
      "M4 13V5a1 1 0 0 1 1-1h7"]));
    this.#listen(this.#copyButton, "click", () => { void this.#copy(); });

    this.#status = documentRef.createElement("div");
    this.#status.className = "devtools__export-status";
    this.#status.setAttribute("aria-live", "polite");

    const head = documentRef.createElement("div");
    head.className = "devtools__export-head";
    head.append(title, close);
    const line = documentRef.createElement("div");
    line.className = "devtools__export-line";
    line.append(this.#commandNode, this.#copyButton);
    this.#root.append(head, hint, line, this.#status);
  }

  get element() {
    return this.#root;
  }

  dispose() {
    if (this.#copiedTimer !== null) this.#scheduler.clearTimeout(this.#copiedTimer);
    this.#copiedTimer = null;
    for (const dispose of this.#disposers) dispose();
    this.#disposers.length = 0;
    this.#root.remove();
  }

  async #copy() {
    let copied = false;
    try {
      if (this.#copyText) { await this.#copyText(this.#command); copied = true; }
    } catch { copied = false; }
    if (!copied) this.#selectCommand();
    this.#showStatus(copied ? "Скопійовано" : "Буфер обміну недоступний: команду виділено, скопіюйте її вручну", copied);
  }

  // Without a clipboard (a page opened over http on the local network) the command is selected for Ctrl+C.
  #selectCommand() {
    const selection = this.#document.defaultView?.getSelection?.();
    if (!selection || typeof this.#document.createRange !== "function") return;
    const range = this.#document.createRange();
    range.selectNodeContents(this.#commandNode);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  #showStatus(text, copied) {
    this.#status.textContent = text;
    this.#root.classList.toggle("devtools__export--copied", copied);
    if (this.#copiedTimer !== null) this.#scheduler.clearTimeout(this.#copiedTimer);
    this.#copiedTimer = this.#scheduler.setTimeout(() => {
      this.#copiedTimer = null;
      this.#status.textContent = "";
      this.#root.classList.remove("devtools__export--copied");
    }, COPIED_MS);
  }

  // An outline icon on a 20 x 20 grid in the text colour (the DevTools icon sprite of stage C1 replaces these paths).
  #icon(paths) {
    const svg = this.#document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "devtools__export-icon");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("aria-hidden", "true");
    for (const d of paths) {
      const path = this.#document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      svg.appendChild(path);
    }
    return svg;
  }

  #listen(target, type, listener) {
    target.addEventListener(type, listener);
    this.#disposers.push(() => target.removeEventListener(type, listener));
  }
}
