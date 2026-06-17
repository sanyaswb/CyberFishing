class VictoryThemeResolver {
  #theme = { color: [145, 150, 160], isUnique: false };

  resolve(fish, config) {
    const colors = config.levelColors || {};
    const gray = colors[1] || [145, 150, 160];
    const green = colors[2] || [0, 210, 120];
    const blue = colors[3] || [0, 160, 255];
    const purple = colors[4] || [170, 100, 255];
    const red = colors.preUnique || [255, 70, 70];
    const gold = colors.unique || [255, 205, 55];
    const level = Math.max(1, Math.round(fish.level || 1));
    const maxLevel = Math.max(level, Math.round(fish.maxLevel || level));
    let color = gray;

    this.#theme.isUnique = fish.isUnique === true;
    if (this.#theme.isUnique) color = gold;
    else if (maxLevel > 2 && level === maxLevel - 1) color = red;
    else if (level === 2) color = green;
    else if (level === 3) color = blue;
    else if (level === 4) color = purple;
    else if (level > 4) {
      color = RenderMath.mixRgb(
        purple,
        red,
        (level - 4) / Math.max(1, maxLevel - 5),
      );
    }

    this.#theme.color = color;
    return this.#theme;
  }
}
