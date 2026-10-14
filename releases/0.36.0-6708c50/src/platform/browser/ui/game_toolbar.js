// A single screen-anchored row lets the version label shrink beside visible actions.
export class GameToolbar {
  #badge;
  #badgeParent;

  constructor({ documentRef, mountNode, versionBadge = null }) {
    this.element = documentRef.createElement("div");
    this.element.className = "game-toolbar";
    this.#badge = versionBadge;
    this.#badgeParent = versionBadge?.parentNode;
    if (versionBadge) this.element.appendChild(versionBadge);
    mountNode.appendChild(this.element);
  }

  dispose() {
    if (!this.element) return;
    if (this.#badgeParent) this.#badgeParent.appendChild(this.#badge);
    this.element.remove();
    this.element = null;
  }
}
