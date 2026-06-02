class GameVersionBadge {
  constructor({
    element = null,
    versionConfig = typeof PROJECT_VERSION_CONFIG !== "undefined"
      ? PROJECT_VERSION_CONFIG
      : null,
  } = {}) {
    this.element = element;
    this.versionConfig = versionConfig;
  }

  render() {
    if (!this.element || !this.versionConfig) return;
    const label = this.versionConfig.label || `v${this.versionConfig.version || "unknown"}`;
    const channel = this.versionConfig.channel ? ` ${this.versionConfig.channel}` : "";
    this.element.textContent = `${label}${channel}`;
    this.element.title = [
      this.versionConfig.name || "CyberFishing",
      this.versionConfig.codename || "",
      this.versionConfig.updatedAt || "",
    ]
      .filter(Boolean)
      .join(" · ");
    this.element.dataset.version = this.versionConfig.version || "unknown";
  }

  static mountById(id = "gameVersionBadge") {
    const badge = new GameVersionBadge({ element: document.getElementById(id) });
    badge.render();
    return badge;
  }
}

(function mountGameVersionBadge() {
  if (typeof document === "undefined") return;
  const mount = () => GameVersionBadge.mountById();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
