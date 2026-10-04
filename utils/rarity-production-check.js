const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { StageThreeCompatibilityTestLoader } = require("./testing/runtime/stage_three_compatibility_test_loader");
const {
  StageThreeRuntimeScriptAliasResolver,
} = require("./architecture/migration/stage_three_runtime_script_alias_resolver");

const ROOT = path.resolve(__dirname, "..");
const VALIDATOR_SCRIPT = "src/config/validation/rarity_config_validator.js";

class ProductionRarityConfigLoader {
  load() {
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
    const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    // Preserve the exact index prefix; active or retired aliases resolve to the same authored provider.
    const scripts = [];
    const pattern = /<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gu;
    let match = pattern.exec(html);
    while (match) {
      scripts.push(match[1]);
      const filePath = this.#toFilePath(match[1]);
      if ((aliases.get(filePath) ?? filePath) === VALIDATOR_SCRIPT) return scripts;
      match = pattern.exec(html);
    }
    throw new Error(`${VALIDATOR_SCRIPT} is not loaded by index.html`);
  }

  #toFilePath(browserPath) {
    return String(browserPath || "").split(/[?#]/u, 1)[0];
  }
}

class ProductionRarityCheck {
  run() {
    const { rarityConfig, fishDb, itemDb, mapDb, Validator } =
      new ProductionRarityConfigLoader().load();
    new Validator().assertValid({ rarityConfig, fishDb, itemDb, mapDb });
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
