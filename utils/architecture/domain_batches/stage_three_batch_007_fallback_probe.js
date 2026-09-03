"use strict";

const assert = require("node:assert/strict");
const vm = require("node:vm");
const espree = require("espree");
const estraverse = require("estraverse");
const { sha256, manifestBytes } = require("./stage_three_batch_007_manifest_transition");

const FALLBACK_SOURCE = "src/ui/inventory/inventory_v2_balance_parameter_resolver.js";
const FALLBACK_TARGET = "src/core/fishing/reel_retrieve_speed_calculator.js";

// Diagnostic only: production sources and the actual cumulative output are never modified.
class StageThreeBatch007FallbackProbe {
  run({ read, runtime, sourceBuild }) {
    const source = sourceBuild.sources.find((item) => item.currentPath === FALLBACK_TARGET);
    assert(source, "calculator must belong to the exact source/build evidence");
    const target = read(source.targetPath);
    const classic = target.replace(/^export class /u, "class ");
    const symbol = source.exportName;
    const cases = {};
    for (const mode of ["classic", "live"]) {
      for (const injected of [false, true]) {
        const context = vm.createContext({});
        if (mode === "classic") vm.runInContext(classic, context);
        else {
          vm.runInContext(read(`${runtime.output.directory}${runtime.output.runtimeFile}`), context);
          vm.runInContext(read(FALLBACK_TARGET), context);
        }
        const Calculator = vm.runInContext(symbol, context);
        vm.runInContext(read(FALLBACK_SOURCE), context);
        const options = { config: {}, reelConfig: { bearingRetrieveSpeedBonusMetersPerSec: 0.1 } };
        let fallbackReads = 0;
        if (injected) {
          options.retrieveSpeedCalculator = new Calculator();
          Object.defineProperty(context, symbol, { configurable: true, get() {
            fallbackReads += 1;
            throw new Error("Injected calculator must take precedence over global fallback");
          } });
        }
        const resolver = new context.InventoryV2BalanceParameterResolver(options);
        const result = resolver.resolve({ itemType: "reel", effectiveStats: {
          retrieveSpeedMetersPerSec: 2, bearingCount: 3, lineCapacityMeters: 10,
        } });
        cases[`${mode}-${injected ? "di" : "fallback"}`] = JSON.parse(JSON.stringify(result));
        assert.equal(fallbackReads, 0);
        if (!injected) this.#verifyUiRoutes({ context, read, resolver,
          expected: cases[`${mode}-fallback`] });
      }
    }
    assert.deepEqual(cases["classic-di"], cases["live-di"], "DI behavior changed");
    const rows = (result) => result.flatMap((section) => section.rows.map((row) => row.id));
    const before = rows(cases["classic-fallback"]);
    const after = rows(cases["live-fallback"]);
    const addedRows = after.filter((id) => !before.includes(id));
    assert.deepEqual(addedRows, ["effective-retrieve-speed", "retrieve-duration"]);
    assert.deepEqual(before.filter((id) => !after.includes(id)), []);
    assert.notDeepEqual(cases["classic-fallback"], cases["live-fallback"]);
    assert.deepEqual(cases["live-fallback"], cases["live-di"]);
    const withoutAddedRows = cases["live-fallback"].map((section) => ({ ...section,
      rows: section.rows.filter((row) => !addedRows.includes(row.id)),
    }));
    assert.deepEqual(withoutAddedRows, cases["classic-fallback"],
      "Standalone delta must not change existing rows, section shape or ordering");

    // Observe constructor call sites using AST, not substring/filename inference.
    const callSites = ["src/app/bootstrap.js", "src/ui/inventory/inventory_v2_ui.js",
      "src/ui/inventory/inventory_v2_tooltip_presenter.js"].map((path) => {
      const observations = [];
      estraverse.traverse(espree.parse(read(path), { ecmaVersion: "latest", sourceType: "script" }), {
        fallback: "iteration",
        enter(node) {
          if (node.type !== "NewExpression") return;
          const name = node.callee.type === "Identifier" ? node.callee.name : node.callee.property?.name;
          if (name !== "InventoryV2BalanceParameterResolver") return;
          const property = node.arguments[0]?.properties?.find((item) =>
            item.key?.name === "retrieveSpeedCalculator");
          observations.push({ calculatorInjected: property?.value?.type === "NewExpression" &&
            property.value.callee.name === symbol });
        },
      });
      assert.equal(observations.length, 1, `constructor site changed: ${path}`);
      return { path, ...observations[0] };
    });
    assert.deepEqual(callSites.map((site) => site.calculatorInjected), [true, false, false]);
    return {
      diagnosticScope: "isolated-real-resolver-and-live-bundle-not-browser-smoke",
      diResultsEqual: true,
      injectedGlobalReads: 0,
      standaloneResultsEqual: false,
      standaloneAddedRows: addedRows,
      beforeStandaloneRows: before,
      afterStandaloneRows: after,
      callSites,
      constructorRoutesVerified: ["standalone-tooltip", "standalone-ui-via-bootstrap",
        "injected-ui-via-bootstrap"],
      regressionCases: [
        { id: "explicit-di-preserves-historical-production-output", status: "PASS",
          beforeSha256: sha256(manifestBytes(cases["classic-di"])),
          afterSha256: sha256(manifestBytes(cases["live-di"])) },
        { id: "standalone-guarded-fallback-adds-exact-two-rows", status: "PASS",
          addedRows, existingRowsAndSectionsUnchanged: true,
          beforeSha256: sha256(manifestBytes(cases["classic-fallback"])),
          afterSha256: sha256(manifestBytes(cases["live-fallback"])) },
      ],
    };
  }

  #verifyUiRoutes({ context, read, resolver, expected }) {
    const RealResolver = context.InventoryV2BalanceParameterResolver;
    const instances = [];
    context.CONFIG = { physics: { tackle: { reel: { bearingRetrieveSpeedBonusMetersPerSec: 0.1 } } } };
    context.InventoryV2BalanceParameterResolver = new Proxy(RealResolver, {
      construct(Type, args) { const instance = new Type(...args); instances.push(instance); return instance; },
    });
    vm.runInContext(read("src/ui/inventory/inventory_v2_tooltip_presenter.js"), context);
    vm.runInContext(read("src/ui/inventory/inventory_v2_ui.js"), context);
    vm.runInContext(read("src/ui/inventory/inventory_v2_bootstrap.js"), context);
    const documentRef = { createElement: () => ({ setAttribute() {} }), body: { appendChild() {} } };
    const RealTooltip = context.InventoryV2TooltipPresenter;
    new RealTooltip({ documentRef });
    assert.equal(instances.length, 1, "standalone tooltip must construct its fallback resolver");
    const item = { itemType: "reel", effectiveStats: {
      retrieveSpeedMetersPerSec: 2, bearingCount: 3, lineCapacityMeters: 10,
    } };
    assert.deepEqual(JSON.parse(JSON.stringify(instances[0].resolve(item))), expected);
    // Isolate constructor dependency routing, not DOM rendering or browser smoke.
    context.InventoryV2FacadeContract = { assert() {} };
    for (const name of ["InventoryV2DomFactory", "InventoryV2ViewModelNormalizer", "InventoryV2LongPressController"]) {
      context[name] = class {};
    }
    const stopAfterTooltip = new Error("probe-stops-after-real-tooltip-constructor");
    let receivedResolver;
    context.InventoryV2TooltipPresenter = class extends RealTooltip {
      constructor(options) {
        super(options);
        receivedResolver = options.balanceParameterResolver;
        throw stopAfterTooltip;
      }
    };
    for (const injected of [false, true]) {
      const countBefore = instances.length;
      const options = { autoMount: false, documentRef, mountNode: documentRef.body, facade: {} };
      if (injected) options.balanceParameterResolver = resolver;
      assert.throws(() => context.InventoryV2Bootstrap.create(options), (error) => error === stopAfterTooltip);
      assert.equal(instances.length - countBefore, injected ? 0 : 1);
      assert.equal(receivedResolver, injected ? resolver : instances.at(-1));
      assert.deepEqual(JSON.parse(JSON.stringify(receivedResolver.resolve(item))), expected);
    }
  }
}

module.exports = { StageThreeBatch007FallbackProbe, FALLBACK_SOURCE, FALLBACK_TARGET };
