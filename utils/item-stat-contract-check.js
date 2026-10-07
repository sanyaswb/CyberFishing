const { CheckAssertion } = require("./testing/core/check_assertion");
const { SourceRuntime } = require("./testing/core/source_runtime");

const Assertion = CheckAssertion.create("Final item stat contract check");

class ItemStatContractCheck {
  #sourceRuntime;
  #database;

  constructor() {
    this.#sourceRuntime = new SourceRuntime();
    this.#sourceRuntime.load("src/game/config/raw/items/item_database.js");
    this.#sourceRuntime.expose({
      DB: "ITEM_DB",
    });
    this.#database = this.#sourceRuntime.context.DB;
  }

  run() {
    const forbiddenTopLevel = ["level", "power", "type"];
    const forbiddenGameplayStats = [
      "level",
      "power",
      "type",
      "rigPower",
      "sensitivity",
      "assemblyProfileId",
      "requiresTag",
      "capabilities",
      "equipmentCapabilities",
    ];
    for (const [categoryId, category] of Object.entries(this.#database)) {
      for (const [itemId, item] of Object.entries(category || {})) {
        for (const key of forbiddenTopLevel) {
          Assertion.that(
            !(key in item),
            `${categoryId}.${itemId} must not expose generic ${key}`,
          );
        }
        for (const key of forbiddenGameplayStats) {
          Assertion.that(
            !(key in (item.gameplayStats || {})),
            `${categoryId}.${itemId}.gameplayStats must not contain ${key}`,
          );
        }
      }
    }

    const registry = this.#sourceRuntime.read(
      "src/game/domain/assemblies/assembly_profile_registry.js",
    );
    const capabilities = this.#sourceRuntime.read(
      "src/game/domain/equipment/rod_capability_resolver.js",
    );
    // Every inventory application module (the classic inventory classes live there one per file).
    const inventory = require("node:fs").readdirSync(require("node:path").join(__dirname, "../src/game/application/inventory"), { recursive: true })
      .filter((file) => String(file).endsWith(".js")).sort()
      .map((file) => this.#sourceRuntime.read(`src/game/application/inventory/${String(file).replaceAll("\\", "/")}`))
      .join("\n");
    const ordering = this.#sourceRuntime.read(
      "src/game/presentation/inventory/inventory_item_order_resolver.js",
    );
    const consumerSources = [registry, capabilities, inventory].join("\n");
    Assertion.that(
      !/effectiveStats\?*\.(?:assemblyProfileId|requiresTag|capabilities|equipmentCapabilities)/.test(
        consumerSources,
      ),
      "definition metadata is not read from effectiveStats",
    );
    Assertion.that(
      !ordering.includes("progressionLevel: \"ratingTier\"") &&
        !ordering.includes("power: \"rating\""),
      "runtime sorting has no generic level or power aliases",
    );
    console.log("Final item stat contract checks passed.");
  }
}

new ItemStatContractCheck().run();
