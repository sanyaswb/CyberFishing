const fs = require("node:fs");
const path = require("node:path");
const { CheckAssertion } = require("./testing/core/check_assertion");
const { SourceRuntime } = require("./testing/core/source_runtime");

const ROOT = path.resolve(__dirname, "..");
const Assertion = CheckAssertion.create("Inventory-v2 cast/lure check");

class InventoryV2SourceRuntime extends SourceRuntime {
  constructor() {
    super({
      globals: {
        requestAnimationFrame: (callback) => callback(),
        CastPowerAim: class CastPowerAimStub {
          reset() {}
          update() {
            return null;
          }
          getVisualState() {
            return null;
          }
        },
        BaitFactory: {
          createCount: 0,
          create() {
            this.createCount += 1;
            return {
              cast() {},
              setPosition() {},
              setHookDepth() {},
              stopBite() {},
            };
          },
        },
      },
    });
  }
}

class LureProjectionAndBiteCheck {
  run(runtime) {
    runtime.run(`
      (() => {
        const assert = (condition, message) => {
          if (!condition) throw new Error(message);
        };
        const sameValues = (actual, expected, message) => {
          assert(
            JSON.stringify(actual) === JSON.stringify(expected),
            message + "; expected " + JSON.stringify(expected) +
              ", received " + JSON.stringify(actual),
          );
        };

        const items = new Map([
          ["rod-1", {
            id: "rod-1",
            instanceId: "rod-1",
            itemType: "rod",
            variant: "spinning",
            effectiveStats: {},
          }],
        ]);
        const itemReader = {
          getById(instanceId) {
            return items.get(instanceId) || null;
          },
        };
        const assemblyReader = {
          getChild() { return null; },
          getChildren() { return []; },
          getAssemblyState() { return null; },
          getSlotCapacity() {
            throw new Error("non-composite lure requested assembly capacity");
          },
        };
        const readModelFactory = new EquipmentReadModelFactory({
          itemReader,
          assemblyReader,
        });
        const controller = new FishingController({
          inventory: {},
          equipment: {},
          devFlags: { isEnabled: () => false },
          equipmentRules: {},
          baitRules: new BaitRules(),
        });

        const lureTypes = ["lure", "spinner", "wobbler", "jig"];
        for (const lureType of lureTypes) {
          const instanceId = lureType + "-1";
          items.set(instanceId, {
            id: instanceId,
            instanceId,
            itemType: "lure",
            variant: lureType === "lure" ? null : lureType,
            effectiveStats: {},
          });
          const equipment = readModelFactory.create({
            rootInstanceIds: {
              rod: "rod-1",
              tackle: instanceId,
            },
          });

          assert(equipment.hooks.length === 0, lureType + " must not require a fake hook");
          assert(
            equipment.baits[0]?.instanceId === instanceId,
            lureType + " must project its real item",
          );

          const candidates = [];
          controller.collectAvailableBaits(equipment, [], candidates);
          sameValues(
            candidates.map((candidate) => candidate.instanceId),
            [instanceId],
            lureType + " must reach the bite candidates",
          );
          sameValues(
            candidates.map((candidate) => candidate.variant || candidate.itemType),
            [lureType],
            lureType + " must keep its real bite type",
          );
        }

        const bait = { id: "worm", instanceId: "worm-1", itemType: "bait" };
        const candidates = [];
        controller.collectAvailableBaits(
          { hooks: [], baits: [bait] },
          [],
          candidates,
        );
        sameValues(candidates, [], "ordinary bait without a hook must stay unavailable");

        controller.collectAvailableBaits(
          { hooks: [{ id: "hook-1" }], baits: [bait] },
          [],
          candidates,
        );
        sameValues(
          candidates.map((candidate) => candidate.id),
          ["worm"],
          "ordinary bait with a hook must stay available",
        );
      })();
    `);
  }
}

class DefinitiveCastReadinessCheck {
  run(runtime) {
    runtime.run(`
      (() => {
        const assert = (condition, message) => {
          if (!condition) throw new Error(message);
        };
        const equipmentRules = {
          requiresReel: (equipment) => equipment?.rod?.variant !== "pole",
          hasEquippedLine: (equipment) =>
            (Number(equipment?.line?.effectiveStats?.lengthMeters) || 0) > 0,
          getMaxCastDistance: () => 1000,
          isFeeder: () => false,
          isSpinning: () => false,
        };
        const blockedEquipment = {
          rod: { id: "spinning-rod", itemType: "rod", variant: "spinning" },
          reel: { id: "reel-1", itemType: "reel", variant: "spinning_reel" },
          line: null,
        };
        const readiness = Object.freeze({
          canCast: false,
          shouldOpenInventory: true,
          warningCode: "reel-line-required",
          warning: "Line required",
        });
        let readinessCalls = 0;
        const service = new CastService({
          config: {},
          rng: {},
          clock: { now: 123 },
          equipmentRules,
          baitRules: new BaitRules(),
          getRodVirtualPos: () => ({ x: 0, y: 0 }),
          getDynamicBounds: () => ({}),
          castReadinessEvaluator: (equipment) => {
            readinessCalls += 1;
            assert(equipment === blockedEquipment, "readiness must evaluate the cast equipment snapshot");
            return readiness;
          },
        });

        BaitFactory.createCount = 0;
        const result = service.cast(10, 10, 2, {
          equipment: blockedEquipment,
          currentHookDepth: 1,
        });
        assert(result.success === false, "a reel without line must reject the cast");
        assert(result.reason === "missing_line", "line rejection must use the application warning reason");
        assert(result.readiness === readiness, "the domain readiness result must be preserved");
        assert(readinessCalls === 1, "the canonical readiness policy must run once per cast attempt");
        assert(BaitFactory.createCount === 0, "a rejected cast must not create a bait entity");

        const fallbackService = new CastService({
          config: {},
          rng: {},
          clock: { now: 123 },
          equipmentRules,
          baitRules: new BaitRules(),
          getRodVirtualPos: () => ({ x: 0, y: 0 }),
          getDynamicBounds: () => ({}),
        });
        const fallbackResult = fallbackService.cast(10, 10, 2, {
          equipment: blockedEquipment,
          currentHookDepth: 1,
        });
        assert(fallbackResult.success === false, "direct service usage must fail closed without line");
        assert(fallbackResult.reason === "missing_line", "fallback rejection must keep the line reason");
        assert(BaitFactory.createCount === 0, "fallback rejection must happen before entity creation");
      })();
    `);
  }
}

