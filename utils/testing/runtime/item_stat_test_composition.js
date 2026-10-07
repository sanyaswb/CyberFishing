"use strict";

const vm = require("node:vm");
const { bindConstructorDefaults } = require("./constructor_defaults");

// Test-only composition of the item stat collaborators, mirroring GameCompositionRoot: one
// ItemStatOverridePolicy from the configured override table and one EffectiveItemStatsResolver from
// it. `bind` returns a constructor proxy that supplies these collaborators as default options, so
// legacy-shaped checks keep constructing classes directly; explicit options still take precedence,
// and instances keep the original class identity (`instanceof`, `constructor`, prototype).
class ItemStatTestComposition {
  constructor(context) {
    this.context = context;
    const global = name => vm.runInContext(name, context);
    this.itemStatOverridePolicy = new (global("ItemStatOverridePolicy"))({ config: global("ITEM_STAT_OVERRIDE_CONFIG") });
    this.effectiveStatsResolver = new (global("EffectiveItemStatsResolver"))({ overridePolicy: this.itemStatOverridePolicy });
  }

  bind(Class, defaults) {
    return bindConstructorDefaults(Class, defaults);
  }

  // Snapshot migrations receive the composed legacy item-state migration and a snapshot mapper over
  // their own definition resolver, as InventoryCompositionRoot composes them.
  bindMigration(Class) {
    const composition = this;
    const global = name => vm.runInContext(name, this.context);
    return new Proxy(Class, {
      construct(target, [options = {}, ...rest], newTarget) {
        const overridePolicy = composition.itemStatOverridePolicy;
        const defaults = {
          itemStateMigration: new (global("LegacyItemStateMigration"))({ overridePolicy }),
          itemSnapshotMapper: new (global("InventoryItemSnapshotMapper"))({
            itemDefinitionResolver: options.itemDefinitionResolver, overridePolicy }),
          effectiveStatsResolver: composition.effectiveStatsResolver,
        };
        return Reflect.construct(target, [{ ...defaults, ...options }, ...rest], newTarget);
      },
    });
  }

  // Rebinds the named context aliases; `withPolicy` classes receive { overridePolicy },
  // `withResolver` classes receive { effectiveStatsResolver }, `migrations` are snapshot migrations.
  install({ withPolicy = [], withResolver = [], migrations = [] } = {}) {
    for (const name of migrations) this.context[name] = this.bindMigration(this.context[name]);
    for (const name of withPolicy) {
      this.context[name] = this.bind(this.context[name], { overridePolicy: this.itemStatOverridePolicy });
    }
    for (const name of withResolver) {
      this.context[name] = this.bind(this.context[name], { effectiveStatsResolver: this.effectiveStatsResolver });
    }
    return this;
  }
}

module.exports = { ItemStatTestComposition };
