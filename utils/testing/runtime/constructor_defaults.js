"use strict";

const vm = require("node:vm");

// Test-only constructor proxy that supplies composed collaborators as default options, so
// legacy-shaped checks keep constructing classes directly. Explicit options take precedence and
// instances keep the original class identity (`instanceof`, `constructor`, prototype).
function bindConstructorDefaults(Class, defaults) {
  return new Proxy(Class, {
    construct(target, args, newTarget) {
      const [options, ...rest] = args;
      const values = typeof defaults === "function" ? defaults(options || {}) : defaults;
      const merged = options === undefined ? { ...values }
        : options && typeof options === "object" && !Array.isArray(options) ? { ...values, ...options } : options;
      return Reflect.construct(target, [merged, ...rest], newTarget);
    },
  });
}

// Binds presentation descriptor factories the way GameCompositionRoot injects them:
// `bindings` maps a context alias to the descriptor class name it produces.
function installDescriptorFactories(context, bindings) {
  for (const [alias, descriptorName] of Object.entries(bindings)) {
    const Descriptor = vm.runInContext(descriptorName, context);
    context[alias] = bindConstructorDefaults(context[alias], { descriptorFactory: values => new Descriptor(values) });
  }
  return context;
}

module.exports = { bindConstructorDefaults, installDescriptorFactories };
