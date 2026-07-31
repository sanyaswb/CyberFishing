class StarRatingRenderer {
  #surface;
  #primitives;
  #starX = new Float32Array(10);
  #starY = new Float32Array(10);
  #textOptions = {
    text: "",
    x: 0,
    y: 0,
    maxWidth: 0,
    font: {
      size: 10,
      family: "sans-serif",
      weight: "bold",
    },
    color: "#ffffff",
    align: "center",
    baseline: "middle",
    minSize: 10,
  };

  constructor({ surface, primitives }) {
    if (!surface || typeof surface.beginPath !== "function") {
      throw new TypeError("StarRatingRenderer requires surface");
    }
    if (!primitives || typeof primitives.drawFittedText !== "function") {
      throw new TypeError("StarRatingRenderer requires primitives");
    }
    this.#surface = surface;
    this.#primitives = primitives;
    this.#cacheNormalizedStarPoints();
  }

  render({ rect, rarity, config, themeColor, maximumColor }) {
    const descriptor = rarity || {};
    const isResolved = descriptor.isResolved !== false;
    const halfSteps = Math.max(
      0,
      Math.round(Number(descriptor.halfSteps) || 0),
    );
    const maxHalfSteps = Math.max(
      0,
      Math.round(Number(descriptor.maxHalfSteps) || 0),
    );
    const unitsPerStar = Math.max(
      1,
      Math.round(Number(descriptor.unitsPerStar) || 2),
    );
    const maxStars = Math.max(
      0,
      Math.round(
        Number(descriptor.maxStars) ||
          (maxHalfSteps > 0 ? maxHalfSteps / unitsPerStar : 0),
      ),
    );
    const label = isResolved && maxHalfSteps > 0
      ? `Rarity ${halfSteps}/${maxHalfSteps}`
      : "Rarity —";

    this.#drawFittedText(
      label,
      rect.x + rect.width / 2,
      rect.y + 9,
      rect.width - 12,
      11,
      RenderMath.rgba(themeColor, 0.95),
    );
    if (!isResolved || maxStars === 0) return;

    const gap = Math.max(2, Number(config.rarityStarGap) || 7);
    const crownWidth = descriptor.isMaximum === true ? 30 : 0;
    const configuredRadius = Number(config.rarityStarRadius) || 12;
    const radius = Math.min(
      configuredRadius,
      (rect.width - crownWidth - gap * Math.max(0, maxStars - 1)) /
        (maxStars * 2),
    );
    const starsWidth = maxStars * radius * 2 + (maxStars - 1) * gap;
    const totalWidth = starsWidth + crownWidth;
    const startX = rect.x + (rect.width - totalWidth) / 2 + radius;
    const centerY = rect.y + rect.height - radius - 2;

    for (let index = 0; index < maxStars; index += 1) {
      const centerX = startX + index * (radius * 2 + gap);
      const fillRatio = Math.max(
        0,
        Math.min(1, (halfSteps - index * unitsPerStar) / unitsPerStar),
      );
      this.#drawStar(centerX, centerY, radius, fillRatio, maximumColor);
    }

    if (descriptor.isMaximum === true) {
      this.#drawFittedText(
        "\u{1F451}",
        startX - radius + starsWidth + crownWidth / 2,
        centerY,
        crownWidth,
        20,
        RenderMath.rgba(maximumColor, 1),
      );
    }
  }

  #drawStar(centerX, centerY, radius, fillRatio, color) {
    const surface = this.#surface;
    this.#traceStar(centerX, centerY, radius);
    surface.fillStyle = "rgba(255, 255, 255, 0.08)";
    surface.fill();

    if (fillRatio > 0) {
      surface.save();
      this.#traceStar(centerX, centerY, radius);
      surface.clip();
      surface.fillStyle = RenderMath.rgba(color, 0.96);
      surface.fillRect(
        centerX - radius,
        centerY - radius,
        radius * 2 * fillRatio,
        radius * 2,
      );
      surface.restore();
    }

    this.#traceStar(centerX, centerY, radius);
    surface.strokeStyle = RenderMath.rgba(color, 0.8);
    surface.lineWidth = 1.25;
    surface.stroke();
  }

  #traceStar(centerX, centerY, radius) {
    const surface = this.#surface;
    surface.beginPath();
    for (let index = 0; index < this.#starX.length; index += 1) {
      const x = centerX + this.#starX[index] * radius;
      const y = centerY + this.#starY[index] * radius;
      if (index === 0) surface.moveTo(x, y);
      else surface.lineTo(x, y);
    }
    surface.closePath();
  }

  #cacheNormalizedStarPoints() {
    for (let index = 0; index < this.#starX.length; index += 1) {
      const radius = index % 2 === 0 ? 1 : 0.46;
      const angle = -Math.PI / 2 + index * Math.PI / 5;
      this.#starX[index] = Math.cos(angle) * radius;
      this.#starY[index] = Math.sin(angle) * radius;
    }
  }

  #drawFittedText(text, x, y, maxWidth, size, color) {
    const options = this.#textOptions;
    options.text = text;
    options.x = x;
    options.y = y;
    options.maxWidth = maxWidth;
    options.font.size = size;
    options.color = color;
    this.#primitives.drawFittedText(options);
  }
}
