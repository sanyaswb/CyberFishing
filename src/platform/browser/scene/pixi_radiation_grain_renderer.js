// Spec 179 stage D (TK-338): the radiation's hiss on the WebGL scene — fine flickering grain over the world, stronger as
// the location's radiation grows (world.weather.radiation), nothing below CONFIG.canvas.radiationGrain.fromRadiation.
// - One noise tile (TILE × TILE grey specks with their own alpha) is generated once in code — not an image file — and
//   cut into FRAME × FRAME frames (sub-textures made once); a grid of sprites covers the screen, the grid grows only when
//   the screen does.
// - Each grain step (fps a second) the grid jumps by a random offset and every cell takes a random frame and flip, so
//   the grain never stands still and never repeats in a visible rhythm; between steps nothing changes, no frame is asked.
// - TK-338.1 (owner: «більше шипіння по краях і менше по середині … щоб я міг зовсім прибрати до рівномірного»): like
//   the emission's vignette, each cell's alpha at a step follows its distance from the screen's centre (a share of the
//   half-diagonal): centerShare inside clearRadius, rising over feather to 1 at the edges; centerShare 1 — even grain.
//   Small cells (FRAME × grainPx) and the jump every step hide the cells' borders.
// Drawing (docs/rendering.md 16, 22, 23): one texture, no filter, no per-frame texture or allocation; nearest sampling
// keeps the specks crisp at grainPx logical pixels each. The container is hidden (and the scene idle) at zero.
const TILE = 128;
const FRAME = 32;

const clamp01 = (value) => (value <= 0 ? 0 : value >= 1 ? 1 : value);
const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const smooth = (share) => share * share * (3 - 2 * share);

export class PixiRadiationGrainRenderer {
  #pixi;
  #random;
  #texture;
  #frames = [];
  #container;
  #viewWidth = 0;
  #viewHeight = 0;
  #edges = null;
  #cells = [];
  #nextStepMs = null;
  #alpha = 0;
  #visible = false;
  #columns = 0;
  #rows = 0;

