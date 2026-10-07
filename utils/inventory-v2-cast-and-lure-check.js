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
          capabilityResolver: null,
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

// Lifecycle of every game state and the state machine over a permissive dependency stub (trace evidence for Stage 4
// cluster 028): each call's result or thrown error is part of the recorded trace; the check asserts only the machine.
class StateLifecycleCheck {
  run(runtime) {
    runtime.run(`
      (() => {
        const assert = (condition, message) => {
          if (!condition) throw new Error(message);
        };
        const any = new Proxy(function stub() {}, {
          get: (target, key) => (key === Symbol.toPrimitive ? () => 0 : key === "then" ? undefined : any),
          apply: () => any,
          construct: () => any,
        });
        const bounds = { left: 0, right: 100, top: 0, bottom: 100 };
        const attempt = (operation) => {
          try {
            operation();
            return "ok";
          } catch (error) {
            return "throws";
          }
        };
        const outcomes = [];
        const states = { scouting: ScoutingState, waiting: WaitingState, biting: BitingState, playing: PlayingState,
          failed: FailedState, victory: VictoryState };
        for (const [name, State] of Object.entries(states)) {
          const deps = new StateDepsFactory(any).create(name);
          const state = new State(deps);
          outcomes.push(name + ":" + [
            attempt(() => state.enter({ reason: "line", fishData: any })),
            attempt(() => state.update(16, bounds, any)),
            attempt(() => state.handleInput({})),
            attempt(() => state.getRenderState({}, bounds)),
            attempt(() => state.exit()),
          ].join(","));
          attempt(() => state.getSelectedHookDepthMeters());
        }
        const changes = [];
        const created = [];
        class StubState {
          constructor(name) { this.name = name; }
          enter(data) { created.push(this.name + ":" + (data.step || 0)); }
          exit() {}
          handleInput() {}
          update() {}
          getRenderState() { return this.name; }
          dispose() {}
        }
        const machine = new StateMachine({
          stateRegistry: (name) => new StubState(name),
          onStateChanged: (name) => changes.push(name),
        });
        machine.setState("scouting");
        machine.update(16, bounds, {});
        machine.handleInput({});
        machine.setState("waiting", { step: 1 });
        const render = machine.getRenderState({}, bounds);
        machine.dispose();
        assert(outcomes.length === 6, "every game state ran its lifecycle");
        assert(created.join(",") === "scouting:0,waiting:1" && render === undefined && changes.length === 2,
          "the state machine enters, delegates rendering and reports state changes in order");
      })();
    `);
  }
}

class CompositionSeamCheck {
  run() {
    const bootstrap = new SourceRuntime().readAuthoredSource("src/bootstrap/production/game_composition_root.js");
    const application = new SourceRuntime().readAuthoredSource("src/bootstrap/production/game_application.js");
    const inventory = new SourceRuntime().readAuthoredSource("src/game/application/inventory/player_inventory.js");

    Assertion.that(
      bootstrap.includes("castReadinessEvaluator: (equipment) =>") &&
        bootstrap.includes("runtime.inventory.evaluateCastReadiness?.(equipment)"),
      "bootstrap must inject PlayerInventory readiness into CastService",
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
      /evaluateCastReadiness\(\)[\s\S]*?#gameplayBridge\.evaluateCastReadiness/.test(
        inventory,
      ),
      "PlayerInventory must delegate readiness to the Inventory-v2 bridge",
    );
  }
}

const runtime = new InventoryV2SourceRuntime();
runtime.load("src/game/application/inventory/equipment_read_model_factory.js");
runtime.load("src/game/domain/rules/gameplay_rules.js");
runtime.load("src/game/application/fishing/fishing_runtime_services.js");
runtime.load("src/engine/math/vector2.js");
runtime.load("src/game/domain/fishing/fishing_cast_exposure_resolver.js");
runtime.load("src/game/domain/fishing/retrieve_policy.js");
runtime.load("src/game/domain/fishing/landing_policy.js");
runtime.load("src/game/application/fishing/mutable_fight_frame_context.js");
runtime.load("src/game/application/state/game_state_machine.js");

