class ItemRarityStrategy {
  supports(_profile) {
    return false;
  }

  resolve(_profile) {
    throw new Error("ItemRarityStrategy.resolve must be implemented");
  }
}
