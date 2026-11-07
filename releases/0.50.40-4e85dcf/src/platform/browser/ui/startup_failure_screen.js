// The startup screen when the start has failed (spec 157 R3): the page's startup screen stops its ring and bar and shows
// the error text with a retry button, instead of loading forever. Retry reloads the page: the browser keeps a failed
// module fetch for the page's lifetime, so nothing short of a reload can load it again. The look is the page's inline
// style (it must work when every other file failed): data-startup-failed hides the ring and the bar.
export class StartupFailureScreen {
  #document;
  #reload;
  #labels;
  #shown = false;

  // labels: { failed, retry } (STARTUP_LABELS); reload(): reloads the page.
  constructor({ documentRef, reload, labels }) {
    this.#document = documentRef;
    this.#reload = reload;
    this.#labels = labels;
  }

  // Returns whether the screen now shows the failure: not after the game became ready, and only once.
  show() {
    if (this.#shown) return true;
    const loader = this.#document.querySelector(".startup-loader");
    if (!loader || this.#document.documentElement.hasAttribute("data-game-ready")) return false;
    this.#shown = true;
    loader.setAttribute("data-startup-failed", "");
    loader.setAttribute("role", "alert");
    loader.setAttribute("aria-label", this.#labels.failed);
    const message = this.#document.createElement("p");
    message.className = "startup-loader__error";
    message.textContent = this.#labels.failed;
    const retry = this.#document.createElement("button");
    retry.className = "startup-loader__retry";
    retry.type = "button";
    retry.textContent = this.#labels.retry;
    retry.addEventListener("click", () => this.#reload());
    loader.append(message, retry);
    return true;
  }
}

let screen = null;

// One failure screen per page, over the browser's document and location.
export function showBrowserStartupFailure(labels) {
  screen ??= new StartupFailureScreen({ documentRef: document, reload: () => location.reload(), labels });
  return screen.show();
}
