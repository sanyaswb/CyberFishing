class VictoryThemeResolver {
  #rarityVisualResolver;
  #theme = {
    color: null,
    neutralColor: null,
    maximumColor: null,
    isRarest: false,
  };

  constructor({ rarityVisualResolver }) {
    if (
      !rarityVisualResolver ||
      typeof rarityVisualResolver.resolveLevel !== "function"
    ) {
      throw new TypeError(
        "VictoryThemeResolver requires rarityVisualResolver",
      );
    }
    this.#rarityVisualResolver = rarityVisualResolver;
  }

  resolve(fish) {
    const level = Math.max(1, Math.round(Number(fish?.level) || 1));
    const maxLevel = Math.max(
      level,
      Math.round(Number(fish?.maxLevel) || level),
    );
    const isRarest = fish?.rarity?.isRarest === true;
    const visual = isRarest
      ? this.#rarityVisualResolver.maximum
      : this.#rarityVisualResolver.resolveLevel(level, maxLevel, true);

    this.#theme.color = visual.color;
    this.#theme.neutralColor = this.#rarityVisualResolver.neutral.color;
    this.#theme.maximumColor = this.#rarityVisualResolver.maximum.color;
    this.#theme.isRarest = isRarest;
    return this.#theme;
  }
}
