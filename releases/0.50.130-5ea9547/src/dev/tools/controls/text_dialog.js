import { createDevIcon } from "./dev_icon.js";

// DevTools' text dialog (spec 174 C5) in place of the browser's prompt/alert: a title, a multi-line text (read-only for
// an export, editable for an import or an edit), action buttons and a message line for the result. It lies over the
// panel only, so the game stays visible; Escape or the cross closes it.
//   actions: [{ label, icon?, primary?, run(dialog) }] — run may set a message or close the dialog.
export class TextDialog {
  #document;
  #root;
  #textarea;
  #message;
  #onClose;
  #disposers = [];

  constructor({ title, text = "", readOnly = false, actions = [], onClose = null, documentRef = document }) {
    this.#document = documentRef;
    this.#onClose = onClose;
    this.#root = documentRef.createElement("div");
    this.#root.className = "devtools__dialog-layer";
    const dialog = documentRef.createElement("div");
    dialog.className = "devtools__dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-label", title);

    const head = documentRef.createElement("div");
    head.className = "devtools__dialog-head";
    const heading = documentRef.createElement("div");
    heading.className = "devtools__dialog-title";
    heading.textContent = title;
    const close = documentRef.createElement("button");
    close.type = "button";
    close.className = "devtools__dialog-close";
    close.setAttribute("aria-label", "Закрити");
    close.appendChild(createDevIcon(documentRef, "close"));
    this.#listen(close, "click", () => this.close());
    head.append(heading, close);

    this.#textarea = documentRef.createElement("textarea");
    this.#textarea.className = "devtools__dialog-text";
    this.#textarea.spellcheck = false;
    this.#textarea.readOnly = readOnly;
    this.#textarea.value = text;
    this.#textarea.setAttribute("aria-label", title);

    this.#message = documentRef.createElement("div");
    this.#message.className = "devtools__dialog-message";
    this.#message.setAttribute("role", "status");
    this.#message.hidden = true;

    const buttons = documentRef.createElement("div");
    buttons.className = "devtools__dialog-actions";
    for (const action of actions) {
      const button = documentRef.createElement("button");
      button.type = "button";
      button.className = action.primary ? "devtools__dialog-action devtools__dialog-action--primary" : "devtools__dialog-action";
      if (action.icon) button.appendChild(createDevIcon(documentRef, action.icon));
      const label = documentRef.createElement("span");
      label.textContent = action.label;
      button.appendChild(label);
      this.#listen(button, "click", () => { void action.run(this); });
      buttons.appendChild(button);
    }
    dialog.append(head, this.#textarea, this.#message, buttons);
    this.#root.appendChild(dialog);
    this.#listen(this.#root, "keydown", (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      this.close();
    });
  }

  get element() {
    return this.#root;
  }

  get value() {
    return this.#textarea.value;
  }

  setValue(text) {
    this.#textarea.value = text;
  }

  focus() {
    this.#textarea.focus?.();
    if (this.#textarea.readOnly) this.#textarea.select?.();
  }

  // The result of an action in the dialog itself (an error stays until the next action).
  setMessage(text, { error = false } = {}) {
    this.#message.hidden = !text;
    this.#message.textContent = text;
    this.#message.classList.toggle("devtools__dialog-message--error", error);
  }

  close() {
    if (!this.#root.parentNode) return;
    this.#root.remove();
    for (const dispose of this.#disposers) dispose();
    this.#disposers.length = 0;
    const onClose = this.#onClose;
    this.#onClose = null;
    onClose?.();
  }

  #listen(target, type, listener) {
    target.addEventListener(type, listener);
    this.#disposers.push(() => target.removeEventListener(type, listener));
  }
}
