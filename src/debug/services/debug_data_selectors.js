class DebugDataSelectors {
  static lastKnownFish(context) {
    return context.live?.hookedFish || context.fight?.fish || null;
  }

  static lastKnownEquipment(context) {
    return context.live?.equipment || context.fight?.eq || {};
  }
}

window.DebugDataSelectors = DebugDataSelectors;
