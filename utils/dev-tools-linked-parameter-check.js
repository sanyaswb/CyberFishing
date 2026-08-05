const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

class Assertion {
  static that(condition, message) {
    if (!condition) {
      throw new Error(`DevTools linked parameter check failed: ${message}`);
    }
  }

  static equal(actual, expected, message) {
    this.that(
      actual === expected,
      `${message}; expected ${expected}, received ${actual}`,
    );
  }
}

class RuntimeLoader {
  load() {
    const context = vm.createContext({ console, window: {} });
    this.#run(
      context,
      "src/debug/services/dev_tools_parameter_alias_registry.js",
      ["DevToolsParameterAliasRegistry"],
    );
    this.#run(
      context,
      "src/debug/services/dev_tools_control_binding_registry.js",
      ["DevToolsControlBindingRegistry"],
    );
    return context;
  }

  #run(context, relativePath, classNames) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    const exports = classNames
      .map((className) => `globalThis.${className} = ${className};`)
      .join("\n");
    vm.runInContext(`${source}\n${exports}`, context, {
      filename: relativePath,
    });
  }
}

class DevToolsLinkedParameterCheck {
  constructor(AliasRegistry, ControlBindingRegistry) {
    this.aliases = new AliasRegistry();
    this.ControlBindingRegistry = ControlBindingRegistry;
    this.canonicalPath = [
      "CONFIG",
      "debug",
      "godMode",
      "forceAnomalyChance",
    ];
    this.aliasPath = [
      "CONFIG",
      "debug",
      "fixedCatch",
      "hasAnomaly",
    ];
  }

  run() {
    this.#checksDeclarativeAlias();
    this.#checksSharedControlBinding();
    this.#checksOverrideNormalization();
    this.#checksCanonicalConfigStorage();
    console.log("DevTools linked parameter checks passed.");
  }

  #checksDeclarativeAlias() {
    const aliases = this.aliases.getAliasesForParent(
      this.aliasPath.slice(0, -1),
    );
    Assertion.equal(aliases.length, 1, "Fixed Catch exposes one anomaly alias");
    Assertion.equal(aliases[0].key, "hasAnomaly", "alias keeps its UI key");
    Assertion.equal(
      aliases[0].canonicalPath.join("."),
      this.canonicalPath.join("."),
      "alias points to the canonical God Mode parameter",
    );
    Assertion.equal(
      this.aliases.resolveCanonicalPath(this.aliasPath).join("."),
      this.canonicalPath.join("."),
      "writes through the alias resolve to the canonical path",
    );
  }

  #checksSharedControlBinding() {
    const bindings = new this.ControlBindingRegistry();
    let godModeControl = false;
    let fixedCatchControl = false;
    bindings.register(this.canonicalPath, (value) => {
      godModeControl = value;
    });
    bindings.register(this.canonicalPath, (value) => {
      fixedCatchControl = value;
    });

    bindings.sync(this.canonicalPath, true);
    Assertion.that(
      godModeControl && fixedCatchControl,
      "all controls bound to one canonical path switch on together",
    );
    bindings.sync(this.canonicalPath, false);
    Assertion.that(
      !godModeControl && !fixedCatchControl,
      "all controls bound to one canonical path switch off together",
    );
  }

  #checksOverrideNormalization() {
    const normalized = this.aliases.normalizeConfigOverrides({
      "debug.fixedCatch.hasAnomaly": false,
      "debug.godMode.forceAnomalyChance": true,
    });
    Assertion.equal(
      Object.keys(normalized).length,
      1,
      "linked overrides collapse to one stored path",
    );
    Assertion.equal(
      normalized["debug.godMode.forceAnomalyChance"],
      true,
      "an explicit canonical override wins over a legacy alias override",
    );
  }

  #checksCanonicalConfigStorage() {
    const source = fs.readFileSync(
      path.join(ROOT, "src/config/config.js"),
      "utf8",
    );
    const fixedCatchBlock = source.match(/fixedCatch:\s*\{([\s\S]*?)\n\s*\},/u);
    Assertion.that(fixedCatchBlock, "fixedCatch config block exists");
    Assertion.that(
      !/hasAnomaly\s*:/u.test(fixedCatchBlock[1]),
      "Fixed Catch does not store a duplicate anomaly boolean",
    );
  }
}

const runtime = new RuntimeLoader().load();
new DevToolsLinkedParameterCheck(
  runtime.DevToolsParameterAliasRegistry,
  runtime.DevToolsControlBindingRegistry,
).run();
