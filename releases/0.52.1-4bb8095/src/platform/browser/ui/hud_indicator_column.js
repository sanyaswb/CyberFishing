// Spec 181 D3: the column of round HUD indicators under the clock — the radio (informational) first, then the player's
// statuses in the order they started. It only places them; each indicator owns its look (hud-indicator.css).
export class HudIndicatorColumn {
  #element;

  constructor({ documentRef, mountNode }) {
    const element = documentRef.createElement("div");
    element.className = "hud-indicators";
    mountNode.appendChild(element);
    this.#element = element;
  }

  get element() {
    return this.#element;
  }

  dispose() {
    this.#element?.remove();
    this.#element = null;
  }
}
