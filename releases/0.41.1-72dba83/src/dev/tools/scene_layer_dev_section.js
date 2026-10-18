// DevTools "🖼️ СЦЕНА WebGL" (spec 104 D5): the scene layer's state, resolution and texture memory (spec 105), the
// water's state and live settings (spec 106), the router's decision per world kind, the runtime switch between the
// WebGL scene and the 2D canvas (no reload; the startup mode comes from CONFIG.canvas.scene or dev.html?scene=), and a
// WebGL context loss and restore to test the fallback to the 2D canvas.
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
  #renderWaterConfig;
  #content = null;

  // scene: { layer, router } from the composition; createSection(label, parent, path) and renderWaterConfig(parent)
  // (the live editor of CONFIG.canvas.water) from DevTools.
  constructor({ ui, scene, createSection, renderWaterConfig }) {
    this.#ui = ui;
    this.#layer = scene.layer;
    this.#router = scene.router;
    this.#createSection = createSection;
    this.#renderWaterConfig = renderWaterConfig;
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
      this.#ui.createInfoRow("текстури сцени", `${status.textures} · ${(status.textureBytes / 1048576).toFixed(1)} МБ`,
        content);
    }
    if (status.water) {
      this.#ui.createInfoRow("вода", `${status.water.active ? "анімується" : "стоїть"} · карта ${status.water.mapWidth}×${
        status.water.mapHeight} · крок ${status.water.stepMs.toFixed(2)} мс · течія ${
        (status.water.driftSpeed ?? 0).toFixed(1)} пікс/с`, content, ["SCENE_LAYER", "water"]);
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
    this.#renderWaterConfig?.(this.#createSection("Брижі на воді (CONFIG.canvas.water)", content,
      ["SCENE_LAYER", "waterConfig"]));
  }
}
