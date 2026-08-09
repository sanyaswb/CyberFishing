class TerminalLineSlotResolver {
  #capabilityResolver;

  constructor({ capabilityResolver = null } = {}) {
    this.#capabilityResolver =
      capabilityResolver ||
      (typeof RodCapabilityResolver !== "undefined"
        ? new RodCapabilityResolver()
        : null);
  }

  resolve(rod) {
    const slotId =
      typeof EquipmentSlotId !== "undefined"
        ? EquipmentSlotId.TERMINAL_LINE
        : "terminalLine";
    if (!rod) {
      return Object.freeze({
        slotId,
        label: "Поводок / ліска",
        acceptTypes: Object.freeze(["fishing_line", "leader_line"]),
      });
    }

    const supportsReel =
      this.#capabilityResolver?.resolve?.(rod)?.supportsReel === true;
    return Object.freeze({
      slotId,
      label: supportsReel ? "Поводок" : "Ліска",
      acceptTypes: Object.freeze(
        supportsReel ? ["leader_line"] : ["fishing_line"],
      ),
    });
  }
}
