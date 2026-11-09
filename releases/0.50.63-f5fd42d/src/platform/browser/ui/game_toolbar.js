// Screen anchoring and wrapping belong to the shared toolbar CSS. The dock anchors the toolbar to the screen
// and measures its width (container `game-toolbar`), so the action row itself can change layout by that width.
export class GameToolbar {
  #badge;
  #badgeParent;

  constructor({ documentRef, mountNode, versionBadge = null }) {
    this.dock = documentRef.createElement("div");
    this.dock.className = "game-toolbar-dock";
    this.element = documentRef.createElement("div");
    this.element.className = "game-toolbar";
    this.tackleMountNode = documentRef.createElement("div");
    this.tackleMountNode.className = "game-toolbar__tackle";
    this.selectorMountNode = documentRef.createElement("div");
    this.selectorMountNode.className = "game-toolbar__selector";
    this.depthMountNode = documentRef.createElement("div");
    this.depthMountNode.className = "game-toolbar__depth";
    this.#badge = versionBadge;
    this.#badgeParent = versionBadge?.parentNode;
    if (versionBadge) this.depthMountNode.appendChild(versionBadge);
    this.tackleMountNode.appendChild(this.depthMountNode);
    this.element.appendChild(this.tackleMountNode);
    this.element.appendChild(this.selectorMountNode);
    this.dock.appendChild(this.element);
    mountNode.appendChild(this.dock);
  }

  dispose() {
    if (!this.element) return;
    if (this.#badgeParent) this.#badgeParent.appendChild(this.#badge);
    this.element.remove();
    this.dock.remove();
    this.dock = null;
    this.element = null;
  }
}
