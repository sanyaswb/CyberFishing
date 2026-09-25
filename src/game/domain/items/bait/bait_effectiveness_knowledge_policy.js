export class BaitEffectivenessKnowledgePolicy {
  isDiscovered(_context) {
    throw new Error("BaitEffectivenessKnowledgePolicy.isDiscovered must be implemented");
  }
}

export class AlwaysKnownBaitEffectivenessPolicy extends BaitEffectivenessKnowledgePolicy {
  isDiscovered(_context) {
    return true;
  }
}
