const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { LegacyScriptOrderReader } = require("./architecture/migration/legacy_script_order_reader");
const { StageThreeCompatibilityTestLoader } = require("./testing/runtime/stage_three_compatibility_test_loader");
const {
  StageThreeRuntimeScriptAliasResolver,
} = require("./architecture/migration/stage_three_runtime_script_alias_resolver");

const ROOT = path.resolve(__dirname, "..");
const VALIDATOR_SCRIPT = "src/config/validation/rarity_config_validator.js";

class ProductionRarityConfigLoader {
  load() {
    const legacy = this.#loadLegacy();
    new legacy.Validator().assertValid(legacy);
    if (path.basename(LegacyScriptOrderReader.sourcePath(ROOT)) === "index.html") return legacy;
    const native = this.#loadNative();
    for (const key of ["rarityConfig", "fishDb", "itemDb", "mapDb"]) {
      assert.deepEqual(native[key], JSON.parse(JSON.stringify(legacy[key])), "native/DEV config parity: " + key);
    }
    return native;
  }

  #loadNative() {
    const imported = (names, file) => 'import { ' + names + ' } from ' + JSON.stringify(pathToFileURL(path.join(ROOT, file)).href) + ';';
    const source = [
      'import assert from "node:assert/strict";',
      imported("CONFIG", "src/game/config/runtime/game_config.js"),
      imported("createProductionConfigContext", "src/bootstrap/production/game_config_composition.js"),
      imported("RARITY_VISUAL_CONFIG", "src/game/presentation/rarity/rarity_visual_config.js"),
      imported("DEGRADATION_COLOR_CONFIG", "src/game/presentation/visual/degradation_color_config.js"),
      imported("FightPhysicsConfigAdapter", "src/game/config/physics/fight_physics_config_adapter.js"),
      imported("FISH_DB", "src/game/config/databases/fish_database.js"),
      imported("ITEM_DB", "src/game/config/databases/item_catalog.js"),
      imported("ITEM_DB as rawItemDb", "src/game/config/raw/items/item_database.js"),
      imported("MAP_DB", "src/game/config/raw/locations/location_database.js"),
      imported("RarityConfigValidator", "src/game/config/validation/rarity_config_validator.js"),
      imported("DegradationColorConfigValidator", "src/game/presentation/visual/degradation_color_config_validator.js"),
      'const globalsBefore = Reflect.ownKeys(globalThis);',
      'const context = createProductionConfigContext();',
      'assert.equal(CONFIG.rarity.visual, RARITY_VISUAL_CONFIG);',
      'assert.equal(CONFIG.degradationColors, DEGRADATION_COLOR_CONFIG);',
      'assert(CONFIG.fightPhysicsConfig instanceof FightPhysicsConfigAdapter);',
      'assert.equal(CONFIG.fightPhysicsConfig.config, CONFIG);',
      'const adapterDescriptor = Object.getOwnPropertyDescriptor(CONFIG, "fightPhysicsConfig");',
      'assert.equal(adapterDescriptor.enumerable, false);',
      'assert.equal(adapterDescriptor.configurable, true);',
      'assert.equal(adapterDescriptor.writable, false);',
      'assert.equal(ITEM_DB, rawItemDb);',
      'assert(Object.isFrozen(context.baseConfig));',
      'assert.equal(context.overrideStore, context.resolvedProvider.overrideStore);',
      'const data = { rarityConfig: CONFIG.rarity, fishDb: FISH_DB, itemDb: ITEM_DB, mapDb: MAP_DB };',
      'new RarityConfigValidator().assertValid(data);',
      'new DegradationColorConfigValidator().assertValid(CONFIG.degradationColors);',
      'assert.deepEqual(Reflect.ownKeys(globalThis), globalsBefore);',
      'process.stdout.write(JSON.stringify(data));',
    ].join("\n");
    const result = spawnSync(process.execPath, ["--experimental-default-type=module", "--input-type=module", "-e", source],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    assert.equal(result.status, 0, "Native rarity configuration failed:\n" + result.stderr);
    return JSON.parse(result.stdout);
  }

