/**
 * Inventory-v2 terminal-line slot label: a reel rod takes a leader, any other
 * rod a main line; without a rod the slot names both. Composition injects the
 * rod capability resolver.
 */
class TerminalLineSlotLabelResolver {
  #capabilityResolver;

  constructor({ capabilityResolver = null } = {}) {
    this.#capabilityResolver = capabilityResolver;
  }

  resolve(rod) {
    if (!rod) return "Поводок / ліска";
    const supportsReel =
      this.#capabilityResolver?.resolve?.(rod)?.supportsReel === true;
    return supportsReel ? "Поводок" : "Ліска";
  }
}
