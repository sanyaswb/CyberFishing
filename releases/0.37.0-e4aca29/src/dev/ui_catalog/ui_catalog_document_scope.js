// Production views receive a document-shaped port scoped to one preview.
// Creation and focus remain native; document listeners are owned and released here.
export class UiCatalogDocumentScope {
  #document;
  #listeners = [];
  constructor({ documentRef, root, windowTarget }) {
    this.#document = documentRef;
    this.body = root;
    this.defaultView = windowTarget;
    this.documentElement = root;
  }
  get activeElement() { return this.#document.activeElement; }
  get fullscreenElement() { return null; }
  createElement(tag) { return this.#document.createElement(tag); }
  createElementNS(namespace, tag) { return this.#document.createElementNS(namespace, tag); }
  querySelector(selector) { return this.body.querySelector(selector); }
  querySelectorAll(selector) { return this.body.querySelectorAll(selector); }
  getElementById(id) { return this.body.querySelector(`[id="${id}"]`); }
  addEventListener(type, listener, options) {
    this.#listeners.push({ type, listener, options });
    this.#document.addEventListener(type, listener, options);
  }
  removeEventListener(type, listener, options) {
    this.#document.removeEventListener(type, listener, options);
    this.#listeners = this.#listeners.filter((binding) => binding.type !== type || binding.listener !== listener);
  }
  dispose() {
    for (const { type, listener, options } of this.#listeners) this.#document.removeEventListener(type, listener, options);
    this.#listeners = [];
  }
}