function checkFixedCatchBaitCompatibility() {
  const assert = require('node:assert/strict');
  const source = new SourceRuntime();
  const {CONFIG} = source.importModule('src/game/config/runtime/game_config.js');
  const {WaitingState} = source.importModule('src/game/application/state/game_state_machine.js');
  const {BiteRules,BaitRules} = source.importModule('src/game/domain/rules/gameplay_rules.js');
  const {FixedCatchFishFactory} = source.importModule('src/game/application/fishing/fixed_catch_fish_factory.js');
  const template = CONFIG.spawns.fishes.find(fish=>fish.id==='crucian_stalker');
  const rules = new BiteRules(new BaitRules());
  const natural = {id:'natural-perch',biteSequence:{active:true}};
  for(const [bait,enabled,hooked] of [['spinner',true,natural],['wobbler',true,natural],['jig',true,natural],
    ['worm',true,natural],['worm',false,natural],['spinner',true,null]]) {
    let created=0,biting=null,sequence=null;
    const factory = new FixedCatchFishFactory({fishRarityResolver:{resolve(){created++;return {level:1,maxLevel:1};}},
      fishAnomalyVariantResolver:{resolve(){return {}; }},fishVisualVariantResolver:{resolveImagePath:()=>''}});
    const eq={rod:{variant:bait==='worm'?'float':'spinning'},reel:{effectiveStats:{basePower:1}}};
    const config={debug:{fixedCatch:{enabled,fishId:template.id,weight:0.8}},spawns:{fishes:[template]}};
    const state = new WaitingState({config,rng:{next:()=>0.5},getViewportSize:()=>({width:100,height:100}),
      projector:{focusOnVirtualPos(){}},commands:{panViewport(){},setState(name,data){assert.equal(name,'biting');biting=data.fish;}},
      float:{getPosition:()=>({x:0,y:0}),update(){},startBite(pulling,value){assert(value,'bite sequence must exist');sequence=value;}},
      inventory:{getEquipped:()=>eq},input:{getState:()=>({isPulling:false})},world:{getRodVirtualPos:()=>({x:0,y:1000}),getBiteEnv:()=>({locationId:'lake'})},
      rules:{equipment:{isSpinning:()=>bait!=='worm'},bite:rules},fishing:{collectAvailableBaits(eq,eaten,target){target.push({itemType:'bait',variant:bait});}},
      clock:{now:1000},getCastStartTime:()=>0,eatenBaits:[],biteSystem:{evaluateBite:()=>hooked},fixedCatchFishFactory:factory,
      services:{devFlags:{isEnabled:()=>false}}});
    state.update(16,{bottom:1000},{input:{isPulling:false},env:{}});
    const compatible = enabled && hooked && bait==='worm';
    assert.equal(created,compatible?1:0,'fixed factory only runs for supported bait: '+bait);
    if(!hooked) {assert.equal(biting,null);continue;}
    if(compatible) {assert.equal(biting.id,template.id);assert.equal(biting.weight,0.8);assert.equal(sequence,template.biteMechanics.passive);}
    else {assert.equal(biting,natural,'unsupported or disabled fixed catch preserves the naturally hooked fish');assert.equal(sequence,natural.biteSequence);}
  }
}

checkFixedCatchBaitCompatibility();
new LureProjectionAndBiteCheck().run(runtime);
new DefinitiveCastReadinessCheck().run(runtime);
new ScoutingCastWarningCheck().run(runtime);
new StateLifecycleCheck().run(runtime);
new CompositionSeamCheck().run();

Assertion.equal(runtime.context.BaitFactory.createCount, 0, "blocked casts created an entity");

console.log("Inventory-v2 cast/lure check passed.");