  #loadLegacy() {
    const contract = JSON.parse(fs.readFileSync(path.join(ROOT, "architecture/migration/stage_3_compatibility_runtime.json"), "utf8"));
    const aliases = new StageThreeRuntimeScriptAliasResolver().resolve(contract);
    const scripts = this.#readConfigScriptPaths(aliases);
    const context = vm.createContext({ console, structuredClone });
    const loader = new StageThreeCompatibilityTestLoader({ projectRoot: ROOT, context });
    for (const browserPath of scripts) {
      const relativePath = this.#toFilePath(browserPath);
      if (relativePath === contract.output.directory + contract.output.runtimeFile) loader.loadRuntime();
      else {
        const provider = aliases.get(relativePath) ?? relativePath;
        loader.load(provider, provider === VALIDATOR_SCRIPT ? ["RarityConfigValidator"] : []);
      }
    }
    vm.runInContext(
      [
        "globalThis.__RARITY_CONFIG__ = CONFIG.rarity;",
        "globalThis.__FISH_DB__ = FISH_DB;",
        "globalThis.__ITEM_DB__ = ITEM_DB;",
        "globalThis.__MAP_DB__ = MAP_DB;",
        "globalThis.__RARITY_VALIDATOR__ = RarityConfigValidator;",
      ].join("\n"),
      context,
    );
    return {
      rarityConfig: context.__RARITY_CONFIG__,
      fishDb: context.__FISH_DB__,
      itemDb: context.__ITEM_DB__,
      mapDb: context.__MAP_DB__,
      Validator: context.__RARITY_VALIDATOR__,
    };
  }

  #readConfigScriptPaths(aliases) {
    const html = fs.readFileSync(LegacyScriptOrderReader.sourcePath(ROOT), "utf8");
    // Preserve the selected classic prefix; aliases resolve to the same authored provider.
    const scripts = [];
    const pattern = /<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gu;
    let match = pattern.exec(html);
    while (match) {
      scripts.push(match[1]);
      const filePath = this.#toFilePath(match[1]);
      if ((aliases.get(filePath) ?? filePath) === VALIDATOR_SCRIPT) return scripts;
      match = pattern.exec(html);
    }
    throw new Error(`${VALIDATOR_SCRIPT} is not loaded by the selected legacy document`);
  }

  #toFilePath(browserPath) {
    return String(browserPath || "").split(/[?#]/u, 1)[0];
  }
}

class ProductionRarityCheck {
  run() {
    const { fishDb, itemDb } =
      new ProductionRarityConfigLoader().load();
    this.#assertUniqueAssets(fishDb);
    const itemCount = Object.values(itemDb).reduce(
      (total, category) => total + Object.keys(category || {}).length,
      0,
    );
    console.log(
      `Production rarity config passed for ${fishDb.length} fish species and ${itemCount} item records.`,
    );
  }

  #assertUniqueAssets(fishDb) {
    for (const fish of fishDb) {
      if (!fish?.anomalyVariant) continue;
      const pattern = String(fish.visual?.uniqueImagePattern || "").trim();
      const maxLevel = Math.max(
        1,
        Math.round(Number(fish.weightConfig?.maxLevel) || 1),
      );
      for (let level = 1; level <= maxLevel; level += 1) {
        const relativePath = pattern.replace("{level}", level);
        const absolutePath = path.resolve(ROOT, relativePath);
        if (!absolutePath.startsWith(`${ROOT}${path.sep}`)) {
          throw new Error(
            `FISH_DB.${fish.id}.visual.uniqueImagePattern escapes project root`,
          );
        }
        if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).size === 0) {
          throw new Error(
            `FISH_DB.${fish.id} unique level-${level} asset is missing: ${relativePath}`,
          );
        }
      }
    }
  }
}

new ProductionRarityCheck().run();
