class VictoryThemeResolver {
  #rarityVisualResolver;

  constructor({ rarityVisualResolver }) {
    if (
      !rarityVisualResolver ||
      typeof rarityVisualResolver.resolveLevelDescriptor !== "function"
    ) {
      throw new TypeError(
        "VictoryThemeResolver requires rarityVisualResolver",
      );
    }
    this.#rarityVisualResolver = rarityVisualResolver;
  }

  resolve(fish, nowMs = 0) {
    const level = Math.max(1, Math.round(Number(fish?.level) || 1));
    const maxLevel = Math.max(
      level,
      Math.round(Number(fish?.maxLevel) || level),
    );
    const useUniqueTheme = fish?.isUnique === true;
    return this.#rarityVisualResolver.resolveLevelDescriptor({
      level,
      maxLevel,
      reserveMaximum: true,
      isAnimated: useUniqueTheme,
      nowMs,
    });
  }
}
