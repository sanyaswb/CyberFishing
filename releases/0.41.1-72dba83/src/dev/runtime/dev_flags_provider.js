// Active DEV flags: GodMode values from the override reader and debug output from the console modules.
// The port contract and the inactive production implementation live in game/application/session/inactive_dev_flags.js.
/** @implements {IDevFlagsProvider} */
export class DevFlagsProvider {
  #config;
  #godModeSource;
  #debugModulesSource;

  constructor({
    config,
    godModeSource,
    debugModulesSource,
  } = {}) {
    this.#config = config || {};
    this.#godModeSource = godModeSource;
    this.#debugModulesSource = debugModulesSource;
  }

  isEnabled(flag) {
    const source = this.#godModeSource?.();
    return !!(source && source[flag] === true);
  }

  // A raw GodMode setting for DEV overrides that are not flags (undefined without DEV).
  godModeValue(name) {
    const source = this.#godModeSource?.();
    return source ? source[name] : undefined;
  }

  isDebugEnabled() {
    const debugModules = this.#debugModulesSource?.();
    const consoleModules = {
      ...(this.#config.debug?.consoleModules || {}),
      ...(debugModules || {}),
    };
    const hasActiveConsoleModule = Object.keys(consoleModules).some(
      (key) => consoleModules[key] === true,
    );
    return !!(
      this.#config.debug?.overlay ||
      this.#config.debug?.events ||
      hasActiveConsoleModule
    );
  }
}
