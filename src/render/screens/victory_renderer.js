class VictoryRenderer {
  #surface;
  #primitives;
  #assets;
  #themeResolver;
  #starRatingRenderer;
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

  constructor({
    surface,
    primitives,
    assets,
    themeResolver,
    starRatingRenderer,
  }) {
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
    if (!starRatingRenderer || typeof starRatingRenderer.render !== "function") {
      throw new TypeError("VictoryRenderer requires starRatingRenderer");
    }
    this.#surface = surface;
    this.#primitives = primitives;
    this.#assets = assets;
    this.#themeResolver = themeResolver;
    this.#starRatingRenderer = starRatingRenderer;
  }

  render(model) {
    if (!model.visible) return;
    const surface = this.#surface;
    const layout = model.layout;
    const config = model.config;
    const theme = this.#themeResolver.resolve(model.fish, model.nowMs);
    const color = theme.color;

    surface.save();
    if (config.blurPx > 0) {
      surface.filter = `blur(${config.blurPx}px)`;
      surface.drawCurrentSurface(0, 0, model.width, model.height);
      surface.filter = "none";
    }
    surface.fillStyle = "rgba(0, 0, 0, 0.48)";
    surface.fillRect(0, 0, model.width, model.height);

    surface.shadowColor = RenderMath.rgba(color, theme.glow.panelAlpha);
    surface.shadowBlur = theme.glow.panelBlur;
    this.#primitives.roundedRect(
      layout.panel.x,
      layout.panel.y,
      layout.panel.width,
      layout.panel.height,
      config.panelRadius,
    );
    surface.fillStyle = RenderMath.rgba(
      color,
      theme.background.alpha,
    );
    surface.fill();
    surface.shadowBlur = 0;
    surface.strokeStyle = RenderMath.rgba(color, theme.frameAlpha);
    surface.lineWidth = theme.borderWidth;
    if (theme.isAnimated) {
      surface.setLineDash(theme.frameDash);
      surface.lineDashOffset = -(
        (model.nowMs / 1000) * theme.frameDashSpeedPxPerSecond
      );
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

    this.#drawFishImage(model, theme);
    this.#starRatingRenderer.render({
      rect: model.layout.rarity,
      rarity: model.fish.rarity,
      config,
      themeColor: theme.color,
      maximumColor: theme.maximumColor,
    });
    this.#drawStats(model, theme);
    this.#drawButton(layout.claim, "Claim", color, true);
    this.#drawButton(
      layout.release,
      "Release",
      theme.neutralColor,
      false,
    );
    surface.restore();
  }

  #drawFishImage(model, theme) {
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

    if (theme.isAnimated) {
      surface.shadowColor = RenderMath.rgba(
        color,
        theme.glow.imageAlpha,
      );
      surface.shadowBlur = theme.glow.imageBlur;
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

  #drawStats(model, theme) {
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
        stat.color ||
          (stat.tone === "neutral" ? theme.neutralColor : theme.color),
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
