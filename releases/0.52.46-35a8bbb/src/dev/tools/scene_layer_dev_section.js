// DevTools "СЦЕНА WebGL" (spec 104 D5): the scene layer's state, resolution and texture memory (spec 105), the
// water's state and live settings (spec 106), the router's decision per world kind, the runtime switch between the
// WebGL scene and the 2D canvas (no reload; the startup mode comes from CONFIG.canvas.scene or dev.html?scene=), and a
// WebGL context loss and restore to test the fallback to the 2D canvas.
const STATE_LABELS = Object.freeze({
  inactive:
    "немає: режим canvas (dev.html?scene=webgl або CONFIG.canvas.scene)",
  loading: "завантаження Pixi",
  starting: "запуск WebGL",
  active: "активний",
  "context-lost": "контекст втрачено → усе на 2D",
  unavailable: "недоступний → усе на 2D",
  disposed: "закрито",
});

const ROCKING_STATES = Object.freeze({
  off: "вимкнено",
  still: "сила 0",
  active: "гойдається",
});

export class SceneLayerDevSection {
  #ui;
  #layer;
  #router;
  #floatRocking;
  #createSection;
  #renderWeather;
  #content = null;

  // scene: { layer, router } from the composition; createSection(label, parent, path) from DevTools (spec 180: the water's
  // settings moved into «ПОГОДА» → «ВОДА»).
  // renderWeather(parent): TK-291, the weather section drawn inside this one (its effects are the scene's).
  constructor({
    ui,
    scene,
    createSection,
    renderWeather = null,
  }) {
    this.#ui = ui;
    this.#layer = scene.layer;
    this.#router = scene.router;
    this.#floatRocking = scene.floatRocking ?? null;
    this.#createSection = createSection;
    this.#renderWeather = renderWeather;
  }

  render(parent) {
    this.#content = this.#createSection("СЦЕНА WebGL", parent, ["SCENE_LAYER"], { icon: "scene" });
    this.#fill();
  }

  #fill() {
    const content = this.#content;
    if (!content) return;
    content.replaceChildren();
    const status = this.#layer.getStatus();
    // TK-333.1 (owner): the scene's mode is the section's first parameter, above its state and the weather.
    if (status.state !== "inactive") {
      this.#ui.createSwitcherRow(
        "Сцена WebGL (інакше все на 2D)",
        this.#router.mode === "webgl",
        content,
        (enabled) => {
          this.#router.setMode(enabled ? "webgl" : "canvas");
          this.#fill();
        },
        ["SCENE_LAYER", "mode"],
      );
    }
    this.#ui.createInfoRow(
      "шар WebGL",
      STATE_LABELS[status.state] ?? status.state,
      content,
    );
    if (status.webglVersion != null) {
      this.#ui.createInfoRow(
        "рендерер",
        `WebGL ${status.webglVersion} · ${status.width}×${status.height} @ ${
          status.pixelRatio
        }×`,
        content,
      );
      this.#ui.createInfoRow(
        "текстури сцени",
        `${status.textures} · ${(status.textureBytes / 1048576).toFixed(1)} МБ`,
        content,
      );
    }
    if (status.water) {
      this.#ui.createInfoRow(
        "вода",
        `${status.water.active ? "анімується" : "стоїть"} · карта ${status.water.mapWidth}×${
          status.water.mapHeight
        } · крок ${status.water.stepMs.toFixed(2)} мс · течія ${(
          status.water.driftSpeed ?? 0
        ).toFixed(1)} пікс/с`,
        content,
        ["SCENE_LAYER", "water"],
      );
    }
    this.#ui.createInfoRow(
      "сцена малює кадр",
      this.#router.rendersScene() ? "так" : "ні",
      content,
    );
    // Spec 128: the float's rocking as the render model last asked for it (frames count up while a float shows).
    const rocking = this.#floatRocking?.status;
    if (rocking) {
      this.#ui.createInfoRow(
        "покачування поплавка",
        `${ROCKING_STATES[rocking.state] ?? rocking.state} · кадрів ${
          rocking.frames
        } · вгору-вниз ${rocking.dy.toFixed(1)} px · убік ${rocking.dx.toFixed(1)} px · нахил ${rocking.turnDeg.toFixed(
          1,
        )}° · сила ${rocking.strength.toFixed(2)} · лежить ${Math.round(rocking.lying * 100)}% · закид ×${rocking.landing.toFixed(
          2,
        )} · погода ×${rocking.weather.toFixed(2)} · огрузка ×${rocking.ballast.toFixed(2)} · темп ×${rocking.tempo.toFixed(
          2,
        )}`,
        content,
        ["SCENE_LAYER", "floatRocking"],
      );
    }
    for (const { kind, layer, sceneRenderer } of this.#router.getRouting()) {
      this.#ui.createInfoRow(
        kind,
        layer === "scene"
          ? "WebGL"
          : sceneRenderer
            ? "2D"
            : "2D (рендерера сцени ще немає)",
        content,
        ["SCENE_LAYER", "routing", kind],
      );
    }
    // Spec 180 D4: the weather (with the water) above; the WebGL context and «Оновити» at the very bottom, under every
    // section. TK-333: DevToolsUI puts a section's rows before its nested sections, so these rows go into a section slot
    // made after the weather (a slot stands among the sections, in the order it was made).
    this.#renderWeather?.(content);
    const bottom = this.#ui.createSectionSlot(content);
    if (status.state !== "inactive") {
      this.#ui.createButtonRow("Втратити WebGL-контекст", bottom, () => {
        this.#layer.loseContext();
        this.#fill();
      });
      this.#ui.createButtonRow("Відновити WebGL-контекст", bottom, () => {
        this.#layer.restoreContext();
        this.#fill();
      });
    }
    this.#ui.createButtonRow("↻ Оновити", bottom, () => this.#fill());
  }
}
