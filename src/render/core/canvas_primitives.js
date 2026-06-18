class CanvasPrimitives {
  #surface;

  constructor(surface) {
    if (
      !surface ||
      typeof surface.beginPath !== "function" ||
      typeof surface.drawImage !== "function"
    ) {
      throw new TypeError("CanvasPrimitives requires a drawing surface");
    }
    this.#surface = surface;
  }

  roundedRect(x, y, width, height, radius) {
    const safeRadius = Math.max(
      0,
      Math.min(Number(radius) || 0, width / 2, height / 2),
    );
    const right = x + width;
    const bottom = y + height;

    this.#surface.beginPath();
    this.#surface.moveTo(x + safeRadius, y);
    this.#surface.lineTo(right - safeRadius, y);
    this.#surface.quadraticCurveTo(right, y, right, y + safeRadius);
    this.#surface.lineTo(right, bottom - safeRadius);
    this.#surface.quadraticCurveTo(
      right,
      bottom,
      right - safeRadius,
      bottom,
    );
    this.#surface.lineTo(x + safeRadius, bottom);
    this.#surface.quadraticCurveTo(x, bottom, x, bottom - safeRadius);
    this.#surface.lineTo(x, y + safeRadius);
    this.#surface.quadraticCurveTo(x, y, x + safeRadius, y);
  }

  withClip(rects, draw) {
    const clipped = this.beginClip(rects);
    draw();
    this.endClip(clipped);
  }

  beginClip(rects) {
    const isReusableList =
      rects &&
      typeof rects.getAt === "function" &&
      typeof rects.count === "number";
    const isArray = Array.isArray(rects);
    const count = isReusableList ? rects.count : isArray ? rects.length : 0;
    if (count === 0) {
      return false;
    }

    this.#surface.save();
    this.#surface.beginPath();
    if (isReusableList) {
      for (let index = 0; index < rects.count; index += 1) {
        this.#appendClipRect(rects.getAt(index));
      }
    } else {
      for (let index = 0; index < rects.length; index += 1) {
        this.#appendClipRect(rects[index]);
      }
    }
    this.#surface.clip();
    return true;
  }

  endClip(active) {
    if (active) {
      this.#surface.restore();
    }
  }

  #appendClipRect(rect) {
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    this.#surface.rect(rect.x, rect.y, rect.width, rect.height);
  }

  drawImageCover(image, x, y, width, height) {
    const naturalWidth = Math.max(0, Number(image?.naturalWidth) || 0);
    const naturalHeight = Math.max(0, Number(image?.naturalHeight) || 0);
    if (naturalWidth <= 0 || naturalHeight <= 0 || width <= 0 || height <= 0) {
      return false;
    }

    const scale = Math.max(width / naturalWidth, height / naturalHeight);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sourceX = (naturalWidth - sourceWidth) / 2;
    const sourceY = (naturalHeight - sourceHeight) / 2;

    this.#surface.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      x,
      y,
      width,
      height,
    );
    return true;
  }

  drawFittedText({
    text,
    x,
    y,
    maxWidth,
    font,
    color,
    align = "center",
    baseline = "middle",
    minSize = 10,
  }) {
    const family = font?.family || "monospace";
    const weight = font?.weight || "bold";
    let size = Math.max(minSize, Number(font?.size) || minSize);

    while (size > minSize) {
      this.#surface.font = `${weight} ${size}px ${family}`;
      if (this.#surface.measureText(text).width <= maxWidth) break;
      size -= 1;
    }

    this.#surface.fillStyle = color;
    this.#surface.font = `${weight} ${size}px ${family}`;
    this.#surface.textAlign = align;
    this.#surface.textBaseline = baseline;
    this.#surface.drawText(text, x, y);
    return size;
  }
}
