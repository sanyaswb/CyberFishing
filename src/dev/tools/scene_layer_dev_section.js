// DevTools "🖼️ СЦЕНА WebGL" (spec 104 D5): the scene layer's state, the router's decision per world kind, the runtime
// switch between the WebGL scene and the 2D canvas (no reload; the startup mode comes from CONFIG.canvas.scene or
// dev.html?scene=), and a WebGL context loss and restore to test the fallback to the 2D canvas.
const STATE_LABELS = Object.freeze({
  inactive: "немає: режим canvas (dev.html?scene=webgl або CONFIG.canvas.scene)",
  loading: "завантаження Pixi",
  starting: "запуск WebGL",
  active: "активний",
  "context-lost": "контекст втрачено → усе на 2D",
  unavailable: "недоступний → усе на 2D",
  disposed: "закрито",
});

export class SceneLayerDevSection {
  #ui;
  #layer;
  #router;
  #createSection;
  #content = null;

  // scene: { layer, router } from the composition; createSection(label, parent, path) from DevTools.
  constructor({ ui, scene, createSection }) {
    this.#ui = ui;
    this.#layer = scene.layer;
    this.#router = scene.router;
    this.#createSection = createSection;
  }

  render(parent) {
    this.#content = this.#createSection("🖼️ СЦЕНА WebGL", parent, ["SCENE_LAYER"]);
    this.#fill();
  }

  #fill() {
    const content = this.#content;
    if (!content) return;
    content.replaceChildren();
    const status = this.#layer.getStatus();
    this.#ui.createInfoRow("шар WebGL", STATE_LABELS[status.state] ?? status.state, content);
    if (status.webglVersion != null) {
      this.#ui.createInfoRow("рендерер", `WebGL ${status.webglVersion} · ${status.width}×${status.height} @ ${
        status.pixelRatio}×`, content);
    }
    this.#ui.createInfoRow("сцена малює кадр", this.#router.rendersScene() ? "так" : "ні", content);
    for (const { kind, layer, sceneRenderer } of this.#router.getRouting()) {
      this.#ui.createInfoRow(kind, layer === "scene" ? "WebGL" : sceneRenderer ? "2D" : "2D (рендерера сцени ще немає)",
        content, ["SCENE_LAYER", "routing", kind]);
    }
    if (status.state !== "inactive") {
      this.#ui.createSwitcherRow("Сцена WebGL (інакше все на 2D)", this.#router.mode === "webgl", content, (enabled) => {
        this.#router.setMode(enabled ? "webgl" : "canvas");
        this.#fill();
      }, ["SCENE_LAYER", "mode"]);
      this.#ui.createButtonRow("Втратити WebGL-контекст", content, () => {
        this.#layer.loseContext();
        this.#fill();
      });
      this.#ui.createButtonRow("Відновити WebGL-контекст", content, () => {
        this.#layer.restoreContext();
        this.#fill();
      });
    }
    this.#ui.createButtonRow("↻ Оновити", content, () => this.#fill());
  }
}
