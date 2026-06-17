class VictoryRenderer {
  #surface;
  #primitives;
  #assets;
  #themeResolver;

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

    surface.save();
    if (config.blurPx > 0) {
      surface.filter = `blur(${config.blurPx}px)`;
      surface.drawCurrentSurface(0, 0, model.width, model.height);
      surface.filter = "none";
    }
    surface.fillStyle = "rgba(0, 0, 0, 0.48)";
    surface.fillRect(0, 0, model.width, model.height);

    surface.shadowColor = RenderMath.rgba(color, 0.35);
    surface.shadowBlur = theme.isUnique ? 34 : 20;
    this.#primitives.roundedRect(
      layout.panel.x,
      layout.panel.y,
      layout.panel.width,
      layout.panel.height,
      config.panelRadius,
    );
    surface.fillStyle = RenderMath.rgba(
      color,
      theme.isUnique ? 0.2 : 0.15,
    );
    surface.fill();
    surface.shadowBlur = 0;
    surface.strokeStyle = RenderMath.rgba(color, 0.75);
    surface.lineWidth = 1.5;
    surface.stroke();

    this.#primitives.drawFittedText({
      text: "Caught",
      x: layout.panel.x + layout.panel.width / 2,
      y: layout.panel.y + layout.padding + 10,
      maxWidth: layout.panel.width - layout.padding * 2,
      font: { size: 14, family: "sans-serif", weight: "bold" },
      color: RenderMath.rgba(color, 0.9),
    });
    this.#primitives.drawFittedText({
      text: model.fish.name,
      x: layout.panel.x + layout.panel.width / 2,
      y: layout.panel.y + layout.padding + 34,
      maxWidth: layout.panel.width - layout.padding * 2,
      font: { size: 24, family: "sans-serif", weight: "bold" },
      color: "#ffffff",
    });

    this.#drawFishImage(model, theme);
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
      this.#primitives.drawFittedText({
        text: "loading...",
        x: imageRect.x + imageRect.width / 2,
        y: imageRect.y + imageRect.height / 2,
        maxWidth: imageRect.width - 20,
        font: { size: 14, family: "monospace", weight: "bold" },
        color: RenderMath.rgba(color, 0.85),
      });
    }

    if (theme.isUnique) {
      const pulse =
        0.5 +
        Math.sin(
          (model.nowMs /
            Math.max(1, model.config.uniqueGlowPulseMs)) *
            Math.PI *
            2,
        ) *
          0.5;
      surface.shadowColor = RenderMath.rgba(color, 0.95);
      surface.shadowBlur = 14 + pulse * 18;
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
    this.#primitives.drawFittedText({
      text: String(model.fish.level),
      x: badge.x + badge.width / 2,
      y: badge.y + badge.height / 2,
      maxWidth: badge.width - 8,
      font: { size: 22, family: "monospace", weight: "bold" },
      color: RenderMath.rgba(color, 1),
    });
  }

  #drawStats(model, fallbackColor) {
    const stats = model.layout.stats;
    model.stats.forEach((stat, index) => {
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
    });
  }

  #drawPill(x, y, width, height, label, color) {
    const surface = this.#surface;
    this.#primitives.roundedRect(x, y, width, height, 8);
    surface.fillStyle = "rgba(5, 10, 16, 0.48)";
    surface.fill();
    surface.strokeStyle = RenderMath.rgba(color, 0.38);
    surface.lineWidth = 1;
    surface.stroke();
    this.#primitives.drawFittedText({
      text: label,
      x: x + width / 2,
      y: y + height / 2,
      maxWidth: width - 14,
      font: { size: 13, family: "sans-serif", weight: "bold" },
      color: "#e8edf5",
    });
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
    this.#primitives.drawFittedText({
      text: label,
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      maxWidth: rect.width - 20,
      font: { size: 15, family: "sans-serif", weight: "bold" },
      color: filled ? "#061014" : "#e8edf5",
    });
  }
}
