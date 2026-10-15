// Optional Spine capability (spec 083): imports the runtime entry once, on first need, and always resolves to an
// availability result, so a missing, broken or incompatible runtime leaves the scene on its static fallback.
// Result: { available, runtime, reason: null | "not-installed" | "import-failed" | "version-mismatch" | "factory-failed" }.
export class SpineRuntimeProvider {
  #importModule;
  #requiredVersion;
  #pending = null;

  constructor({ requiredVersion, importModule = () => import("./spine_runtime_module.js") }) {
    this.#requiredVersion = String(requiredVersion);
    this.#importModule = importModule;
  }

  load() {
    this.#pending ??= Promise.resolve().then(() => this.#importModule())
      .then((module) => this.#create(module), () => this.#unavailable("import-failed"));
    return this.#pending;
  }

  #create(module) {
    let runtime;
    try { runtime = typeof module?.createSpineRuntime === "function" ? module.createSpineRuntime() : null; }
    catch { return this.#unavailable("factory-failed"); }
    if (!runtime) return this.#unavailable("not-installed");
    // Exports must come from the same major.minor editor line as the runtime (4.2 exports need a 4.2 runtime).
    const version = String(runtime.version || "");
    if (version !== this.#requiredVersion && !version.startsWith(`${this.#requiredVersion}.`))
      return this.#unavailable("version-mismatch");
    return Object.freeze({ available: true, runtime, reason: null });
  }

  #unavailable(reason) {
    return Object.freeze({ available: false, runtime: null, reason });
  }
}