  // documentTarget: makes the tile's canvas; random: () => 0…1 (the tile's specks and the jumps; visual only).
  constructor({ pixi, documentTarget, random = Math.random }) {
    if (typeof pixi?.Sprite !== "function" || typeof pixi?.Container !== "function") {
      throw new TypeError("PixiRadiationGrainRenderer requires pixi.Sprite and pixi.Container");
    }
    if (typeof random !== "function") throw new TypeError("PixiRadiationGrainRenderer requires random");
    this.#pixi = pixi;
    this.#random = random;
    this.#texture = pixi.Texture.from(PixiRadiationGrainRenderer.#drawNoise(documentTarget, random), true);
    if (this.#texture.source) this.#texture.source.scaleMode = "nearest";
    for (let y = 0; y < TILE; y += FRAME) {
      for (let x = 0; x < TILE; x += FRAME) {
        this.#frames.push(new pixi.Texture({ source: this.#texture.source, frame: new pixi.Rectangle(x, y, FRAME, FRAME) }));
      }
    }
    this.#container = new pixi.Container();
    this.#container.visible = false;
  }

  // In front of the whole world (mounted after the ash): the hiss lies over everything the scene draws.
  mount(stage) {
    stage.addChild(this.#container);
  }

  get status() {
    return { active: this.#visible, opacity: this.#alpha, cells: this.#cells.length };
  }

  // world: the frame's world model (null: not on the scene); viewWidth / viewHeight: the logical screen; nowMs: the
  // frame's clock; settings: CONFIG.canvas.radiationGrain. Returns whether the scene must present a frame.
  update(world, viewWidth, viewHeight, nowMs, settings) {
    if (!world || settings?.enabled !== true) return this.#hide();
    const from = clamp01(number(settings.fromRadiation, 0));
    const radiation = clamp01(number(world.weather?.radiation, 0));
    const share = radiation <= from ? 0 : clamp01((radiation - from) / Math.max(1e-6, 1 - from));
    const alpha = clamp01(number(settings.maxOpacity, 0)) * smooth(share);
    if (alpha <= 0.001) return this.#hide();
    const grainPx = Math.max(1, number(settings.grainPx, 2));
    const cellSize = FRAME * grainPx;
    this.#ensureGrid(Math.ceil(viewWidth / cellSize) + 1, Math.ceil(viewHeight / cellSize) + 1);
    let changed = !this.#visible || alpha !== this.#alpha;
    this.#container.visible = true;
    this.#visible = true;
    this.#alpha = alpha;
    this.#container.alpha = alpha;
    const stepMs = 1000 / Math.max(1, number(settings.fps, 24));
    // The grain jumps at its own pace only; an opacity change alone redraws the same grain.
    if (this.#nextStepMs === null || nowMs >= this.#nextStepMs) {
      this.#nextStepMs = nowMs + stepMs;
      this.#viewWidth = viewWidth;
      this.#viewHeight = viewHeight;
      this.#edges = settings.edges ?? null;
      this.#jump(cellSize, grainPx);
      changed = true;
    }
    return changed;
  }

  dispose() {
    for (const frame of this.#frames) frame.destroy(false);
    this.#texture.destroy(true);
  }

  #hide() {
    const was = this.#visible;
    this.#visible = false;
    this.#alpha = 0;
    this.#nextStepMs = null;
    this.#container.visible = false;
    return was;
  }

  // Cells only for a larger screen; a smaller one hides the extra cells.
  #ensureGrid(columns, rows) {
    while (this.#cells.length < columns * rows) {
      const sprite = new this.#pixi.Sprite(this.#frames[0]);
      sprite.anchor.set(0.5, 0.5);
      this.#container.addChild(sprite);
      this.#cells.push(sprite);
    }
    this.#columns = columns;
    this.#rows = rows;
    for (let index = 0; index < this.#cells.length; index += 1) this.#cells[index].visible = index < columns * rows;
  }

  // The whole grid moves by up to one cell, each cell takes a random frame and flip and its edge alpha: new grain, no
  // allocation.
  #jump(cellSize, grainPx) {
    const offsetX = -this.#random() * cellSize;
    const offsetY = -this.#random() * cellSize;
    const centerX = this.#viewWidth / 2;
    const centerY = this.#viewHeight / 2;
    const halfDiagonal = Math.max(1, Math.hypot(centerX, centerY));
    const centerShare = clamp01(number(this.#edges?.centerShare, 1));
    const clearRadius = clamp01(number(this.#edges?.clearRadius, 0));
    const feather = Math.max(0.01, number(this.#edges?.feather, 0.5));
    const frames = this.#frames;
    for (let row = 0; row < this.#rows; row += 1) {
      for (let column = 0; column < this.#columns; column += 1) {
        const sprite = this.#cells[row * this.#columns + column];
        sprite.x = offsetX + (column + 0.5) * cellSize;
        sprite.y = offsetY + (row + 0.5) * cellSize;
        sprite.texture = frames[Math.floor(this.#random() * frames.length) % frames.length];
        sprite.scale.set(this.#random() < 0.5 ? -grainPx : grainPx, this.#random() < 0.5 ? -grainPx : grainPx);
        const distance = Math.hypot(sprite.x - centerX, sprite.y - centerY) / halfDiagonal;
        sprite.alpha = centerShare >= 1 ? 1
          : centerShare + (1 - centerShare) * smooth(clamp01((distance - clearRadius) / feather));
      }
    }
  }

  // Grey specks of random brightness; most pixels clear, a few light, a few dark — read as film grain or static.
  static #drawNoise(documentTarget, random) {
    const canvas = documentTarget.createElement("canvas");
    canvas.width = TILE;
    canvas.height = TILE;
    const context = canvas.getContext("2d");
    const image = context.createImageData(TILE, TILE);
    const data = image.data;
    for (let index = 0; index < data.length; index += 4) {
      const roll = random();
      const light = roll > 0.5;
      const strength = Math.abs(roll - 0.5) * 2;
      const value = light ? 200 + Math.round(55 * random()) : Math.round(40 * random());
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = Math.round(255 * strength * strength);
    }
    context.putImageData(image, 0, 0);
    return canvas;
  }
}
