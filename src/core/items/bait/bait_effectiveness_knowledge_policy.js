class BaitEffectivenessKnowledgePolicy {
  isDiscovered(_context) {
    throw new Error("BaitEffectivenessKnowledgePolicy.isDiscovered must be implemented");
  }
}

class AlwaysKnownBaitEffectivenessPolicy extends BaitEffectivenessKnowledgePolicy {
  isDiscovered(_context) {
    return true;
  }
}

globalThis.BaitEffectivenessKnowledgePolicy = BaitEffectivenessKnowledgePolicy;
globalThis.AlwaysKnownBaitEffectivenessPolicy =
  AlwaysKnownBaitEffectivenessPolicy;
