/**
 * DEV flag port read by gameplay (owner decision D4 keeps this calling API).
 * @typedef {Object} IDevFlagsProvider
 * @property {(flag: string) => boolean} isEnabled
 * @property {() => boolean} isDebugEnabled
 * @property {(name: string) => unknown} godModeValue
 */

// Production implementation: GodMode overrides and debug output stay off whatever the configuration says.
// Development startup composes the active DevFlagsProvider instead.
/** @implements {IDevFlagsProvider} */
export class InactiveDevFlags {
  isEnabled() {
    return false;
  }

  godModeValue() {
    return undefined;
  }

  isDebugEnabled() {
    return false;
  }
}
