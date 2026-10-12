export const EMBEDDED_PAGE_RETURN_MESSAGE = "cyber-fishing:close-embedded-page";

export class EmbeddedPageOverlay {
  #document;
  #window;
  #src;
  #title;
  #onEnter;
  #onExit;
  #frame = null;
  #disposed = false;

  constructor({ documentRef, windowTarget, src, title, onEnter, onExit }) {
    this.#document = documentRef;
    this.#window = windowTarget;
    this.#src = src;
    this.#title = title;
    this.#onEnter = onEnter;
    this.#onExit = onExit;
    windowTarget.addEventListener("message", this.#handleMessage);
  }

  open() {
    if (this.#disposed || this.#frame) return;
    const frame = this.#document.createElement("iframe");
    frame.className = "embedded-page-overlay";
    frame.title = this.#title;
    frame.allowFullscreen = true;
    frame.src = this.#src;
    this.#onEnter?.();
    this.#frame = frame;
    this.#document.body.appendChild(frame);
  }

  close() {
    if (!this.#frame) return;
    this.#frame.remove();
    this.#frame = null;
    this.#onExit?.();
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#window.removeEventListener("message", this.#handleMessage);
    this.#frame?.remove();
    this.#frame = null;
  }

  #handleMessage = (event) => {
    if (!this.#frame || event.source !== this.#frame.contentWindow ||
      event.origin !== this.#window.location.origin ||
      event.data?.type !== EMBEDDED_PAGE_RETURN_MESSAGE) return;
    this.close();
  };
}