class ScoutingCastWarningCheck {
  run(runtime) {
    runtime.run(`
      (() => {
        const assert = (condition, message) => {
          if (!condition) throw new Error(message);
        };
        const equipment = {
          rod: { id: "rod-1", itemType: "rod", variant: "spinning" },
          reel: { id: "reel-1", itemType: "reel", variant: "spinning_reel" },
          line: null,
        };
        const readiness = Object.freeze({
          canCast: false,
          shouldOpenInventory: true,
          warningCode: "reel-line-required",
          warning: "Line required",
        });
        let warningCount = 0;
        let castCount = 0;
        let readinessCount = 0;
        const showMissingLineInventoryWarning = () => {
          warningCount += 1;
        };
        const root = {
          inventory: {
            getEquipped: () => equipment,
            evaluateCastReadiness: (candidate) => {
              readinessCount += 1;
              assert(candidate === equipment, "scouting must evaluate its current equipment snapshot");
              return readiness;
            },
          },
          config: { casting: { enabled: false } },
          projector: {},
          rng: {},
          getViewportSize: () => ({ width: 100, height: 100 }),
          equipmentRules: {
            requiresReel: () => true,
            hasEquippedLine: () => false,
          },
          castLine: () => { castCount += 1; },
          showMissingLineInventoryWarning,
        };
        const deps = new StateDepsFactory(root).create("scouting");
        assert(
          deps.commands.showMissingLineInventoryWarning === showMissingLineInventoryWarning,
          "state dependency factory must preserve the Inventory-v2 warning command",
        );

        const state = new ScoutingState(deps);
        state.handleInput({ clickPos: { x: 20, y: 20 } });
        assert(readinessCount === 1, "normal casting must consult the canonical readiness boundary");
        assert(warningCount === 1, "normal casting must open Inventory-v2 through the line warning command");
        assert(castCount === 0, "normal casting must stop before castLine when line is missing");
      })();
    `);
  }
}

class CompositionSeamCheck {
  run() {
    const bootstrap = fs.readFileSync(path.join(ROOT, "src/app/bootstrap.js"), "utf8");
    const application = fs.readFileSync(path.join(ROOT, "src/app/application.js"), "utf8");
    const inventory = fs.readFileSync(
      path.join(ROOT, "src/systems/inventory_system.js"),
      "utf8",
    );

    Assertion.that(
      bootstrap.includes("castReadinessEvaluator: (equipment) =>") &&
        bootstrap.includes("runtime.inventory.evaluateCastReadiness?.(equipment)"),
      "bootstrap must inject InventoryManager readiness into CastService",
    );
    Assertion.that(
      bootstrap.includes(
        "showMissingLineInventoryWarning: appPorts.showMissingLineInventoryWarning",
      ),
      "bootstrap must inject the line-warning command into fishing states",
    );
    Assertion.that(
      application.includes('result?.reason === "missing_line"') &&
        application.includes("this.#showMissingLineInventoryWarning();"),
      "the definitive cast result must open Inventory-v2 for a missing line",
    );
    Assertion.that(
      /evaluateCastReadiness\(equipment = null\)[\s\S]*?#inventoryV2Bridge\?\.evaluateCastReadiness/.test(
        inventory,
      ),
      "InventoryManager must delegate readiness to the Inventory-v2 bridge",
    );
  }
}

const runtime = new InventoryV2SourceRuntime();
runtime.load("src/application/inventory/equipment_read_model_factory.js");
runtime.load("src/app/rules.js");
runtime.load("src/app/fishing.js");
runtime.load("src/app/states.js");

new LureProjectionAndBiteCheck().run(runtime);
new DefinitiveCastReadinessCheck().run(runtime);
new ScoutingCastWarningCheck().run(runtime);
new CompositionSeamCheck().run();

Assertion.equal(runtime.context.BaitFactory.createCount, 0, "blocked casts created an entity");

console.log("Inventory-v2 cast/lure check passed.");
