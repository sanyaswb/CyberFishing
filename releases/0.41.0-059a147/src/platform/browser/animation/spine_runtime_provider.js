// Optional Spine capability (spec 083): imports the runtime entry once, on first need, and always resolves to an
// availability result, so a missing, broken or incompatible runtime leaves the scene on its static fallback.
// Result: { available, runtime, reason: null | "not-installed" | "import-failed" | "version-mismatch" | "factory-failed" }.
export class SpineRuntimeProvider {
  #importModule;
  #pending = null;

  constructor({ importModule = () => import("./spine_runtime_module.js") } = {}) {
    this.#importModule = importModule;
  }

  // exportVersion is the skeleton JSON's `skeleton.spine` (for example "4.2.43"): exports need a runtime of the same
  // major.minor editor line (owner decision, spec 083).
  load(exportVersion) {
    this.#pending ??= Promise.resolve().then(() => this.#importModule())
      .then((module) => this.#create(module), () => this.#unavailable("import-failed"));
    return this.#pending.then((result) => result.available && !this.#sameLine(result.runtime.version, exportVersion)
      ? this.#unavailable("version-mismatch") : result);
  }

  #create(module) {
    let runtime;
    try { runtime = typeof module?.createSpineRuntime === "function" ? module.createSpineRuntime() : null; }
    catch { return this.#unavailable("factory-failed"); }
    return runtime ? Object.freeze({ available: true, runtime, reason: null }) : this.#unavailable("not-installed");
  }

  #sameLine(runtimeVersion, exportVersion) {
    const line = (version) => String(version || "").split(".").slice(0, 2);
    const [runtimeMajor, runtimeMinor] = line(runtimeVersion);
    const [exportMajor, exportMinor] = line(exportVersion);
    return Boolean(exportMajor && exportMinor) && runtimeMajor === exportMajor && runtimeMinor === exportMinor;
  }

  #unavailable(reason) {
    return Object.freeze({ available: false, runtime: null, reason });
  }
}
