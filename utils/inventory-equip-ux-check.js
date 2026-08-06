const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

class Assertion {
  static that(condition, message) {
    if (!condition) {
      throw new Error(`Inventory equip UX check failed: ${message}`);
    }
  }

  static equal(actual, expected, message) {
    this.that(
      Object.is(actual, expected),
      `${message}; expected ${expected}, received ${actual}`,
    );
  }
}

class PolicyLoader {
  load() {
    const relativePath =
      "src/core/inventory/equip_target_selection_policy.js";
    const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    const context = vm.createContext({});
    vm.runInContext(
      `${source}\nglobalThis.InventoryEquipTargetSelectionPolicy = InventoryEquipTargetSelectionPolicy;`,
      context,
      { filename: relativePath },
    );
    return context.InventoryEquipTargetSelectionPolicy;
  }
}

class InventoryEquipUxCheck {
  #policy;
  #slotGroups = [
    {
      groupName: "Main",
      slots: [
        { id: "rod" },
        { id: "reel" },
        { id: "hooks_0" },
        { id: "hooks_1" },
      ],
    },
  ];

  constructor(Policy) {
    this.#policy = new Policy({
      rod: { acceptTypes: ["float", "pole"] },
      reel: { acceptTypes: ["spinning_reel"] },
      hooks: { acceptTypes: ["hook"] },
    });
  }

  run() {
    this.#checkSingleTargetUsesImmediateMode();
    this.#checkMultipleTargetsRequireChoice();
    this.#checkRejectedTargetsAreExcluded();
    this.#checkRejectedHighlightWasRemoved();
    this.#checkSlotSizeUsesSingleSource();
  }

  #checkSingleTargetUsesImmediateMode() {
    const result = this.#resolve(
      { type: "spinning_reel" },
      () => ({ isValid: true }),
    );

    Assertion.equal(result.mode, "immediate", "one valid slot equips immediately");
    Assertion.equal(result.validSlotIds.length, 1, "one target is returned");
    Assertion.equal(result.validSlotIds[0], "reel", "the reel slot is selected");
  }

  #checkMultipleTargetsRequireChoice() {
    const result = this.#resolve(
      { type: "hook" },
      () => ({ isValid: true }),
    );

    Assertion.equal(result.mode, "choose", "multiple hook slots require a choice");
    Assertion.equal(result.validSlotIds.length, 2, "both hook slots are returned");
    Assertion.that(
      result.requiresSlotChoice,
      "multiple targets enable slot-choice highlighting",
    );
  }

  #checkRejectedTargetsAreExcluded() {
    const result = this.#resolve(
      { type: "hook" },
      (slotId) =>
        slotId === "hooks_0"
          ? { isValid: true }
          : { isValid: false, reason: "Unavailable" },
    );

    Assertion.equal(
      result.mode,
      "immediate",
      "one valid target remains an immediate action",
    );
    Assertion.equal(
      result.validSlotIds.join(","),
      "hooks_0",
      "rejected slots are not exposed as targets",
    );
  }

  #checkRejectedHighlightWasRemoved() {
    const uiSource = fs.readFileSync(
      path.join(ROOT, "src/ui/ui.js"),
      "utf8",
    );
    const styleSource = fs.readFileSync(
      path.join(ROOT, "src/ui/styles/style.css"),
      "utf8",
    );

    Assertion.that(
      !uiSource.includes("highlight-rejected"),
      "UI no longer assigns rejected highlighting",
    );
    Assertion.that(
      !styleSource.includes("highlight-rejected"),
      "rejected highlighting styles are removed",
    );
  }

  #checkSlotSizeUsesSingleSource() {
    const styleSource = fs.readFileSync(
      path.join(ROOT, "src/ui/styles/style.css"),
      "utf8",
    );

    Assertion.that(
      styleSource.includes("--inventory-slot-size: 100px"),
      "inventory slot size is configured once at twice the former size",
    );
    for (const declaration of [
      "grid-template-columns: repeat(2, var(--inventory-slot-size))",
      "grid-template-columns: repeat(auto-fill, var(--inventory-slot-size))",
      "grid-auto-rows: var(--inventory-slot-size)",
      "width: var(--inventory-slot-size)",
      "height: var(--inventory-slot-size)",
    ]) {
      Assertion.that(
        styleSource.includes(declaration),
        `${declaration} uses the shared inventory slot size`,
      );
    }
    Assertion.that(
      !styleSource.includes("repeat(auto-fill, 50px)"),
      "inventory grid no longer duplicates the legacy slot size",
    );
  }

  #resolve(item, validateSlot) {
    return this.#policy.resolve({
      item,
      slotGroups: this.#slotGroups,
      validateSlot,
    });
  }
}

const Policy = new PolicyLoader().load();
new InventoryEquipUxCheck(Policy).run();
console.log("Inventory equip UX checks passed.");
