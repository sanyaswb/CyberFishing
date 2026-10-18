// Short texts the scene draws as sprites (spec 107 D2): the bait boats' emoji and their waypoint numbers. Pixi's text
// classes are not in the bundle, so each distinct (text, font, colour) is drawn once into a small canvas and becomes a
// texture, shared by every sprite that shows it and released with the scene. Fonts are rounded to whole pixels at the
// scene's pixel ratio, so a boat's perspective scale reuses a few sizes instead of making one texture per frame.
export class SceneTextTextures {
  #pixi;
  #documentTarget;
  #entries = new Map();

  constructor({ pixi, documentTarget }) {
    if (typeof pixi?.Texture?.from !== "function") throw new TypeError("SceneTextTextures requires the Pixi namespace");
    if (typeof documentTarget?.createElement !== "function") throw new TypeError("SceneTextTextures requires documentTarget");
    this.#pixi = pixi;
    this.#documentTarget = documentTarget;
  }

  get size() {
    return this.#entries.size;
  }

  // fontPx: the logical font size; pixelRatio: the scene's backing pixels per logical pixel. Returns the texture and
  // the logical size it should be drawn at ({ texture, width, height }), centred on the text's middle.
  get(text, fontPx, pixelRatio, { family = "sans-serif", weight = "", color = "#ffffff" } = {}) {
    const ratio = pixelRatio > 0 ? pixelRatio : 1;
    const devicePx = Math.max(1, Math.round(fontPx * ratio));
    const key = `${weight}|${devicePx}|${family}|${color}|${text}`;
    let entry = this.#entries.get(key);
    if (!entry) {
      entry = this.#create(text, devicePx, `${weight ? `${weight} ` : ""}${devicePx}px ${family}`, color);
      this.#entries.set(key, entry);
    }
    entry.width = entry.pixelWidth / ratio;
    entry.height = entry.pixelHeight / ratio;
    return entry;
  }

  dispose() {
    for (const entry of this.#entries.values()) entry.texture.destroy(true);
    this.#entries.clear();
  }

  #create(text, devicePx, font, color) {
    const canvas = this.#documentTarget.createElement("canvas");
    const context = canvas.getContext("2d");
    context.font = font;
    const padding = Math.ceil(devicePx * 0.25);
    const width = Math.max(1, Math.ceil(context.measureText(text).width) + padding * 2);
    const height = Math.max(1, Math.ceil(devicePx * 1.4) + padding * 2);
    canvas.width = width;
    canvas.height = height;
    context.font = font;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = color;
    context.fillText(text, width / 2, height / 2);
    return { texture: this.#pixi.Texture.from(canvas, true), pixelWidth: width, pixelHeight: height, width: 0, height: 0 };
  }
}
