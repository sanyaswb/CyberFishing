// A 2D drawing surface in logical pixels (spec 100 D1/D2). With a resolution (the game canvas's CanvasMetricsProvider:
// logical width/height and pixelRatio), beginFrame() re-applies the base transform and the image smoothing policy,
// because a canvas resize between frames resets the context state. Without one (offscreen data surfaces: depth maps,
// debug maps) a logical pixel is a backing pixel. getImageData always reads backing pixels.
export class Canvas2DSurface {
  #canvas;
  #context;
  #resolution;

  constructor(canvas, { contextAttributes = { alpha: false }, resolution = null } = {}) {
    if (!canvas || typeof canvas.getContext !== "function") {
      throw new TypeError("Canvas2DSurface requires an HTMLCanvasElement-like object");
    }

    const context = canvas.getContext("2d", contextAttributes);
    if (!context) {
      throw new Error("Canvas2DSurface could not acquire a 2D rendering context");
    }

    this.#canvas = canvas;
    this.#context = context;
    this.#resolution = resolution;
  }

  // Logical pixels.
  get width() {
    return Math.max(0, Number(this.#resolution ? this.#resolution.width : this.#canvas.width) || 0);
  }

  get height() {
    return Math.max(0, Number(this.#resolution ? this.#resolution.height : this.#canvas.height) || 0);
  }

  // Backing pixels per logical pixel.
  get pixelRatio() {
    return this.#resolution ? this.#resolution.pixelRatio : 1;
  }

  get canvas() {
    return this.#canvas;
  }

  get fillStyle() {
    return this.#context.fillStyle;
  }

  set fillStyle(value) {
    this.#context.fillStyle = value;
  }

  get strokeStyle() {
    return this.#context.strokeStyle;
  }

  set strokeStyle(value) {
    this.#context.strokeStyle = value;
  }

  get lineWidth() {
    return this.#context.lineWidth;
  }

  set lineWidth(value) {
    this.#context.lineWidth = value;
  }

  get font() {
    return this.#context.font;
  }

  set font(value) {
    this.#context.font = value;
  }

  get textAlign() {
    return this.#context.textAlign;
  }

  set textAlign(value) {
    this.#context.textAlign = value;
  }

  get textBaseline() {
    return this.#context.textBaseline;
  }

  set textBaseline(value) {
    this.#context.textBaseline = value;
  }

  get globalAlpha() {
    return this.#context.globalAlpha;
  }

  set globalAlpha(value) {
    this.#context.globalAlpha = value;
  }

  set shadowColor(value) {
    this.#context.shadowColor = value;
  }

  set shadowBlur(value) {
    this.#context.shadowBlur = value;
  }

  set filter(value) {
    this.#context.filter = value;
  }

  set lineDashOffset(value) {
    this.#context.lineDashOffset = value;
  }

  // Starts a frame (spec 100): the base transform (logical -> backing pixels) and high-quality smoothing for downscaled
  // images. The render coordinator calls it before every frame, so a resize in between never leaves a frame unscaled.
  beginFrame() {
    const context = this.#context;
    const ratio = this.pixelRatio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
  }

  clear(color = "#0f171e") {
    this.#context.fillStyle = color;
    this.#context.fillRect(0, 0, this.width, this.height);
  }

  setState(state = {}) {
    for (const key in state) {
      if (!(key in this.#context)) {
        throw new Error(`Unsupported Canvas2DSurface state property: ${key}`);
      }
      this.#context[key] = state[key];
    }
  }

  save() {
    this.#context.save();
  }

  restore() {
    this.#context.restore();
  }

  beginPath() {
    this.#context.beginPath();
  }

  closePath() {
    this.#context.closePath();
  }

  moveTo(x, y) {
    this.#context.moveTo(x, y);
  }

  lineTo(x, y) {
    this.#context.lineTo(x, y);
  }

  quadraticCurveTo(controlX, controlY, x, y) {
    this.#context.quadraticCurveTo(controlX, controlY, x, y);
  }

  arc(x, y, radius, startAngle, endAngle, counterclockwise = false) {
    this.#context.arc(
      x,
      y,
      radius,
      startAngle,
      endAngle,
      counterclockwise,
    );
  }

  ellipse(
    x,
    y,
    radiusX,
    radiusY,
    rotation,
    startAngle,
    endAngle,
    counterclockwise = false,
  ) {
    this.#context.ellipse(
      x,
      y,
      radiusX,
      radiusY,
      rotation,
      startAngle,
      endAngle,
      counterclockwise,
    );
  }

  rect(x, y, width, height) {
    this.#context.rect(x, y, width, height);
  }

  clip() {
    this.#context.clip();
  }

  fill() {
    this.#context.fill();
  }

  stroke() {
    this.#context.stroke();
  }

  fillRect(x, y, width, height) {
    this.#context.fillRect(x, y, width, height);
  }

  clearRect(x, y, width, height) {
    this.#context.clearRect(x, y, width, height);
  }

  strokeRect(x, y, width, height) {
    this.#context.strokeRect(x, y, width, height);
  }

  drawImage(
    image,
    sxOrDx,
    syOrDy,
    sWidthOrDWidth,
    sHeightOrDHeight,
    dx,
    dy,
    dWidth,
    dHeight,
  ) {
    if (arguments.length === 3) {
      this.#context.drawImage(image, sxOrDx, syOrDy);
      return;
    }
    if (arguments.length === 5) {
      this.#context.drawImage(
        image,
        sxOrDx,
        syOrDy,
        sWidthOrDWidth,
        sHeightOrDHeight,
      );
      return;
    }
    this.#context.drawImage(
      image,
      sxOrDx,
      syOrDy,
      sWidthOrDWidth,
      sHeightOrDHeight,
      dx,
      dy,
      dWidth,
      dHeight,
    );
  }

  getImageData(x, y, width, height) {
    return this.#context.getImageData(x, y, width, height);
  }

  drawText(text, x, y, maxWidth = null) {
    if (maxWidth !== null && maxWidth !== undefined && Number.isFinite(Number(maxWidth))) {
      this.#context.fillText(text, x, y, Number(maxWidth));
      return;
    }
    this.#context.fillText(text, x, y);
  }

  fillText(text, x, y, maxWidth = null) {
    this.drawText(text, x, y, maxWidth);
  }

  measureText(text) {
    return this.#context.measureText(text);
  }

  translate(x, y) {
    this.#context.translate(x, y);
  }

  rotate(angleRad) {
    this.#context.rotate(angleRad);
  }

  setLineDash(segments) {
    this.#context.setLineDash(segments);
  }

  drawCurrentSurface(x, y, width, height) {
    this.#context.drawImage(this.#canvas, x, y, width, height);
  }
}
