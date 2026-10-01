import { EquipmentSlotId } from "./equipment_slot_catalog.js";
import { RodCapabilityResolver } from "./rod_capability_resolver.js";

// Domain rule: the terminal-line slot takes a leader on reel rods and a main line
// otherwise. Its UI labels are resolved in presentation.
export class TerminalLineSlotResolver {
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
        acceptTypes: Object.freeze(["fishing_line", "leader_line"]),
      });
    }

    const supportsReel =
      this.#capabilityResolver?.resolve?.(rod)?.supportsReel === true;
    return Object.freeze({
      slotId,
      acceptTypes: Object.freeze(
        supportsReel ? ["leader_line"] : ["fishing_line"],
      ),
    });
  }
}
