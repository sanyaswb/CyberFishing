class VictoryLayoutResolver {
  #layout = {
    panel: {},
    image: {},
    badge: {},
    stats: {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      columns: 0,
      rows: 0,
      pillWidth: 0,
      pillHeight: 0,
      pillGap: 0,
    },
    claim: {},
    release: {},
  };

  resolve({ width, height, config, statCount = 3 }) {
    const viewportWidth = Math.max(1, Number(width) || 1);
    const viewportHeight = Math.max(1, Number(height) || 1);
    const margin = Math.max(8, Number(config?.viewportMargin) || 24);
    const configuredPanelWidth = Number(config?.panelWidth) || 540;
    const configuredPadding = Number(config?.panelPadding) || 24;
    const configuredPillHeight = Number(config?.statPillHeight) || 42;
    const configuredButtonHeight = Number(config?.buttonHeight) || 42;
    const configuredImageSize = Number(config?.imageBoxSize) || 260;
    const configuredMinHeight = Number(config?.panelMinHeight) || 560;
    const configuredButtonWidth = Number(config?.buttonWidth) || 150;
    const configuredButtonGap = Number(config?.buttonGap) || 14;
    const maxPanelWidth = Math.max(260, viewportWidth - margin * 2);
    const panelWidth = Math.min(configuredPanelWidth, maxPanelWidth);
    const padding = Math.min(
      configuredPadding,
      Math.max(14, panelWidth * 0.06),
    );
    const maxPanelHeight = Math.max(320, viewportHeight - margin * 2);
    const titleHeight = 46;
    const gap = 16;
    const pillHeight = configuredPillHeight;
    const buttonHeight = configuredButtonHeight;
    const columns = Math.min(3, Math.max(1, statCount));
    const rows = Math.ceil(statCount / columns);
    const pillGap = 8;
    const statsHeight = rows * pillHeight + (rows - 1) * pillGap;
    let imageSize = Math.min(
      configuredImageSize,
      panelWidth - padding * 2,
      Math.max(140, maxPanelHeight * 0.46),
    );
    let contentHeight =
      padding * 2 +
      titleHeight +
      gap +
      imageSize +
      gap +
      statsHeight +
      gap +
      buttonHeight;

    if (contentHeight > maxPanelHeight) {
      imageSize = Math.max(
        120,
        imageSize - (contentHeight - maxPanelHeight),
      );
      contentHeight =
        padding * 2 +
        titleHeight +
        gap +
        imageSize +
        gap +
        statsHeight +
        gap +
        buttonHeight;
    }

    const panelHeight = Math.min(
      maxPanelHeight,
      Math.max(
        contentHeight,
        Math.min(configuredMinHeight, maxPanelHeight),
      ),
    );
    const panelX = (viewportWidth - panelWidth) / 2;
    const panelY = (viewportHeight - panelHeight) / 2;
    const imageX = panelX + (panelWidth - imageSize) / 2;
    const imageY = panelY + padding + titleHeight + gap;
    const statsY = imageY + imageSize + gap;
    const pillWidth =
      (panelWidth - padding * 2 - pillGap * (columns - 1)) / columns;
    const buttonsY = statsY + statsHeight + gap;
    const buttonWidth = Math.min(
      configuredButtonWidth,
      (panelWidth - padding * 2 - configuredButtonGap) / 2,
    );
    const buttonsX =
      panelX + (panelWidth - buttonWidth * 2 - configuredButtonGap) / 2;

    this.#setRect(
      this.#layout.panel,
      panelX,
      panelY,
      panelWidth,
      panelHeight,
    );
    this.#setRect(
      this.#layout.image,
      imageX,
      imageY,
      imageSize,
      imageSize,
    );
    const badgeSize = Math.min(44, Math.max(34, imageSize * 0.17));
    this.#setRect(
      this.#layout.badge,
      imageX,
      imageY,
      badgeSize,
      badgeSize,
    );
    this.#setRect(
      this.#layout.claim,
      buttonsX,
      buttonsY,
      buttonWidth,
      buttonHeight,
    );
    this.#setRect(
      this.#layout.release,
      buttonsX + buttonWidth + configuredButtonGap,
      buttonsY,
      buttonWidth,
      buttonHeight,
    );
    Object.assign(this.#layout.stats, {
      x: panelX + padding,
      y: statsY,
      width: panelWidth - padding * 2,
      height: statsHeight,
      columns,
      rows,
      pillWidth,
      pillHeight,
      pillGap,
    });
    this.#layout.padding = padding;
    this.#layout.titleHeight = titleHeight;
    this.#layout.gap = gap;
    return this.#layout;
  }

  #setRect(target, x, y, width, height) {
    target.x = x;
    target.y = y;
    target.width = width;
    target.height = height;
  }
}
