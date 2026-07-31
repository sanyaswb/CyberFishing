class VictoryRenderer {
  #surface;
  #primitives;
  #assets;
  #themeResolver;
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

  constructor({ surface, primitives, assets, themeResolver }) {
    if (!surface || typeof surface.drawCurrentSurface !== "function") {
      throw new TypeError("VictoryRenderer requires surface");
    }
    if (!primitives || typeof primitives.roundedRect !== "function") {
      throw new TypeError("VictoryRenderer requires primitives");
    }
    if (!assets || typeof assets.tryGet !== "function") {
      throw new TypeError("VictoryRenderer requires assets");
    }
    if (!themeResolver || typeof themeResolver.resolve !== "function") {
      throw new TypeError("VictoryRenderer requires themeResolver");
    }
    this.#surface = surface;
    this.#primitives = primitives;
    this.#assets = assets;
    this.#themeResolver = themeResolver;
  }

  render(model) {
    if (!model.visible) return;
    const surface = this.#surface;
    const layout = model.layout;
    const config = model.config;
    const theme = this.#themeResolver.resolve(model.fish, config);
    const color = theme.color;
    const rarestPulse = theme.isRarest
      ? this.#resolveRarestPulse(model.nowMs, config.uniqueGlowPulseMs)
      : 0;

    surface.save();
    if (config.blurPx > 0) {
      surface.filter = `blur(${config.blurPx}px)`;
      surface.drawCurrentSurface(0, 0, model.width, model.height);
      surface.filter = "none";
    }
    surface.fillStyle = "rgba(0, 0, 0, 0.48)";
    surface.fillRect(0, 0, model.width, model.height);

    surface.shadowColor = RenderMath.rgba(color, 0.35);
    surface.shadowBlur = theme.isRarest ? 30 + rarestPulse * 22 : 20;
    this.#primitives.roundedRect(
      layout.panel.x,
      layout.panel.y,
      layout.panel.width,
      layout.panel.height,
      config.panelRadius,
    );
    surface.fillStyle = RenderMath.rgba(
      color,
      theme.isRarest ? 0.18 + rarestPulse * 0.12 : 0.15,
    );
    surface.fill();
    surface.shadowBlur = 0;
    surface.strokeStyle = RenderMath.rgba(color, 0.75);
    surface.lineWidth = theme.isRarest ? 2.5 + rarestPulse : 1.5;
    if (theme.isRarest) {
      surface.setLineDash(config.uniqueFrameDash);
      surface.lineDashOffset = -(model.nowMs / 45);
    }
    surface.stroke();
    surface.setLineDash([]);
    surface.lineDashOffset = 0;

    this.#drawFittedText(
      "Caught",
      layout.panel.x + layout.panel.width / 2,
      layout.panel.y + layout.padding + 10,
      layout.panel.width - layout.padding * 2,
      14,
      "sans-serif",
      "bold",
      RenderMath.rgba(color, 0.9),
    );
    this.#drawFittedText(
      model.fish.name,
      layout.panel.x + layout.panel.width / 2,
      layout.panel.y + layout.padding + 34,
      layout.panel.width - layout.padding * 2,
      24,
      "sans-serif",
      "bold",
      "#ffffff",
    );

    this.#drawFishImage(model, theme, rarestPulse);
    this.#drawRarity(model, theme);
    this.#drawStats(model, color);
    this.#drawButton(layout.claim, "Claim", color, true);
    this.#drawButton(
      layout.release,
      "Release",
      [145, 150, 160],
      false,
    );
    surface.restore();
  }

  #drawFishImage(model, theme, rarestPulse) {
    const surface = this.#surface;
    const imageRect = model.layout.image;
    const color = theme.color;
    const image = this.#assets.tryGet(model.spriteId);

    surface.fillStyle = "rgba(5, 10, 16, 0.75)";
    surface.fillRect(
      imageRect.x,
      imageRect.y,
      imageRect.width,
      imageRect.height,
    );
    if (image) {
      surface.save();
      surface.beginPath();
      surface.rect(
        imageRect.x,
        imageRect.y,
        imageRect.width,
        imageRect.height,
      );
      surface.clip();
      this.#primitives.drawImageCover(
        image,
        imageRect.x,
        imageRect.y,
        imageRect.width,
        imageRect.height,
      );
      surface.restore();
    } else {
      this.#drawFittedText(
        "loading...",
        imageRect.x + imageRect.width / 2,
        imageRect.y + imageRect.height / 2,
        imageRect.width - 20,
        14,
        "monospace",
        "bold",
        RenderMath.rgba(color, 0.85),
      );
    }

    if (theme.isRarest) {
      surface.shadowColor = RenderMath.rgba(color, 0.95);
      surface.shadowBlur = 14 + rarestPulse * 18;
    }
    surface.strokeStyle = RenderMath.rgba(color, 1);
    surface.lineWidth = model.config.imageBorderWidth;
    surface.strokeRect(
      imageRect.x,
      imageRect.y,
      imageRect.width,
      imageRect.height,
    );
    surface.shadowBlur = 0;
    this.#drawBadge(model, color);
  }

  #drawRarity(model, theme) {
    const surface = this.#surface;
    const rect = model.layout.rarity;
    const rarity = model.fish.rarity || {};
    const maxStars = Math.max(1, Math.round(Number(rarity.maxStars) || 6));
    const halfSteps = Math.max(0, Math.round(Number(rarity.halfSteps) || 0));
    const maxHalfSteps = Math.max(
      1,
      Math.round(Number(rarity.maxHalfSteps) || maxStars * 2),
    );
    const configuredRadius = Number(model.config.rarityStarRadius) || 12;
    const gap = Math.max(2, Number(model.config.rarityStarGap) || 7);
    const crownWidth = rarity.isCrown === true ? 30 : 0;
    const radius = Math.min(
      configuredRadius,
      (rect.width - crownWidth - gap * Math.max(0, maxStars - 1)) /
        (maxStars * 2),
    );
    const starsWidth = maxStars * radius * 2 + (maxStars - 1) * gap;
    const totalWidth = starsWidth + crownWidth;
    const startX = rect.x + (rect.width - totalWidth) / 2 + radius;
    const centerY = rect.y + rect.height - radius - 2;
    const starColor = model.config.levelColors?.unique || [255, 205, 55];

    this.#drawFittedText(
      `Rarity ${halfSteps}/${maxHalfSteps}`,
      rect.x + rect.width / 2,
      rect.y + 9,
      rect.width - 12,
      11,
      "sans-serif",
      "bold",
      RenderMath.rgba(theme.color, 0.95),
    );

    for (let index = 0; index < maxStars; index += 1) {
      const centerX = startX + index * (radius * 2 + gap);
      const fillRatio = Math.max(
        0,
        Math.min(1, (halfSteps - index * 2) / 2),
      );
      this.#drawStar(centerX, centerY, radius, fillRatio, starColor);
    }

    if (rarity.isCrown === true) {
      this.#drawFittedText(
        "\u{1F451}",
        startX - radius + starsWidth + crownWidth / 2,
        centerY,
        crownWidth,
        20,
        "sans-serif",
        "bold",
        RenderMath.rgba(starColor, 1),
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

  #traceStar(centerX, centerY, outerRadius) {
    const surface = this.#surface;
    const innerRadius = outerRadius * 0.46;
    surface.beginPath();
    for (let point = 0; point < 10; point += 1) {
      const radius = point % 2 === 0 ? outerRadius : innerRadius;
      const angle = -Math.PI / 2 + point * Math.PI / 5;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      if (point === 0) surface.moveTo(x, y);
      else surface.lineTo(x, y);
    }
    surface.closePath();
  }

  #resolveRarestPulse(nowMs, durationMs) {
    return (
      0.5 +
      Math.sin(
        (Number(nowMs || 0) / Math.max(1, Number(durationMs) || 1200)) *
          Math.PI *
          2,
      ) *
        0.5
    );
  }

  #drawBadge(model, color) {
    const surface = this.#surface;
    const badge = model.layout.badge;
    surface.fillStyle = "rgba(22, 24, 28, 0.9)";
    surface.fillRect(badge.x, badge.y, badge.width, badge.height);
    surface.strokeStyle = RenderMath.rgba(color, 0.9);
    surface.lineWidth = 1;
    surface.strokeRect(badge.x, badge.y, badge.width, badge.height);
    this.#drawFittedText(
      String(model.fish.level),
      badge.x + badge.width / 2,
      badge.y + badge.height / 2,
      badge.width - 8,
      22,
      "monospace",
      "bold",
      RenderMath.rgba(color, 1),
    );
  }

  #drawStats(model, fallbackColor) {
    const stats = model.layout.stats;
    for (let index = 0; index < model.stats.count; index += 1) {
      const stat = this.#statAt(model.stats, index);
      const column = index % stats.columns;
      const row = Math.floor(index / stats.columns);
      this.#drawPill(
        stats.x + column * (stats.pillWidth + stats.pillGap),
        stats.y + row * (stats.pillHeight + stats.pillGap),
        stats.pillWidth,
        stats.pillHeight,
        stat.label,
        stat.color || fallbackColor,
      );
    }
  }

  #statAt(stats, index) {
    return stats.getAt(index);
  }

  #drawPill(x, y, width, height, label, color) {
    const surface = this.#surface;
    this.#primitives.roundedRect(x, y, width, height, 8);
    surface.fillStyle = "rgba(5, 10, 16, 0.48)";
    surface.fill();
    surface.strokeStyle = RenderMath.rgba(color, 0.38);
    surface.lineWidth = 1;
    surface.stroke();
    this.#drawFittedText(
      label,
      x + width / 2,
      y + height / 2,
      width - 14,
      13,
      "sans-serif",
      "bold",
      "#e8edf5",
    );
  }

  #drawButton(rect, label, color, filled) {
    const surface = this.#surface;
    this.#primitives.roundedRect(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      8,
    );
    surface.fillStyle = filled
      ? RenderMath.rgba(color, 0.82)
      : "rgba(0, 0, 0, 0.28)";
    surface.fill();
    surface.strokeStyle = RenderMath.rgba(color, 0.95);
    surface.lineWidth = 1.5;
    surface.stroke();
    this.#drawFittedText(
      label,
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      rect.width - 20,
      15,
      "sans-serif",
      "bold",
      filled ? "#061014" : "#e8edf5",
    );
  }

  #drawFittedText(text, x, y, maxWidth, size, family, weight, color) {
    const options = this.#textOptions;
    options.text = text;
    options.x = x;
    options.y = y;
    options.maxWidth = maxWidth;
    options.font.size = size;
    options.font.family = family;
    options.font.weight = weight;
    options.color = color;
    this.#primitives.drawFittedText(options);
  }
}
