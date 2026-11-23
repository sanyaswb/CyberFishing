// DevTools controls (spec 174 stage A): what a person does to a control and what reaches the config.
const assert = require("node:assert/strict");
const { SourceRuntime } = require("../../testing/core/source_runtime");
const { TestDocument } = require("../../testing/keepnet/test_document");

const document = new TestDocument();
const createElement = document.createElement.bind(document);
// The panel shell looks up its body and footer in fixed header HTML; the double supplies them.
document.createElement = (tag) => {
  const element = createElement(tag);
  element.querySelector = (selector) => {
    const child = createElement("div");
    child.className = selector.slice(1);
    element.appendChild(child);
    return child;
  };
  return element;
};
// Rows made through DevToolsUI use the page's timers; nothing in this check waits for them.
const clipboard = [];
const runtime = new SourceRuntime({
  globals: {
    document,
    setTimeout: () => 0,
    clearTimeout() {},
    CustomEvent,
    navigator: {
      clipboard: {
        writeText: async (text) => {
          clipboard.push(text);
        },
      },
    },
  },
});
const { DevToolsUI } = runtime.importModule("src/dev/tools/dev_tools_ui.js");
const { NumberField } = runtime.importModule(
  "src/dev/tools/controls/number_field.js",
);
const { addSteps, decimalsOf, parseDecimal } = runtime.importModule(
  "src/dev/tools/controls/decimal_step.js",
);
const ui = new DevToolsUI(
  () => {},
  {},
  null,
  null,
  null,
  document.body,
  createElement("div"),
);

// --- TK-282: the number field ---------------------------------------------------------------------------------------
function numberRow(value, path = ["test", String(value)]) {
  const host = createElement("div");
  document.body.appendChild(host);
  const written = [];
  ui.createInputRow(
    "value",
    value,
    host,
    "number",
    (next) => written.push(next),
    path,
  );
  const root = document.all(
    (element) => element.className.split(" ").includes("devtools__number"),
    host,
  )[0];
  const [down, input, up] = root.children;
  return { host, root, input, down, up, written };
}
{
  const { input, up, down, written } = numberRow(0.1);
  input.fire("keydown", { key: "ArrowUp" });
  assert.deepEqual(
    written,
    [0.2],
    "0.1 stepped up is 0.2 (the owner's case: it used to become 1.1)",
  );
  input.fire("keydown", { key: "ArrowUp" });
  assert.deepEqual(
    written,
    [0.2, 0.3],
    "0.2 + 0.1 is written as 0.3, without a binary tail",
  );
  assert.equal(input.value, "0.3");
  up.fire("pointerdown", { pointerId: 1 });
  up.fire("pointerup");
  up.fire("click");
  assert.equal(written.at(-1), 0.4, "one press of + is one step, not two");
  down.fire("pointerdown", { pointerId: 1 });
  down.fire("pointerup");
  down.fire("click");
  assert.equal(written.at(-1), 0.3);
  up.fire("click");
  assert.equal(
    written.at(-1),
    0.4,
    "a click without a pointer press (keyboard) is a step too",
  );
  input.fire("keydown", { key: "ArrowUp", shiftKey: true });
  assert.equal(written.at(-1), 1.4, "Shift steps ten times further");
  input.fire("keydown", { key: "ArrowDown", altKey: true });
  assert.equal(written.at(-1), 1.39, "Alt steps a tenth");
  assert.equal(
    input.fire("keydown", { key: "ArrowUp" }).prevented,
    true,
    "the field owns its up/down keys",
  );
  assert.equal(
    written.at(-1),
    1.4,
    "after an Alt step the field keeps the finer step",
  );
  for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
    assert.equal(
      input.fire("keydown", { key }).prevented,
      false,
      `${key} is left to the caret`,
    );
  }
}
{
  const { input, written } = numberRow(0.9);
  input.fire("keydown", { key: "ArrowUp" });
  input.fire("keydown", { key: "ArrowUp" });
  assert.deepEqual(
    written,
    [1, 1.1],
    "the step stays 0.1 when the value passes a whole number",
  );
}
{
  const { input, written } = numberRow(40);
  input.fire("keydown", { key: "ArrowDown" });
  assert.deepEqual(written, [39], "a whole number steps by one");
  input.value = "0,25";
  input.fire("input");
  input.fire("keydown", { key: "Enter" });
  assert.deepEqual(written, [39, 0.25], "a decimal comma is a decimal point");
  input.fire("keydown", { key: "ArrowUp" });
  assert.equal(
    written.at(-1),
    0.26,
    "a typed finer value makes the step finer",
  );
}
{
  const { root, input, written } = numberRow(5);
  for (const text of ["", "abc", "1.2.3", "--4"]) {
    input.value = text;
    input.fire("input");
    input.fire("keydown", { key: "Enter" });
    assert.deepEqual(
      written,
      [],
      `"${text}" is never written (it used to write 0)`,
    );
    assert.equal(
      root.classList.contains("devtools__number--error"),
      true,
      "the field shows the error",
    );
    assert.equal(input.getAttribute("aria-invalid"), "true");
  }
  input.fire("blur");
  assert.equal(
    input.value,
    "5",
    "leaving the field restores the written value",
  );
  assert.equal(root.classList.contains("devtools__number--error"), false);
  input.value = "7";
  input.fire("input");
  input.fire("keydown", { key: "Escape" });
  assert.equal(input.value, "5", "Escape restores the written value");
  input.fire("blur");
  assert.deepEqual(written, [], "a focus that changes nothing writes nothing");
  input.value = "12";
  input.fire("input");
  input.fire("blur");
  assert.deepEqual(written, [12], "leaving the field writes the typed number");
}
{
  const { input, written } = numberRow(2, ["test", "bound"]);
  ui.syncValue(["test", "bound"], 0.75);
  assert.equal(input.value, "0.75", "a value changed elsewhere is shown");
  assert.deepEqual(written, [], "and not written back");
  input.fire("keydown", { key: "ArrowUp" });
  assert.deepEqual(written, [0.76]);
}
{
  // A held button repeats after a delay and stops on release and on disposal.
  const timers = new Map();
  let nextId = 1;
  const scheduler = {
    setTimeout: (callback, ms) => {
      timers.set(nextId, { callback, ms });
      return nextId++;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  const tick = () => {
    const [id, timer] = [...timers][0];
    timers.delete(id);
    timer.callback();
    return timer.ms;
  };
  const written = [];
  const field = new NumberField({
    value: 1,
    onCommit: (next) => written.push(next),
    documentRef: document,
    scheduler,
  });
  const up = field.element.children[2];
  up.fire("pointerdown", { pointerId: 1 });
  assert.deepEqual(written, [2]);
  const delay = tick(),
    repeat = tick();
  assert.deepEqual(written, [2, 3, 4], "holding + keeps stepping");
  assert.ok(
    delay > repeat,
    "the first repeat waits longer than the following ones",
  );
  up.fire("pointerup");
  assert.equal(timers.size, 0, "releasing stops the repeat");
  up.fire("pointerdown", { pointerId: 1 });
  field.dispose();
  assert.equal(timers.size, 0, "disposal stops a held button");
}
assert.equal(addSteps(0.1, 0.2, 1), 0.3);
assert.equal(addSteps(1e-7, 1e-7, 1), 2e-7);
assert.equal(decimalsOf(16777216), 0);
assert.equal(parseDecimal(" -3 "), -3);
assert.equal(parseDecimal(".5"), 0.5);
assert.equal(parseDecimal("1e3"), 1000);
assert.equal(parseDecimal("Infinity"), null);

// --- TK-283: lists ----------------------------------------------------------------------------------------------------
const { DevParameterSchema } = runtime.importModule(
  "src/dev/tools/config/dev_parameter_schema.js",
);
const byClass = (name, root) =>
  document.all((element) => element.className.split(" ").includes(name), root);
// The real species and the real config: every rule of the schema must describe a parameter the game has.
const { FISH_DB } = runtime.importModule(
  "src/game/config/databases/fish_database.js",
);
const { CONFIG } = runtime.importModule(
  "src/game/config/runtime/game_config.js",
);
const fishOptions = FISH_DB.map((fish) => ({
  value: fish.id,
  label: fish.name,
  hint: fish.id,
  imageUrl: "",
}));
const schema = new DevParameterSchema({ sources: { fish: () => fishOptions } });
{
  const fishId = CONFIG.debug.fixedCatch.fishId;
  const described = schema.describe(
    ["CONFIG", "debug", "fixedCatch", "fishId"],
    fishId,
  );
  assert.equal(
    described.control,
    "choice",
    "Fixed Catch's fish is chosen from a list",
  );
  assert.ok(
    described.options.some((option) => option.value === fishId),
    "the configured fish is one of the species",
  );
  assert.equal(described.options.length, FISH_DB.length);
  for (const key of [
    "size",
    "openSize",
    "compactShape",
    "compactPlacement",
    "compactActionsSide",
  ]) {
    const value = CONFIG.ui.inventorySelector[key];
    const options = schema
      .describe(["CONFIG", "ui", "inventorySelector", key], value)
      ?.options.map((option) => option.value);
    assert.ok(
      options?.includes(value),
      `inventorySelector.${key} = ${value} is one of its listed values`,
    );
  }
  assert.equal(
    schema.describe(
      ["CONFIG", "debug", "inventorySplit", "defaultSide"],
      "right",
    ).control,
    "segments",
  );
  assert.equal(
    schema.describe(["CONFIG", "debug", "fixedCatch", "weight"], 0.8),
    null,
    "other parameters keep their fields",
  );
  assert.equal(
    new DevParameterSchema().describe(
      ["CONFIG", "debug", "fixedCatch", "fishId"],
      fishId,
    ),
    null,
    "without the species list the parameter stays a text field",
  );
  // TK-320: text parameters with fixed modes are lists, and every configured value is one of the listed modes (a list
  // that hid the current value would rewrite it on the first touch).
  const listed = [];
  const visit = (node, path) => {
    for (const [key, value] of Object.entries(node || {})) {
      const next = [...path, key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        visit(value, next);
        continue;
      }
      if (typeof value !== "string") continue;
      const found = schema.describe(next, value);
      if (!found) continue;
      listed.push(next.join("."));
      assert.ok(
        found.options.some((option) => option.value === value),
        `${next.join(".")} = ${value} is one of its modes`,
      );
    }
  };
  visit(CONFIG, ["CONFIG"]);
  visit(CONFIG.locations.map, ["MAP_DB"]);
  for (const expected of [
    "CONFIG.debug.godMode.biteSequenceMode",
    "CONFIG.canvas.scene",
    "CONFIG.locations.cameraFollowPriority",
    "CONFIG.physics.fight.playerForceBudget.allocationMode",
    "CONFIG.physics.fight.playerPressureFatigue.source.mode",
    "CONFIG.physics.fight.rodControl.alignment.targetAnchorMode",
    "CONFIG.ui.rod.spine.bendSource",
    "CONFIG.locations.map.test.initialAlignment.x",
    "MAP_DB.test.initialAlignment.y",
    "CONFIG.radio.effects.radio.oversample",
    "CONFIG.liveBait.motionSourceSpeciesId",
  ]) {
    assert.ok(
      listed.includes(expected),
      `${expected} is chosen from a list, not typed`,
    );
  }
  assert.equal(
    JSON.stringify(
      schema
        .describe(
          ["CONFIG", "debug", "godMode", "biteSequenceMode"],
          "guaranteed",
        )
        .options.map((option) => option.value),
    ),
    JSON.stringify(["default", "normal", "guaranteed"]),
  );
  assert.equal(
    schema.describe(["CONFIG", "ui", "rod", "x"], "center"),
    null,
    "a text-or-number field stays a field",
  );
}
function choiceRow(options, value, path) {
  const host = createElement("div");
  document.body.appendChild(host);
  const written = [];
  ui.addParameter(host, {
    control: "choice",
    label: "fishId",
    options,
    value,
    onCommit: (next) => written.push(next),
    path,
  });
  const root = byClass("devtools__choice", host)[0];
  const button = byClass("devtools__choice-button", root)[0];
  return {
    host,
    root,
    button,
    written,
    options: () => byClass("devtools__choice-option", root),
    search: () => byClass("devtools__choice-search", root)[0],
  };
}
{
  const first = fishOptions[0],
    second = fishOptions[1];
  const row = choiceRow(fishOptions, first.value, ["test", "fish"]);
  assert.ok(
    row.button.textContent.includes(first.label),
    "the closed field shows the chosen fish by name",
  );
  assert.equal(row.options().length, 0, "the list is closed until asked for");
  row.button.click();
  assert.equal(row.button.getAttribute("aria-expanded"), "true");
  assert.equal(
    row.options().length,
    fishOptions.length,
    "the list offers every species",
  );
  assert.equal(
    row.options()[0].getAttribute("aria-selected"),
    "true",
    "the current fish is marked",
  );
  if (fishOptions.length >= 8) {
    // Searching by id finds the fish; nothing typed by hand reaches the config.
    row.search().value = second.hint.toUpperCase();
    row.search().fire("input");
    assert.ok(
      row.options().length >= 1 && row.options().length < fishOptions.length,
      "typing narrows the list",
    );
    assert.ok(row.options()[0].textContent.includes(second.label));
    row.search().value = "zzzz-no-such-fish";
    row.search().fire("input");
    assert.equal(row.options().length, 0);
    row.root.fire("keydown", { key: "Enter", target: row.search() });
    assert.deepEqual(
      row.written,
      [],
      "Enter on an empty result writes nothing",
    );
    row.search().value = "";
    row.search().fire("input");
  }
  // Keyboard: down to the second fish, Enter chooses it.
  const down = row.root.fire("keydown", { key: "ArrowDown" });
  assert.equal(
    down.prevented && down.stopped,
    true,
    "the list's arrows are the list's (not the page's, not the game's)",
  );
  row.root.fire("keydown", { key: "Enter" });
  assert.deepEqual(
    row.written,
    [second.value],
    "the chosen fish's id is written",
  );
  assert.equal(row.options().length, 0, "choosing closes the list");
  assert.ok(row.button.textContent.includes(second.label));
  assert.equal(
    document.activeElement,
    row.button,
    "focus returns to the field",
  );
  // Pointer: open, press a fish.
  row.button.click();
  row.options()[0].fire("click");
  assert.deepEqual(row.written, [second.value, first.value]);
  row.button.click();
  row.options()[0].fire("click");
  assert.deepEqual(
    row.written,
    [second.value, first.value],
    "choosing the current fish again writes nothing",
  );
  // Escape and focus leaving close without a change.
  row.button.click();
  row.root.fire("keydown", { key: "Escape" });
  assert.equal(row.options().length, 0);
  row.button.click();
  row.root.fire("focusout", { relatedTarget: document.body });
  assert.equal(
    row.options().length,
    0,
    "focus leaving the field closes the list",
  );
  assert.deepEqual(row.written, [second.value, first.value]);
  // A value changed elsewhere is shown.
  ui.syncValue(["test", "fish"], second.value);
  assert.ok(row.button.textContent.includes(second.label));
}
{
  const row = choiceRow(fishOptions, "no_such_fish", ["test", "unknown-fish"]);
  assert.ok(
    row.button.textContent.includes("no_such_fish"),
    "an id the game does not have stays visible",
  );
  assert.equal(
    byClass("devtools__choice-hint--unknown", row.root).length,
    1,
    "and is marked as unknown",
  );
  assert.deepEqual(row.written, []);
}
{
  const host = createElement("div");
  document.body.appendChild(host);
  const written = [];
  const options = [1, 2, 3].map((value) => ({ value, label: String(value) }));
  ui.addParameter(host, {
    control: "segments",
    label: "size",
    options,
    value: 2,
    onCommit: (next) => written.push(next),
    path: ["test", "size"],
  });
  const segments = byClass("devtools__segment", host);
  assert.deepEqual(
    segments.map((segment) => segment.textContent),
    ["1", "2", "3"],
    "every option is visible at once",
  );
  assert.deepEqual(
    segments.map((segment) => segment.getAttribute("aria-checked")),
    ["false", "true", "false"],
  );
  segments[2].click();
  assert.deepEqual(
    written,
    [3],
    "one press selects an option and writes its value (a number stays a number)",
  );
  segments[2].click();
  assert.deepEqual(written, [3], "pressing the selected option writes nothing");
  const key = segments[2].fire("keydown", { key: "ArrowRight" });
  assert.deepEqual(
    written,
    [3, 1],
    "the arrows move the selection round the group",
  );
  assert.equal(key.prevented && key.stopped, true);
  ui.syncValue(["test", "size"], 2);
  assert.equal(
    segments[1].getAttribute("aria-checked"),
    "true",
    "a value changed elsewhere is shown",
  );
  assert.deepEqual(written, [3, 1]);
}

// --- TK-293: every list is the list picker, under its label ---------------------------------------------------------
{
  const host = createElement("div");
  document.body.appendChild(host);
  const chosen = [];
  ui.createSelectRow(
    "Номер зони",
    ["1", "2", "Усі"],
    "2",
    host,
    (value) => chosen.push(value),
    ["test", "zone-number"],
    { swatches: { 1: "#ff0000" } },
  );
  assert.equal(
    document.all((element) => element.tagName === "select", host).length,
    0,
    "no browser select is left",
  );
  const root = byClass("devtools__choice", host)[0],
    button = byClass("devtools__choice-button", root)[0];
  assert.ok(
    button.textContent.includes("2"),
    "the field shows the current value",
  );
  assert.equal(
    host.children[0].classList.contains("devtools__row--stacked"),
    true,
    "the field and its list sit under the label",
  );
  assert.equal(
    host.children[0].children[1],
    root,
    "the label comes first, the field after it",
  );
  button.click();
  const options = byClass("devtools__choice-option", root);
  assert.deepEqual(
    options.map((option) => option.textContent),
    ["1", "2", "Усі"],
    "the list offers the same values",
  );
  assert.equal(
    byClass("devtools__swatch", options[0]).length,
    1,
    "a value's colour is shown in the list",
  );
  options[2].fire("click");
  assert.deepEqual(
    chosen,
    ["Усі"],
    "the section receives the chosen value as before",
  );
  assert.ok(button.textContent.includes("Усі"));
}

// --- TK-292: parameters that depend on a switch -----------------------------------------------------------------------
{
  const { DevToolsDependencyFeedback } = runtime.importModule(
    "src/dev/services/dev_tools_dependency_feedback.js",
  );
  const guardedUi = new DevToolsUI(
    () => {},
    {},
    null,
    null,
    null,
    document.body,
    createElement("div"),
    new DevToolsDependencyFeedback({
      scheduler: { setTimeout: () => 1, clearTimeout() {} },
      durationMs: 3000,
    }),
  );
  const host = createElement("div");
  document.body.appendChild(host);
  const group = { enabled: false };
  const switchPath = ["CONFIG", "test", "group", "enabled"];
  const requires = {
    requires: [{ path: switchPath, isEnabled: () => group.enabled }],
  };
  guardedUi.createSwitcherRow(
    "enabled",
    false,
    host,
    (value) => {
      group.enabled = value;
    },
    switchPath,
  );
  const switchRow = host.children[0];
  const written = [];
  const write = (name) => (value) => written.push([name, value]);
  guardedUi.createInputRow(
    "number",
    5,
    host,
    "number",
    write("number"),
    ["CONFIG", "test", "group", "number"],
    undefined,
    requires,
  );
  guardedUi.createInputRow(
    "text",
    "abc",
    host,
    "string",
    write("text"),
    ["CONFIG", "test", "group", "text"],
    undefined,
    requires,
  );
  guardedUi.addParameter(host, {
    control: "segments",
    label: "segments",
    options: [
      { value: "a", label: "a" },
      { value: "b", label: "b" },
    ],
    value: "a",
    onCommit: write("segments"),
    path: ["CONFIG", "test", "group", "segments"],
    ...requires,
  });
  guardedUi.addParameter(host, {
    control: "choice",
    label: "choice",
    options: [
      { value: "x", label: "X" },
      { value: "y", label: "Y" },
    ],
    value: "x",
    onCommit: write("choice"),
    path: ["CONFIG", "test", "group", "choice"],
    ...requires,
  });
  guardedUi.createInputRow("free", 1, host, "number", write("free"), [
    "CONFIG",
    "test",
    "free",
  ]);
  const [, numberRow, textRow, segmentsRow, choiceRow, freeRow] = host.children;
  const dependent = [numberRow, textRow, segmentsRow, choiceRow];
  const inactive = (row) =>
    row.classList.contains("devtools__row--dependency-disabled");
  const highlighted = () =>
    switchRow.classList.contains("devtools__row--blocked-prerequisite");
  assert.deepEqual(
    dependent.map(inactive),
    [true, true, true, true],
    "with the switch off every dependent row is inactive",
  );
  assert.equal(
    inactive(freeRow),
    false,
    "a parameter without that switch stays active",
  );

  // The row answers before its control: pointer, keyboard and paste are stopped and the blocking switch is shown.
  for (const type of ["pointerdown", "click", "keydown", "beforeinput"]) {
    const event = numberRow.fire(type, { key: "ArrowUp" });
    assert.equal(
      event.prevented && event.stopped,
      true,
      `${type} on an inactive row is stopped`,
    );
  }
  assert.equal(
    highlighted(),
    true,
    "an attempt highlights the switch that blocks it",
  );
  assert.equal(
    numberRow.fire("keydown", { key: "Tab" }).prevented,
    false,
    "Tab still leaves the row",
  );
  // Whatever still reaches a control is refused: nothing is written and the shown value is restored.
  const numberInput = byClass("devtools__input--number", numberRow)[0];
  numberInput.fire("keydown", { key: "ArrowUp" });
  assert.equal(numberInput.value, "5", "a number is not stepped");
  const textInput = byClass("devtools__input--text", textRow)[0];
  textInput.value = "typed";
  textInput.fire("change", { target: textInput });
  assert.equal(textInput.value, "abc", "text is restored");
  byClass("devtools__segment", segmentsRow)[1].click();
  assert.equal(
    byClass("devtools__segment", segmentsRow)[0].getAttribute("aria-checked"),
    "true",
    "the segment stays",
  );
  byClass("devtools__choice-button", choiceRow)[0].click();
  byClass("devtools__choice-option", choiceRow)[1].fire("click");
  assert.ok(
    byClass("devtools__choice-button", choiceRow)[0].textContent.includes("X"),
    "the list keeps its value",
  );
  assert.deepEqual(written, [], "nothing is written through an inactive row");

  // Turning the switch on makes the rows active at once (no rebuild) and ends the highlight.
  byClass("devtools__switch-input", switchRow)[0].checked = true;
  byClass("devtools__switch-input", switchRow)[0].fire("change", {
    target: byClass("devtools__switch-input", switchRow)[0],
  });
  assert.equal(group.enabled, true);
  assert.deepEqual(
    dependent.map(inactive),
    [false, false, false, false],
    "with the switch on the rows are active",
  );
  assert.equal(highlighted(), false);
  assert.equal(
    numberRow.fire("pointerdown").prevented,
    false,
    "an active row lets its control work",
  );
  numberInput.fire("keydown", { key: "ArrowUp" });
  byClass("devtools__segment", segmentsRow)[1].click();
  assert.equal(
    JSON.stringify(written),
    JSON.stringify([
      ["number", 6],
      ["segments", "b"],
    ]),
  );
  // Off again (from anywhere: the config changed): inactive again, the values stay shown.
  group.enabled = false;
  guardedUi.syncValue(switchPath, false);
  assert.deepEqual(
    dependent.map(inactive),
    [true, true, true, true],
    "switching off deactivates them again",
  );
  assert.equal(numberInput.value, "6", "the value stays visible");
  guardedUi.dispose();
}
{
  // The dependencies of the real config: a group's `enabled`, `<name>Enabled`, and the named master switches.
  const read = (path) =>
    path.slice(1).reduce((value, key) => value?.[key], CONFIG);
  const of = (text) =>
    JSON.stringify(
      schema
        .prerequisitesOf(text.split("."), read)
        .map((path) => path.join(".")),
    );
  assert.equal(
    of("CONFIG.debug.fixedCatch.fishId"),
    JSON.stringify(["CONFIG.debug.fixedCatch.enabled"]),
    "Fixed Catch's fish and weight depend on its switch",
  );
  assert.equal(
    of("CONFIG.debug.fixedCatch.enabled"),
    "[]",
    "a switch does not depend on itself",
  );
  assert.equal(
    of("CONFIG.canvas.rain.rings.ripple.strength"),
    JSON.stringify([
      "CONFIG.canvas.rain.enabled",
      "CONFIG.canvas.rain.rings.enabled",
      "CONFIG.canvas.rain.rings.ripple.enabled",
    ]),
    "a nested group depends on the outer switches too, outermost first",
  );
  assert.equal(
    of("CONFIG.canvas.rain.rings.enabled"),
    JSON.stringify(["CONFIG.canvas.rain.enabled"]),
  );
  assert.equal(
    of("CONFIG.debug.godMode.fixedBiteChancePercent"),
    JSON.stringify([
      "CONFIG.debug.godMode.enabled",
      "CONFIG.debug.godMode.fixedBiteChanceEnabled",
    ]),
    "<name>Enabled gates its <name>… sibling",
  );
  assert.equal(
    of("CONFIG.debug.godMode.infiniteCasting"),
    JSON.stringify(["CONFIG.debug.godMode.enabled"]),
  );
  assert.equal(
    of("CONFIG.locations.showNetZone"),
    JSON.stringify(["CONFIG.locations.debugVisuals"]),
  );
  assert.equal(
    of("CONFIG.locations.showChumZones"),
    "[]",
    "a zone the game draws without the overlay switch is independent",
  );
  assert.equal(of("CONFIG.locations.cellSize"), "[]");
  assert.equal(
    JSON.stringify(
      schema.prerequisitesOf(["ITEM_DB", "rods", "x", "enabled2"], read),
    ),
    "[]",
    "only CONFIG has switches",
  );
  for (const text of [
    "CONFIG.locations.debugVisuals",
    "CONFIG.debug.overlay",
    "CONFIG.locations.showNetZone",
    "CONFIG.locations.showLastDashZone",
    "CONFIG.locations.showCatchZone",
    "CONFIG.locations.showPoleFightSector",
    "CONFIG.locations.showFightLineRadius",
    "CONFIG.debug.overlayUpdateMs",
  ]) {
    assert.notEqual(
      read(text.split(".")),
      undefined,
      `${text} named by the schema exists in the config`,
    );
  }
}

// --- TK-303 (spec 174 C1): DevTools' own icons, no emoji ---------------------------------------------------------------
{
  const fs = require("node:fs");
  const path = require("node:path");
  const toolsRoot = path.resolve(__dirname, "../../../src/dev/tools");
  const walk = (dir) =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory()
          ? walk(path.join(dir, entry.name))
          : [path.join(dir, entry.name)],
      );
  // Emoji, the text arrows the panel used to draw (▶ ▼ ⏩) and the glyphs that stood for an icon on a button (TK-389:
  // refresh, reset, done, failed): icons replace them, the same on every platform. Arrows in prose (a path «A → B»,
  // a direction «← вліво») stay text.
  const forbidden = /[\p{Extended_Pictographic}▶▼⏩↻↺⟳⟲✓✗]/u;
  // TK-397 (spec 186 Q3): the DEV overlay too (its windows and their composition) — the same icons as DevTools.
  const overlayRoot = path.resolve(__dirname, "../../../src/dev/overlay");
  const scanned = [...walk(toolsRoot), ...walk(overlayRoot),
    path.resolve(__dirname, "../../../src/bootstrap/development/fight_balance_windows_composition.js")]
    .filter((name) => name.endsWith(".js"));
  for (const file of scanned) {
    fs.readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        assert.equal(
          forbidden.test(line),
          false,
          `${path.relative(path.resolve(__dirname, "../../.."), file)}:${index + 1} draws an emoji; use a DevTools icon`,
        );
      });
  }
  const { DEV_ICONS, createDevIcon } = runtime.importModule(
    "src/dev/tools/controls/dev_icon.js",
  );
  // Every icon a DevTools source names exists.
  const named = new Set();
  for (const file of walk(toolsRoot).filter((name) => name.endsWith(".js"))) {
    const text = fs.readFileSync(file, "utf8");
    for (const [, name] of text.matchAll(/icon: "([a-z]+)"/gu)) named.add(name);
    for (const [, name] of text.matchAll(/createDevIcon\([^,]+, "([a-z]+)"/gu))
      named.add(name);
    for (const [, name] of text.matchAll(
      /\(\) => this\.#open(?:Game|House)\(\), "([a-z]+)"/gu,
    ))
      named.add(name);
  }
  // TK-397: the overlay's headings name their icon as formatHeader's third argument.
  const overlayHeadingIcons = new Set();
  for (const file of walk(overlayRoot).filter((name) => name.endsWith(".js"))) {
    const text = fs.readFileSync(file, "utf8");
    for (const [, name] of text.matchAll(/formatHeader\([^;]*?, "#[0-9a-f]{6}", "([a-z]+)"\)/gu)) overlayHeadingIcons.add(name);
    for (const [, name] of text.matchAll(/createDevIcon\([^,]+, "([a-z]+)"/gu)) overlayHeadingIcons.add(name);
  }
  for (const name of overlayHeadingIcons) named.add(name);
  for (const name of named) assert.ok(DEV_ICONS[name], `icon "${name}" exists`);
  assert.ok(
    named.has("gear") && named.has("chevron") && named.has("map"),
    "the scan found the panel's icons",
  );
  assert.ok(["bolt", "clock", "sonar", "reset"].every((name) => overlayHeadingIcons.has(name)),
    "the scan found the overlay's icons");
  const { OverlayHtmlBuilder: HeadingBuilder } = runtime.importModule("src/dev/overlay/services/overlay_html_builder.js");
  assert.match(new HeadingBuilder().formatHeader("ПРОДУКТИВНІСТЬ", "#ffcc00", "bolt"),
    /^<div[^>]*debug-overlay__heading[^>]*><svg class="devtools__icon debug-overlay__heading-icon" viewBox="0 0 20 20" aria-hidden="true"/u,
    "an overlay heading draws its DevTools icon before the title");
  const icon = createDevIcon(document, "chevron", "devtools__section-chevron");
  assert.equal(
    icon.getAttribute("class"),
    "devtools__icon devtools__section-chevron",
  );
  assert.equal(
    icon.getAttribute("aria-hidden"),
    "true",
    "icons are decoration; the label names the control",
  );
  // The sandbox has its own RangeError: compare by name.
  assert.throws(
    () => createDevIcon(document, "nope"),
    (error) => error.name === "RangeError",
  );
  // A section title: chevron, optional icon, label; opening it is still one click.
  const host = createElement("div");
  document.body.appendChild(host);
  const content = ui.createSection(
    "Секція",
    host,
    false,
    () => {},
    ["test", "section"],
    { icon: "map" },
  );
  const title = content.parentNode.children[0];
  assert.equal(
    title.textContent,
    "Секція",
    "the title reads as its label only",
  );
  assert.equal(title.children.length, 3, "chevron, icon, label");
  title.click();
  assert.equal(title.getAttribute("aria-expanded"), "true");
  assert.equal(content.style.display, "block");
}

// --- TK-302 (spec 174 B1): one description per parameter row -------------------------------------------------------
{
  const host = createElement("div");
  document.body.appendChild(host);
  const written = [];
  const add = (spec) =>
    ui.addParameter(host, {
      onCommit: (next) => written.push([spec.label, next]),
      ...spec,
    });
  add({
    control: "numberList",
    label: "list",
    value: [1, 2],
    path: ["test", "list"],
  });
  const list = byClass("devtools__input--text", host).at(-1);
  assert.equal(list.value, "1, 2", "a number list shows its numbers");
  list.value = "3, 4;5 x";
  list.fire("change", { target: list });
  assert.equal(
    JSON.stringify(written.at(-1)),
    JSON.stringify(["list", [3, 4, 5, 0]]),
    "and writes them as numbers",
  );
  ui.syncValue(["test", "list"], [7, 8]);
  assert.equal(list.value, "7, 8");
  add({
    control: "range",
    label: "opacity",
    value: 30.4,
    path: ["test", "opacity"],
  });
  const range = byClass("devtools__range", host).at(-1);
  assert.equal(range.value, "30", "a slider shows the whole number");
  range.value = "55";
  range.fire("input", { target: range });
  assert.equal(
    JSON.stringify(written.at(-1)),
    JSON.stringify(["opacity", 55]),
    "and writes while it moves",
  );
  assert.equal(byClass("devtools__range-value", host).at(-1).textContent, "55");
  add({
    control: "text",
    label: "name",
    value: "a",
    path: ["test", "name"],
    bindingPath: null,
  });
  const name = byClass("devtools__input--text", host).at(-1);
  name.value = "b";
  name.fire("change", { target: name });
  assert.equal(
    JSON.stringify(written.at(-1)),
    JSON.stringify(["name", "b"]),
    "a text field writes its text",
  );
  let parentOn = false;
  add({
    control: "switch",
    label: "child",
    value: false,
    path: ["test", "child"],
    requires: [{ path: ["test", "parent"], isEnabled: () => parentOn }],
  });
  const childInput = byClass("devtools__switch-input", host).at(-1);
  childInput.checked = true;
  childInput.fire("change", { target: childInput });
  assert.equal(
    childInput.checked,
    false,
    "a switch whose prerequisite is off stays off",
  );
  assert.equal(
    written.some(([label]) => label === "child"),
    false,
  );
  parentOn = true;
  childInput.checked = true;
  childInput.fire("change", { target: childInput });
  assert.equal(
    JSON.stringify(written.at(-1)),
    JSON.stringify(["child", true]),
    "and turns on once it is on",
  );
}

// --- TK-299 (spec 174 B2): the one edit path, moved out of DevTools ---------------------------------------------------
{
  const { DevConfigEditService } = runtime.importModule(
    "src/dev/tools/config/dev_config_edit_service.js",
  );
  const { HookedFishEditSync } = runtime.importModule(
    "src/dev/tools/config/hooked_fish_edit_sync.js",
  );
  const { ItemStatAliasSync } = runtime.importModule(
    "src/dev/tools/config/item_stat_alias_sync.js",
  );
  const { DevToolsParameterAliasRegistry } = runtime.importModule(
    "src/dev/services/dev_tools_parameter_alias_registry.js",
  );
  const events = [],
    synced = [],
    logs = [],
    sets = [],
    resets = [];
  const config = {
    debug: {
      consoleModules: { forces: false },
      fixedCatch: {},
      godMode: { forceAnomalyChance: false },
    },
    canvas: { rain: { opacity: 1 } },
  };
  const overrides = {
    "canvas.rain.opacity": 0.5,
    "canvas.rain": {},
    "canvas.rainy": 1,
  };
  const configRuntime = {
    set: (path, value) => {
      sets.push(path.join("."));
      let target = config;
      for (const key of path.slice(1, -1)) target = target[key];
      target[path.at(-1)] = value;
    },
    exportOverrides: () => overrides,
    reset: (key) => resets.push(key),
  };
  const rod = {
    itemType: "rod",
    displayStats: { level: 3, power: 4 },
    gameplayStats: { equipmentPowerLevel: 3, basePower: 4 },
  };
  const fish = {
    id: "carp",
    weight: 1,
    physics: { forceProfile: { basePower: 2 } },
  };
  const synchronizations = [];
  const modules = {};
  const edits = new DevConfigEditService({
    config,
    catalogs: { items: { rods: { rod } }, fishes: [{ id: "carp" }], maps: {} },
    configRuntime,
    configValidation: { report() {} },
    parameterAliases: new DevToolsParameterAliasRegistry(),
    getHookedFish: () => fish,
    hookedFishSync: new HookedFishEditSync({
      fishes: [{ id: "carp" }],
      synchronizer: {
        synchronize: (input) => {
          synchronizations.push(input.changedKey);
          return { range: { basePower: 7, baseSpeed: 1.5 } };
        },
      },
    }),
    itemStatSync: new ItemStatAliasSync({ items: { rods: { rod } } }),
    debugModulesSource: () => modules,
    syncValue: (path, value) => synced.push([path.join("."), value]),
    eventTarget: {
      dispatchEvent: (event) =>
        events.push([
          event.type,
          JSON.stringify(event.detail.path ?? event.detail.module),
        ]),
    },
    logger: { log: (...args) => logs.push(args.join(" ")) },
  });
  edits.update(["CONFIG", "debug", "consoleModules", "forces"], true);
  assert.equal(
    sets.at(-1),
    "CONFIG.debug.consoleModules.forces",
    "CONFIG goes through the override store",
  );
  assert.equal(
    modules.forces,
    true,
    "a console module switch reaches the console's module list",
  );
  assert.equal(
    JSON.stringify(events.splice(0)),
    JSON.stringify([
      ["debug-module-toggled", '"forces"'],
      ["config-updated", '["CONFIG","debug","consoleModules","forces"]'],
    ]),
  );
  assert.equal(
    JSON.stringify(synced.at(-1)),
    JSON.stringify(["CONFIG.debug.consoleModules.forces", true]),
    "the panel's controls are synced",
  );
  edits.update(["CONFIG", "debug", "fixedCatch", "hasAnomaly"], true);
  assert.equal(
    sets.at(-1),
    "CONFIG.debug.godMode.forceAnomalyChance",
    "a linked parameter is written at its canonical path",
  );
  edits.update(["ITEM_DB", "rods", "rod", "displayStats", "power"], 9);
  assert.equal(
    rod.gameplayStats.basePower,
    9,
    "an item's display stat keeps its gameplay stat equal",
  );
  edits.update(
    ["ITEM_DB", "rods", "rod", "gameplayStats", "equipmentPowerLevel"],
    5,
  );
  assert.equal(rod.displayStats.level, 5, "and the other way round");
  assert.ok(
    events.some(([type]) => type === "item-progression-updated"),
    "an item edit invalidates the item progression view",
  );
  events.length = 0;
  edits.update(["HOOKED_FISH", "weight"], 2);
  assert.equal(fish.weight, 2);
  assert.equal(
    JSON.stringify(synchronizations),
    JSON.stringify(["weight"]),
    "a weight edit recomputes the level balance",
  );
  assert.equal(fish.physics.levelBasePower, 7);
  assert.equal(fish.physics.movementProfile.baseSpeed, 1.5);
  edits.update(["HOOKED_FISH", "physics", "forceProfile", "basePower"], 3);
  assert.equal(
    fish.physics.basePower,
    3,
    "a profile field updates its physics alias",
  );
  assert.equal(
    JSON.stringify(events.map(([type]) => type)),
    JSON.stringify(["debug-hooked-fish-updated", "debug-hooked-fish-updated"]),
    "the hooked fish is announced as such, never as a config edit",
  );
  assert.equal(
    edits.read(["HOOKED_FISH", "physics", "basePower"]),
    3,
    "read reaches every root",
  );
  assert.equal(edits.read(["NOWHERE", "x"]), undefined);
  events.length = 0;
  const rainBefore = config.canvas.rain;
  edits.resetOverrideTree(["canvas", "rain"]);
  assert.equal(
    JSON.stringify(resets),
    JSON.stringify(["canvas.rain.opacity", "canvas.rain"]),
    "a subtree reset drops that subtree's overrides only (not canvas.rainy)",
  );
  assert.equal(events.at(-1)[0], "config-updated");
  assert.equal(rainBefore, config.canvas.rain);
}

// --- TK-300 (spec 174 B4): sections remembered by their place; a new fish on the hook redraws only its sections ------
{
  const { DevTools } = runtime.importModule("src/dev/tools/dev_tools.js");
  const stored = new Map([["dev_tools_sections_state", { x: true }]]);
  const storageCache = {
    get: (key, fallback) => stored.get(key) ?? fallback,
    set: (key, value) => stored.set(key, JSON.parse(JSON.stringify(value))),
    remove: (key) => stored.delete(key),
  };
  const panelUi = new DevToolsUI(
    () => {},
    {},
    null,
    null,
    null,
    document.body,
    createElement("div"),
  );
  const tools = new DevTools(
    { debug: { x: { a: 1 } }, x: { b: 2 } },
    { synchronize() {} },
    {
      catalogs: { items: {}, fishes: [], maps: {} },
      settingsStore: null,
      debugModulesSource: () => ({}),
      storageCache,
      createUI: () => ({
        ui: panelUi,
        tooltipProvider: { ready: new Promise(() => {}) },
      }),
    },
  );
  assert.equal(
    stored.has("dev_tools_sections_state"),
    false,
    "the title-keyed states of before are dropped",
  );
  tools.toggle();
  const body = panelUi.body;
  const sectionTitled = (title, root = body) =>
    document.all(
      (element) =>
        element.className === "devtools__section-title" &&
        element.textContent === title,
      root,
    );
  const isOpen = (title) =>
    title.parentNode.children[1].style.display === "block";
  const [firstX, secondX] = sectionTitled("x");
  assert.ok(
    firstX && secondX && !isOpen(firstX) && !isOpen(secondX),
    "two sections titled x, both closed (the old x: true is gone)",
  );
  firstX.click();
  tools.toggle();
  tools.toggle();
  const [firstAgain, secondAgain] = sectionTitled("x");
  assert.equal(
    isOpen(firstAgain),
    true,
    "the opened section is open after a redraw",
  );
  assert.equal(
    isOpen(secondAgain),
    false,
    "a section with the same title elsewhere keeps its own state (it used to open too)",
  );
  assert.match(
    JSON.stringify([...stored.values()]),
    /\/CONFIG(\.debug)?\/CONFIG(\.debug)?\.x"/u,
    "kept by place, not by title",
  );

  // The hooked fish: only its own sections are drawn again.
  body.scrollTop = 480;
  const before = body.children.slice();
  const fish = (id, weight) => ({
    detail: {
      hookedFish: {
        id,
        level: 1,
        weight,
        physics: { forceProfile: { power: 2 } },
      },
    },
  });
  document.fire("debug-live-update", fish("carp", 1));
  const fishSection = () =>
    sectionTitled("ACTIVE FISH (carp)").length +
    sectionTitled("ACTIVE FISH (perch)").length;
  assert.equal(fishSection(), 1, "the fish's section appears");
  assert.equal(
    JSON.stringify(
      body.children.filter((node) => !before.includes(node)).length,
    ),
    "0",
    "nothing else in the panel is replaced",
  );
  assert.ok(
    before.every((node) => node.parentNode === body),
    "every other section is the same node",
  );
  assert.equal(body.scrollTop, 480, "the panel keeps its scroll");
  document.fire("debug-live-update", fish("perch", 2));
  assert.equal(
    sectionTitled("ACTIVE FISH (perch)").length,
    1,
    "another fish replaces it",
  );
  assert.equal(sectionTitled("ACTIVE FISH (carp)").length, 0);
  document.fire("debug-live-update", { detail: {} });
  assert.equal(fishSection(), 0, "no fish, no section");
  tools.dispose();
}

// --- TK-305 (spec 174 C3): names, descriptions, changed values, search -----------------------------------------------
{
  const provider = {
    describe: (path, key) =>
      path === "CONFIG.rain.opacity"
        ? { name: "Непрозорість дощу", description: "Наскільки видно краплі." }
        : key === "kind"
          ? { name: "вид", description: "Вид крапель." }
          : key === "speed"
            ? { name: "швидкість", description: "" }
            : null,
    dispose() {},
  };
  const searchUi = new DevToolsUI(
    () => {},
    {},
    provider,
    null,
    null,
    document.body,
    createElement("div"),
  );
  const pages = searchUi.createPages(
    [
      { id: "a", title: "A", icon: "hook" },
      { id: "b", title: "B", icon: "map" },
    ],
    "a",
    () => {},
  );
  const changed = new Set(["CONFIG.rain.opacity"]);
  const resets = [];
  const sectionOf = (page, title) =>
    searchUi.createSection(title, page, false, () => {}, ["SECTION", title]);
  const rain = sectionOf(pages.get("b"), "rain");
  const add = (parent, key, path) =>
    searchUi.addParameter(parent, {
      control: "number",
      label: key,
      value: 1,
      onCommit() {},
      path,
      isChanged: () => changed.has(path.join(".")),
      onReset: () => {
        resets.push(path.join("."));
        changed.delete(path.join("."));
      },
    });
  add(rain, "opacity", ["CONFIG", "rain", "opacity"]);
  add(rain, "speed", ["CONFIG", "rain", "speed"]);
  add(pages.get("a"), "flag", ["CONFIG", "flag"]);
  searchUi.addParameter(rain, {
    control: "choice",
    label: "kind",
    value: "a",
    onCommit() {},
    path: ["CONFIG", "rain", "kind"],
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
  });
  const rowOf = (key) =>
    byClass("devtools__row", searchUi.body).find(
      (row) => row.children[0]?.dataset?.devtoolsKey === key,
    );
  const opacity = rowOf("opacity");
  // TK-314: the label is the key and the «i» right after it, nothing else; the name, description and path are in the hint.
  const opacityLabel = opacity.children[0];
  assert.equal(
    JSON.stringify(opacityLabel.children.map((child) => child.className)),
    JSON.stringify([
      "devtools__label-key",
      "devtools__info",
      "devtools__copy-key",
    ]),
    "the label holds only the key, «i» and the copy button beside it (TK-315)",
  );
  assert.equal(
    byClass("devtools__label-key", opacity)[0].innerText,
    "opacity",
    "the key comes first, as in the code",
  );
  const info = byClass("devtools__info", opacity)[0];
  const description = byClass("devtools__description", opacity)[0];
  assert.equal(description.hidden, true);
  // TK-314.1 on the old order (label, hint, control) fails here: the control must come before the hint.
  assert.ok(
    opacity.children.indexOf(description) > 1,
    "the hint is not between the label and the number field",
  );
  info.click();
  assert.equal(
    description.hidden,
    false,
    "«i» opens the hint under the row (reachable by touch)",
  );
  assert.equal(info.getAttribute("aria-expanded"), "true");
  assert.equal(
    JSON.stringify(
      description.children.map((line) => [line.className, line.innerText]),
    ),
    JSON.stringify([
      ["devtools__description-name", "Непрозорість дощу"],
      ["devtools__description-text", "Наскільки видно краплі."],
      ["devtools__description-path", "CONFIG.rain.opacity"],
    ]),
    "the hint holds the name, the description and the path",
  );
  const speedLabel = rowOf("speed").children[0];
  assert.equal(
    speedLabel.children.length,
    3,
    "a name alone (no description) is in the hint too, not on the row",
  );
  // TK-314.1: the hint follows the control, so opening it never moves the control under it; a list's hint sits between
  // its label and its field.
  assert.equal(
    opacity.children.at(-1),
    description,
    "the hint is the row's last child",
  );
  assert.ok(
    opacity.children.indexOf(description) >
      opacity.children.findIndex((child) =>
        child.className?.includes?.("devtools__number"),
      ),
    "the number field stays before the hint",
  );
  const kind = rowOf("kind");
  assert.equal(
    JSON.stringify(kind.children.map((child) => child.className.split(" ")[0])),
    JSON.stringify([
      "devtools__label",
      "devtools__description",
      kind.children.at(-1).className.split(" ")[0],
    ]),
    "a list: label, hint, then its field",
  );
  assert.notEqual(
    kind.children.at(-1).className.split(" ")[0],
    "devtools__description",
  );
  // TK-315: the copy button puts the key as in the code on the clipboard (for Ctrl+Shift+F) and says so.
  byClass("devtools__copy-key", rowOf("speed"))[0].click();
  setTimeout(() => {
    assert.ok(
      clipboard.includes("speed"),
      "the copy button copies the parameter's key",
    );
  }, 0);
  info.click();
  byClass("devtools__info", rowOf("speed"))[0].click();
  assert.equal(
    JSON.stringify(
      byClass("devtools__description", rowOf("speed"))[0].children.map(
        (line) => line.innerText,
      ),
    ),
    JSON.stringify(["швидкість", "CONFIG.rain.speed"]),
  );
  assert.equal(
    byClass("devtools__info", rowOf("flag")).length,
    0,
    "nothing to tell, no «i»",
  );
  // Changed values: marked, reset one by one, the mark follows syncs.
  assert.equal(
    opacity.classList.contains("devtools__row--changed"),
    true,
    "a changed value is marked",
  );
  assert.equal(
    rowOf("speed").classList.contains("devtools__row--changed"),
    false,
  );
  byClass("devtools__reset", opacity)[0].click();
  assert.equal(
    JSON.stringify(resets),
    JSON.stringify(["CONFIG.rain.opacity"]),
    "its reset puts that one parameter back",
  );
  searchUi.syncValue(["CONFIG", "rain", "opacity"], 1);
  assert.equal(
    opacity.classList.contains("devtools__row--changed"),
    false,
    "the mark follows the sync after the reset",
  );
  changed.add("CONFIG.rain.speed");
  searchUi.syncValue(["CONFIG"], {});
  assert.equal(
    rowOf("speed").classList.contains("devtools__row--changed"),
    true,
    "an import or reset of all refreshes every mark",
  );
  // Search: every module, in place, editable; sections open for the search and close after it.
  const panel = searchUi.body.parentNode;
  const input = byClass("devtools__search-input", panel)[0];
  const status = byClass("devtools__search-status", panel)[0];
  const search = (query) => {
    input.value = query;
    input.fire("input");
  };
  const body = searchUi.body;
  search("ДОЩУ");
  assert.equal(body.classList.contains("devtools__body--filtered"), true);
  assert.equal(
    opacity.classList.contains("devtools__row--match"),
    true,
    "found by its Ukrainian name, any case",
  );
  assert.equal(rowOf("flag").classList.contains("devtools__row--match"), false);
  assert.equal(
    rain.style.display,
    "block",
    "the section holding a match opens",
  );
  assert.equal(
    pages.get("b").classList.contains("devtools__page--match"),
    true,
    "a match in another module shows that module",
  );
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, "Знайдено: 1");
  search("config.flag");
  assert.equal(
    rowOf("flag").classList.contains("devtools__row--match"),
    true,
    "found by its path",
  );
  assert.equal(
    rain.style.display,
    "none",
    "a section opened by the search closes again",
  );
  search("nothing-like-this");
  assert.equal(status.textContent, "Нічого не знайдено");
  const escape = input.fire("keydown", { key: "Escape" });
  assert.equal(escape.stopped, true, "Escape clears the search, not the panel");
  assert.equal(input.value, "");
  assert.equal(body.classList.contains("devtools__body--filtered"), false);
  assert.equal(status.hidden, true);
  // Changed only.
  const filter = byClass("devtools__filter", panel)[0];
  filter.click();
  assert.equal(filter.getAttribute("aria-pressed"), "true");
  assert.equal(
    rowOf("speed").classList.contains("devtools__row--match"),
    true,
    "«Змінені» shows the changed values",
  );
  assert.equal(opacity.classList.contains("devtools__row--match"), false);
  filter.click();
  assert.equal(body.classList.contains("devtools__body--filtered"), false);
  // TK-319: the reveal mode keeps every row, opens the matches and steps through them with Enter / Shift+Enter.
  searchUi.setPanelOptions({ searchMode: "reveal" });
  search("rain");
  assert.equal(
    body.classList.contains("devtools__body--filtered"),
    false,
    "nothing is hidden",
  );
  assert.equal(body.classList.contains("devtools__body--revealing"), true);
  assert.equal(
    rain.style.display,
    "block",
    "the section holding a match opens",
  );
  // TK-319.1: typing does not move the panel; Enter (the phone keyboard's search key) does.
  assert.equal(
    byClass("devtools__row--current-match", body).length,
    0,
    "typing marks the matches but goes to none",
  );
  assert.equal(
    pages.get("b").hidden,
    true,
    "nor switches the module while a word is typed",
  );
  assert.equal(status.textContent, "Знайдено: 3 · Enter — перейти");
  input.fire("keydown", { key: "Enter" });
  assert.equal(
    opacity.classList.contains("devtools__row--current-match"),
    true,
    "Enter goes to the first match",
  );
  assert.equal(pages.get("b").hidden, false, "and shows its module");
  assert.equal(status.textContent, "Збіг 1 з 3 · Enter — далі");
  input.fire("keydown", { key: "Enter" });
  assert.equal(
    rowOf("speed").classList.contains("devtools__row--current-match"),
    true,
    "Enter goes to the next match",
  );
  assert.equal(
    opacity.classList.contains("devtools__row--current-match"),
    false,
  );
  input.fire("keydown", { key: "Enter", shiftKey: true });
  assert.equal(
    opacity.classList.contains("devtools__row--current-match"),
    true,
    "Shift+Enter goes back",
  );
  input.fire("keydown", { key: "Enter", shiftKey: true });
  assert.equal(
    rowOf("kind").classList.contains("devtools__row--current-match"),
    true,
    "and wraps round",
  );
  search("config.flag");
  assert.equal(
    pages.get("a").hidden,
    true,
    "typing a match in another module does not switch to it",
  );
  input.fire("keydown", { key: "Enter", shiftKey: true });
  assert.equal(
    pages.get("a").hidden,
    false,
    "Enter (here Shift+Enter, the last match) switches to its module",
  );
  assert.equal(
    rowOf("flag").classList.contains("devtools__row--current-match"),
    true,
  );
  assert.equal(
    rain.style.display,
    "none",
    "the section opened for the earlier search closes",
  );
  search("");
  assert.equal(body.classList.contains("devtools__body--revealing"), false);
  assert.equal(
    byClass("devtools__row--current-match", body).length,
    0,
    "no mark stays after the search",
  );
  searchUi.setPanelOptions({ searchMode: "filter" });
  searchUi.dispose();
}
{
  // The edit path: whether a parameter is changed, and putting one back.
  const { DevConfigEditService } = runtime.importModule(
    "src/dev/tools/config/dev_config_edit_service.js",
  );
  const { DevToolsParameterAliasRegistry } = runtime.importModule(
    "src/dev/services/dev_tools_parameter_alias_registry.js",
  );
  const config = { rain: { opacity: 0.5 } };
  const overrides = new Set(["rain.opacity"]);
  const events = [],
    synced = [];
  const edits = new DevConfigEditService({
    config,
    catalogs: {},
    parameterAliases: new DevToolsParameterAliasRegistry(),
    configRuntime: {
      overrideStore: { has: (key) => overrides.has(key) },
      reset: (path) => {
        overrides.delete(path.slice(1).join("."));
        config.rain.opacity = 1;
      },
    },
    getHookedFish: () => null,
    hookedFishSync: { afterEdit() {} },
    itemStatSync: { afterEdit() {} },
    debugModulesSource: () => ({}),
    syncValue: (path, value) => synced.push([path.join("."), value]),
    eventTarget: { dispatchEvent: (event) => events.push(event.type) },
    logger: { log() {} },
  });
  assert.equal(edits.isOverridden(["CONFIG", "rain", "opacity"]), true);
  edits.resetParameter(["CONFIG", "rain", "opacity"]);
  assert.equal(edits.isOverridden(["CONFIG", "rain", "opacity"]), false);
  assert.equal(
    JSON.stringify(synced),
    JSON.stringify([["CONFIG.rain.opacity", 1]]),
    "the panel shows the code's value",
  );
  assert.equal(
    JSON.stringify(events),
    JSON.stringify(["config-updated"]),
    "the game hears it like an edit",
  );
}

// --- TK-306 (spec 174 C4): deep sections open inside, with breadcrumbs ------------------------------------------------
{
  const drillUi = new DevToolsUI(
    () => {},
    {},
    null,
    null,
    null,
    document.body,
    createElement("div"),
  );
  const pages = drillUi.createPages(
    [
      { id: "config", title: "Конфіг", icon: "sliders" },
      { id: "other", title: "Інше", icon: "map" },
    ],
    "config",
    () => {},
  );
  const page = pages.get("config");
  const toggles = [];
  const section = (title, parent, path) =>
    drillUi.createSection(
      title,
      parent,
      false,
      (open) => toggles.push([title, open]),
      path,
    );
  const root = section("НАЛАШТУВАННЯ", page, ["CONFIG"]);
  const physics = section("physics", root, ["CONFIG", "physics"]);
  const fight = section("fight", physics, ["CONFIG", "physics", "fight"]);
  const rod = section("rodControl", fight, [
    "CONFIG",
    "physics",
    "fight",
    "rodControl",
  ]);
  drillUi.addParameter(rod, {
    control: "number",
    label: "ratio",
    value: 2,
    onCommit() {},
    path: ["CONFIG", "physics", "fight", "rodControl", "ratio"],
  });
  const titleOf = (content) => content.parentNode.children[0];
  const fightSection = titleOf(fight).parentNode;
  assert.equal(
    titleOf(physics).parentNode.classList.contains("devtools__section--drill"),
    false,
    "two levels stay in place",
  );
  assert.equal(
    fightSection.classList.contains("devtools__section--drill"),
    true,
    "the third level opens inside",
  );
  titleOf(root).click();
  titleOf(physics).click();
  titleOf(fight).click();
  assert.equal(
    page.classList.contains("devtools__page--drilled"),
    true,
    "the page shows the section alone",
  );
  assert.equal(
    fight.parentNode.className,
    "devtools__drill",
    "its content is in the page's drill area",
  );
  assert.equal(fight.style.display, "block");
  assert.equal(
    toggles.some(([title]) => title === "fight"),
    false,
    "a drill-in is not an open/closed state to remember",
  );
  const crumbs = () =>
    byClass("devtools__crumb", page).map((crumb) => crumb.textContent);
  assert.deepEqual(
    crumbs(),
    ["Конфіг", "НАЛАШТУВАННЯ", "physics", "fight"],
    "breadcrumbs: module, every section above, here",
  );
  // Deeper again: rodControl opens inside fight's place.
  titleOf(rod).click();
  assert.deepEqual(crumbs(), [
    "Конфіг",
    "НАЛАШТУВАННЯ",
    "physics",
    "fight",
    "rodControl",
  ]);
  assert.equal(
    fight.parentNode,
    fightSection,
    "the previous drill-in went back to its place",
  );
  // A crumb back to a drill section shows it; a crumb to an inline section leaves the drill-in and shows it in place.
  byClass("devtools__crumb", page)
    .find((crumb) => crumb.textContent === "fight")
    .click();
  assert.equal(crumbs().at(-1), "fight");
  byClass("devtools__crumb", page)
    .find((crumb) => crumb.textContent === "physics")
    .click();
  assert.equal(page.classList.contains("devtools__page--drilled"), false);
  assert.equal(byClass("devtools__crumbs", page).length, 0);
  assert.equal(
    fight.parentNode,
    fightSection,
    "every row is back in its own place",
  );
  // A reveal (an overlay link) of a parameter inside opens its innermost drill-in.
  drillUi.selectPage("other");
  assert.equal(
    drillUi.revealPath(["CONFIG", "physics", "fight", "rodControl", "ratio"]),
    true,
  );
  assert.equal(page.hidden, false, "its module is shown");
  assert.equal(crumbs().at(-1), "rodControl", "and the section holding it");
  // A search works on the whole tree: it leaves the drill-in.
  const input = byClass("devtools__search-input", drillUi.body.parentNode)[0];
  input.value = "ratio";
  input.fire("input");
  assert.equal(page.classList.contains("devtools__page--drilled"), false);
  drillUi.dispose();
}

// --- TK-306.1 (I-31): a drill-in section with a description «i» opens again after leaving -----------------------------
// The owner (2026-11-23): after «i» on «Зорепад» the panel went empty and the «i» sat in the panel's corner over the
// close button. Leaving a drill-in put the content after the «i», and the next drill-in took the section's second child
// — the «i» — for its content.
{
  const infoDrillUi = new DevToolsUI(
    () => {},
    {},
    null,
    null,
    null,
    document.body,
    createElement("div"),
  );
  const page = infoDrillUi
    .createPages([{ id: "game", title: "Гра", icon: "map" }], "game", () => {})
    .get("game");
  const section = (title, parent) =>
    infoDrillUi.createSection(title, parent, false, () => {}, null);
  const root = section("РАНДОМАЙЗЕР", page);
  const probes = section("Погода", root);
  const starfall = section("Зорепад", probes);
  infoDrillUi.createInfoRow("зорепадних ночей", "3", starfall);
  const starfallSection = starfall.parentNode;
  const infoButton = byClass("devtools__section-info-button", starfallSection)[0];
  const titleOf = (content) => content.parentNode.children[0];
  titleOf(root).click();
  titleOf(probes).click();
  const crumbTo = (text) =>
    byClass("devtools__crumb", page).find((crumb) => crumb.textContent === text).click();
  const assertDrilledIn = (how) => {
    const host = byClass("devtools__drill", page)[0];
    assert.ok(host, `${how}: the page shows the section alone`);
    assert.equal(host.children.length, 1, `${how}: one thing in the drill area`);
    // Nodes are compared by identity (assert.equal would diff the whole tree on a failure).
    assert.ok(host.children[0] === starfall, `${how}: the drill area holds the section's content, not its «i»`);
    // TK-390: the hidden section's «i» stands at the right of the crumbs while the section is shown alone.
    const crumbs = byClass("devtools__crumbs", page)[0];
    assert.ok(infoButton.parentNode === crumbs && crumbs.children.at(-1) === infoButton,
      `${how}: the «i» is the crumbs' last part`);
  };
  const description = byClass("devtools__section-info", starfall)[0];
  starfallSection.children[0].click();
  assertDrilledIn("the title the first time");
  crumbTo("Погода");
  assert.ok(starfall.parentNode === starfallSection, "the content is back in its section");
  assert.ok(starfallSection.children[1] === starfall, "back in its own place: after the title, before the «i»");
  assert.ok(starfallSection.children[2] === infoButton, "TK-390: the «i» is back in its section, its last part");
  // The owner's case: «i» of a closed section opens it (a drill-in) with its description.
  infoButton.click();
  assertDrilledIn("«i» after leaving");
  assert.equal(description.hidden, false, "«i» opens the description");
  crumbTo("Гра");
  starfallSection.children[0].click();
  assertDrilledIn("the title after leaving again");
  // TK-390 (owner): entered by the title, the description opens and closes from the crumbs' «i».
  description.hidden = true;
  infoButton.click();
  assert.equal(description.hidden, false, "TK-390: the crumbs' «i» opens the description inside");
  infoButton.click();
  assert.equal(description.hidden, true, "and closes it");
  // A redraw of the shown section's own rows makes its «i» again — in the crumbs, not in the hidden section.
  infoDrillUi.redraw(starfall, () => infoDrillUi.createInfoRow("зорепадних ночей", "4", starfall));
  const redrawnInfo = byClass("devtools__section-info-button", page);
  assert.equal(redrawnInfo.length, 1, "TK-390: one «i» after the redraw");
  assert.ok(redrawnInfo[0].parentNode === byClass("devtools__crumbs", page)[0], "TK-390: it is in the crumbs");
  crumbTo("Гра");
  assert.ok(redrawnInfo[0].parentNode === starfallSection, "TK-390: and goes to its section on leaving");
  infoDrillUi.dispose();
}

// --- TK-387 (I-32): a section that redraws its own rows goes through DevToolsUI.redraw ---------------------------------
// Found by the DevTools review (2026-11-23): every «↻ Оновити» of a section with description rows added one more «i»
// (the «i» lives in the section, replaceChildren cleared only the container), and a choice inside a drill-in that
// redrew its parent left the old rows in the drill-in (R23): in «SPINE → вудка → Кістки» the next bone's fields went
// into the hidden rebuilt section, and editing «x» changed the previous bone. Real sections at their production depth.
{
  const redrawUi = new DevToolsUI(() => {}, {}, null, null, null, document.body, createElement("div"));
  const page = redrawUi.createPages([{ id: "scene", title: "Сцена", icon: "scene" }], "scene", () => {}).get("scene");
  const createSection = (label, parent, path) => redrawUi.createSection(label, parent, false, () => {}, path);
  const titleOf = (text) => byClass("devtools__section-title", page).find((title) => title.textContent === text);
  const drillPaths = () => byClass("devtools__row", byClass("devtools__drill", page)[0] ?? createElement("div"))
    .map((row) => row.dataset.devtoolsPath).filter(Boolean);
  const choose = (row, text) => {
    byClass("devtools__choice-button", row)[0].click();
    byClass("devtools__choice-option", row).find((option) => option.textContent.includes(text)).click();
  };

  // SPINE (depth 0) → the rod (1) → «Кістки» (2: a drill-in), as SpineModule builds it.
  const bones = [
    { name: "rod", parent: null, x: 1, y: 2, rotation: 0, scaleX: 1, scaleY: 1, canvasX: 0, canvasY: 0 },
    { name: "tip", parent: "rod", x: 50, y: 60, rotation: 0, scaleX: 1, scaleY: 1, canvasX: 0, canvasY: 0 },
  ];
  const boneEdits = [];
  const { SpineDevSection } = runtime.importModule("src/dev/tools/spine_dev_section.js");
  const spine = createSection("SPINE", page, ["SPINE"]);
  const downloads = [];
  new SpineDevSection({ ui: redrawUi, subject: SpineDevSection.ROD, createSection, renderConfigTree() {},
    files: { download: (name, text) => downloads.push([name, text]) },
    controller: { exportSkeleton: () => ({ fileName: "rod.json", text: "{}" }),
      getStatus: () => ({ mode: "spine", missingClips: [], mipmapped: false, pixelRatio: 1 }),
      isSpineEnabled: () => true, setSpineEnabled() {}, getClips: () => [], setClipEnabled() {}, getBones: () => bones,
      setBoneSetup: (name, setup) => boneEdits.push([name, setup]), getBoneEdits: () => ({}) } }).render(spine);
  titleOf("SPINE").click();
  titleOf("rod").click();
  const rodSection = titleOf("rod").parentNode;
  const refresh = () => byClass("devtools__action", rodSection).find((button) => button.innerText.includes("Оновити")).click();
  refresh();
  refresh();
  assert.equal(byClass("devtools__section-info-button", rodSection).filter((button) => button.parentNode === rodSection).length, 1,
    "after two «Оновити» the section has one «i», not one per redraw");

  titleOf("Кістки").click();
  assert.ok(drillPaths().includes("SPINE_ROD.bones.rod.x"), "«Кістки» opens inside with the first bone");
  choose(byClass("devtools__row", byClass("devtools__drill", page)[0]).find((row) =>
    row.dataset.devtoolsPath === "SPINE_ROD.bones.selected"), "tip");
  assert.ok(drillPaths().includes("SPINE_ROD.bones.tip.x") && !drillPaths().includes("SPINE_ROD.bones.rod.x"),
    "choosing a bone inside the drill-in shows that bone's fields there");
  assert.equal(byClass("devtools__drill", page).length, 1, "one drill area, the rebuilt one");
  const tipX = byClass("devtools__row", byClass("devtools__drill", page)[0]).find((row) =>
    row.dataset.devtoolsPath === "SPINE_ROD.bones.tip.x");
  const input = byClass("devtools__input--number", tipX)[0];
  input.value = "55";
  input.fire("blur", { target: input });
  // The edit comes from the sandboxed module's realm: compared by value.
  assert.equal(JSON.stringify(boneEdits.at(-1)), JSON.stringify(["tip", { x: 55 }]), "an edit there changes the chosen bone");
  assert.ok(drillPaths().includes("SPINE_ROD.bones.tip.x"), "and the drill-in stays on it after the redraw");
  const crumbs = byClass("devtools__crumb", page).map((crumb) => crumb.textContent);
  assert.deepEqual([...crumbs], ["Сцена", "SPINE", "rod", "Кістки"], "its crumbs lead to the rebuilt sections");
  // TK-389: one Spine section for the rod and the boat; the skeleton's file goes through the DEV file port.
  byClass("devtools__crumb", page).find((crumb) => crumb.textContent === "rod").click();
  byClass("devtools__action", rodSection).find((button) => button.innerText === "Експорт rod.json").click();
  assert.equal(JSON.stringify(downloads), JSON.stringify([["rod.json", "{}"]]), "«Експорт» saves the skeleton through files");

  // РАДІО (0) → «Звук: ефекти й перешкоди» (1) → an effect (2: a drill-in): «увімкнено» shows the effect's parameters.
  const radioConfig = { effects: { retro: { enabled: false, drive: 2 } } };
  const { RadioDevSection } = runtime.importModule("src/dev/tools/radio_dev_section.js");
  const radio = new RadioDevSection({ ui: redrawUi, createSection,
    radio: { getStatus: () => ({ powered: true, status: "on", country: "UA", stationCount: 1, signal: 1 }),
      batteryPercent: () => 50, discharge() {} },
    config: () => radioConfig,
    setConfig: (path, value) => { radioConfig.effects.retro.enabled = value; },
    renderConfigTree: (settings, parent, path) => {
      if (path.at(-1) === "retro") redrawUi.createTextRow("drive", String(settings.drive), parent);
    } });
  radio.render(page);
  titleOf("РАДІО").click();
  titleOf("Звук: ефекти й перешкоди").click();
  titleOf("Ретро").click();
  const drillText = () => byClass("devtools__label", byClass("devtools__drill", page)[0]).map((label) => label.dataset.devtoolsKey);
  assert.ok(!drillText().includes("drive"), "«Ретро» is off: no parameters yet");
  const enabled = byClass("devtools__row", byClass("devtools__drill", page)[0]).find((row) =>
    row.dataset.devtoolsPath === "RADIO.effects.retro.enabled");
  const toggle = byClass("devtools__switch-input", enabled)[0];
  toggle.checked = true;
  toggle.fire("change", { target: toggle });
  assert.ok(drillText().includes("drive"), "switching it on inside the drill-in shows its parameters there");

  // TK-387.1 (review before push): a redraw inside another one (the weather's «Збереження», DevSavingSection.render)
  // leaves the search to the outer one: one filter pass over the finished rows, not one per nested redraw.
  byClass("devtools__crumb", page).find((crumb) => crumb.textContent === "Сцена")?.click();
  const status = byClass("devtools__search-status", redrawUi.body.parentNode)[0];
  let filterPasses = 0;
  let statusText = "";
  Object.defineProperty(status, "textContent", { configurable: true, get: () => statusText,
    set: (value) => { filterPasses++; statusText = value; } });
  const weather = redrawUi.createSection("ПОГОДА", page, true, () => {}, ["WEATHER"]);
  const search = byClass("devtools__search-input", redrawUi.body.parentNode)[0];
  search.value = "rain";
  search.fire("input");
  filterPasses = 0;
  redrawUi.redraw(weather, () => {
    redrawUi.addParameter(weather, { control: "number", label: "rain", value: 1, onCommit() {}, path: ["WEATHER", "rain"] });
    const saving = redrawUi.createSection("Збереження", weather, false, () => {}, ["WEATHER", "saving"]);
    redrawUi.redraw(saving, () => redrawUi.createTextRow("стан", "ok", saving));
  });
  assert.equal(filterPasses, 1, "one search pass for a redraw with a nested one");
  assert.ok(byClass("devtools__row", weather).some((row) => row.dataset.devtoolsPath === "WEATHER.rain"
    && row.classList.contains("devtools__row--match")), "and it marks the redrawn rows");
  search.value = "";
  search.fire("input");
  redrawUi.dispose();
}

// --- TK-307 (spec 174 C5): the panel's text dialog and result line instead of prompt and alert --------------------------
(async () => {
  const { ServiceModule } = runtime.importModule(
    "src/dev/tools/modules/service_module.js",
  );
  const serviceUi = new DevToolsUI(
    () => {},
    {},
    null,
    null,
    null,
    document.body,
    createElement("div"),
  );
  const host = createElement("div");
  serviceUi.body.appendChild(host);
  const downloads = [],
    imported = [],
    redraws = [],
    picked = ['{"a": 1}'];
  const plan = { saved: [], edited: false };
  const module = new ServiceModule({
    redraw: () => redraws.push(1),
    gameVersion: "0.50.122",
    now: () => new Date(2026, 10, 14, 9, 5),
    configRuntime: {
      overrideStore: { entries: () => [["x", 1]] },
      exportOverrides: () => ({ "rain.opacity": 0.5 }),
    },
    files: {
      download: (name, text) => downloads.push([name, text]),
      pickFile: async () => picked.shift() ?? null,
    },
    assetLoadPlanStore: {
      isEdited: () => plan.edited,
      exportText: () => "export const PLAN = [];",
      plan: () => ({ steps: [] }),
      save: (value) =>
        value.steps ? (plan.saved.push(value), []) : ["steps missing"],
      reset() {
        plan.edited = false;
      },
    },
    logger: { log() {}, warn() {} },
  });
  const edits = {
    importOverrides: (value) => {
      if (value.bad) throw new Error("bad key");
      imported.push(value);
    },
    resetAll() {},
  };
  module.mount(host, {
    ui: serviceUi,
    createSection: (label, parent, path, options) =>
      serviceUi.createSection(label, parent, true, () => {}, path, options),
    edits,
  });
  const button = (label) =>
    byClass("devtools__action", host).find(
      (element) =>
        element.textContent.includes(label) || element.innerText === label,
    );
  const panel = serviceUi.body.parentNode;
  const dialog = () => byClass("devtools__dialog", panel)[0];
  const action = (label) =>
    byClass("devtools__dialog-action", dialog()).find(
      (element) => element.textContent === label,
    );
  const text = () => byClass("devtools__dialog-text", dialog())[0];
  const message = () => byClass("devtools__dialog-message", dialog())[0];
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  // Export: the text in a dialog, copied or downloaded.
  button("Export overrides").click();
  assert.ok(
    dialog(),
    "an export opens the panel's dialog, not the browser's prompt",
  );
  assert.equal(JSON.parse(text().value)["rain.opacity"], 0.5);
  assert.equal(text().readOnly, true);
  action("Копіювати").click();
  await settle();
  // Another async scenario of this check copies too: look for this text, not the last one.
  assert.ok(
    clipboard.includes(text().value),
    "Копіювати puts the text on the clipboard",
  );
  assert.equal(message().textContent, "Скопійовано.");
  action("Завантажити файл").click();
  assert.equal(
    downloads.at(-1)[0],
    "overrides-v0.50.122-20261114-0905.json",
    "and Завантажити saves it as a file",
  );
  const escape = byClass("devtools__dialog-layer", panel)[0].fire("keydown", {
    key: "Escape",
  });
  assert.equal(escape.stopped, true);
  assert.equal(dialog(), undefined, "Escape closes the dialog");
  // Import: invalid text stays in the dialog with the reason; valid text is applied, the panel redrawn, the result shown.
  button("Import overrides").click();
  text().value = "{oops";
  action("Застосувати").click();
  assert.match(message().textContent, /^Це не JSON/u);
  assert.equal(
    message().classList.contains("devtools__dialog-message--error"),
    true,
  );
  text().value = '{"bad": true}';
  action("Застосувати").click();
  assert.equal(
    message().textContent,
    "Не застосовано: bad key",
    "a refused import says why",
  );
  action("Відкрити файл").click();
  await settle();
  assert.equal(
    text().value,
    '{"a": 1}',
    "Відкрити файл reads a file into the dialog",
  );
  action("Застосувати").click();
  assert.equal(JSON.stringify(imported), JSON.stringify([{ a: 1 }]));
  assert.equal(dialog(), undefined, "a successful import closes the dialog");
  assert.equal(redraws.length, 1);
  const toast = byClass("devtools__toast", panel)[0];
  assert.equal(
    toast.textContent,
    "Перевизначення застосовано.",
    "the result line replaces the browser's alert",
  );
  assert.equal(toast.hidden, false);
  // The load plan: an edit with errors is kept in the dialog; a valid one is saved.
  button("Змінити план (з наступного старту)").click();
  text().value = "{}";
  action("Зберегти").click();
  assert.equal(message().textContent, "План не збережено:\nsteps missing");
  text().value = '{"steps": []}';
  action("Зберегти").click();
  assert.equal(plan.saved.length, 1);
  assert.equal(toast.textContent, "План збережено: діє з наступного старту.");
  serviceUi.dispose();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// --- TK-308: opening the panel draws only what is open; everything else when it is first needed ---------------------
{
  const { DevTools } = runtime.importModule("src/dev/tools/dev_tools.js");
  const storage = new Map();
  const lazyUi = new DevToolsUI(
    () => {},
    {},
    null,
    null,
    null,
    document.body,
    createElement("div"),
  );
  const config = {
    debug: {},
    physics: { drag: 0.4, fight: { rodControl: { ratio: 2, enabled: true } } },
  };
  const tools = new DevTools(
    config,
    { synchronize() {} },
    {
      catalogs: { items: {}, fishes: [], maps: {} },
      settingsStore: null,
      debugModulesSource: () => ({}),
      createUI: () => ({
        ui: lazyUi,
        tooltipProvider: { ready: new Promise(() => {}) },
      }),
      storageCache: {
        get: (key, fallback) => storage.get(key) ?? fallback,
        set: (key, value) => storage.set(key, value),
        remove() {},
      },
    },
  );
  tools.toggle();
  const rowsOf = (key) =>
    byClass("devtools__row", lazyUi.body).filter(
      (row) => row.children[0]?.dataset?.devtoolsKey === key,
    );
  assert.equal(
    rowsOf("drag").length,
    0,
    "a closed section's rows are not drawn when the panel opens",
  );
  const physicsTitle = byClass("devtools__section-title", lazyUi.body).find(
    (title) => title.textContent === "physics",
  );
  physicsTitle.click();
  assert.equal(rowsOf("drag").length, 1, "opening the section draws its rows");
  assert.equal(
    rowsOf("ratio").length,
    0,
    "but not those of the sections inside it",
  );
  // Edited while closed: drawn with the value as it is now.
  config.physics.fight.rodControl.ratio = 3;
  const input = byClass("devtools__search-input", lazyUi.body.parentNode)[0];
  input.value = "ratio";
  input.fire("input");
  const ratio = rowsOf("ratio");
  assert.equal(ratio.length, 1, "a search draws the rest and finds it");
  assert.equal(
    byClass("devtools__input--number", ratio[0])[0].value,
    "3",
    "with the value it has now",
  );
  input.value = "";
  input.fire("input");
  tools.toggle();
  tools.toggle();
  assert.equal(rowsOf("ratio").length, 0, "a redraw is lazy again");
  assert.equal(
    tools.revealParameter([
      "CONFIG",
      "physics",
      "fight",
      "rodControl",
      "ratio",
    ]),
    true,
    "a link from the overlay draws and opens a row that was not drawn",
  );
  tools.dispose();
}

// --- TK-388 (R29): a section drawn on first need that throws shows its error in itself; the rest still draws --------
// The DevTools review (2026-11-23): TK-378.1 isolated module.mount only; a lazy section (TK-308) that threw left the
// click with nothing opened (no console on a phone) and broke a search or a link, which draw every waiting section.
{
  const lazyUi = new DevToolsUI(() => {}, {}, null, null, null, document.body, createElement("div"));
  const page = lazyUi.createPages([{ id: "config", title: "Конфіг", icon: "sliders" }], "config", () => {}).get("config");
  const broken = (label) => lazyUi.createSection(label, page, false, () => {}, ["LAZY", label],
    { render: () => { throw new TypeError(`${label} broke`); } });
  const opened = broken("opened");
  const waiting = broken("waiting");
  const fine = lazyUi.createSection("fine", page, false, () => {}, ["LAZY", "fine"], { render: (content) =>
    lazyUi.addParameter(content, { control: "number", label: "speedLimit", value: 1, onCommit() {},
      path: ["LAZY", "fine", "speedLimit"] }) });
  const errors = [];
  const consoleError = console.error;
  console.error = (...args) => errors.push(args);
  try {
    assert.doesNotThrow(() => opened.parentNode.children[0].click(), "a section whose drawing throws opens without a throw");
    assert.equal(opened.style.display, "block", "it opens");
    assert.ok(byClass("devtools__alert-line", opened).some((line) => line.innerText === "opened broke"),
      "and shows its error inside (a phone has no console)");
    const input = byClass("devtools__search-input", lazyUi.body.parentNode)[0];
    input.value = "speedlimit";
    assert.doesNotThrow(() => input.fire("input"), "a search draws every waiting section without a throw");
    assert.ok(byClass("devtools__alert-line", waiting).some((line) => line.innerText === "waiting broke"),
      "the waiting one shows its error");
    const match = byClass("devtools__row", fine).filter((row) => row.dataset.devtoolsPath === "LAZY.fine.speedLimit");
    assert.equal(match.length, 1, "the section after it is drawn");
    assert.ok(match[0].classList.contains("devtools__row--match"), "and the search finds its row");
    assert.equal(errors.length, 2, "each failure once in the console");
  } finally {
    console.error = consoleError;
  }
  lazyUi.dispose();
}

// --- TK-320: a section's description is behind an «i» beside its title and opens at the top of the section ----------
{
  const infoUi = new DevToolsUI(
    () => {},
    {},
    null,
    null,
    null,
    document.body,
    createElement("div"),
  );
  const host = createElement("div");
  infoUi.body.appendChild(host);
  const content = infoUi.createSection("radio", host, false, () => {}, [
    "RADIO",
  ]);
  infoUi.addParameter(content, {
    control: "number",
    label: "volume",
    value: 1,
    onCommit() {},
    path: ["RADIO", "volume"],
  });
  infoUi.createInfoRow("стан", "on", content);
  infoUi.createInfoRow("станція", "VOLIA", content);
  const section = content.parentNode;
  assert.equal(
    byClass("devtools__section-label", section).some(
      (label) => label.textContent === "Опис",
    ),
    false,
    "no «Опис» block at the bottom of the section",
  );
  const panel = byClass("devtools__section-info", section)[0];
  assert.equal(
    content.children[0],
    panel,
    "the description is at the top of the section",
  );
  assert.equal(panel.children.length, 2, "both rows are in it");
  assert.equal(panel.hidden, true, "closed until asked for");
  const button = byClass("devtools__section-info-button", section)[0];
  assert.equal(
    button.parentNode,
    section,
    "the «i» is beside the section's title",
  );
  assert.equal(
    section.children[1],
    content,
    "the section keeps its title and content in place",
  );
  button.click();
  assert.equal(panel.hidden, false, "«i» opens the description");
  assert.equal(
    content.style.display,
    "block",
    "and opens a closed section with it",
  );
  assert.equal(button.getAttribute("aria-expanded"), "true");
  button.click();
  assert.equal(panel.hidden, true);
  infoUi.dispose();
  // TK-320.1 (owner): it looks like every other «i» hint — the same box as a parameter's description, rows without lines.
  const css = require("node:fs").readFileSync(
    require("node:path").resolve(
      __dirname,
      "../../../src/dev/styles/dev-tools.css",
    ),
    "utf8",
  );
  const declarations = (selector) => {
    const block =
      css.match(
        new RegExp(`\\n${selector.replace(/[.]/gu, "\\.")} \\{([^}]*)\\}`, "u"),
      )?.[1] ?? "";
    return Object.fromEntries(
      block
        .split(";")
        .map((part) => part.split(":").map((side) => side.trim()))
        .filter(([name]) => name),
    );
  };
  const hint = declarations(".devtools__description");
  const info = declarations(".devtools__section-info");
  for (const property of [
    "padding",
    "background",
    "color",
    "font-size",
    "line-height",
    "border-radius",
  ]) {
    assert.equal(
      info[property],
      hint[property],
      `the section description's ${property} is the «i» hint's`,
    );
  }
  assert.match(
    css,
    /\.devtools__section-info > \.devtools__row\.devtools__row \{[^}]*border-top: 0/u,
    "its rows have no lines between them (beating .devtools__row + .devtools__row)",
  );
}

// --- TK-320: a colour parameter has a swatch and a picker; the value keeps its format --------------------------------
{
  const { ColorValue } = runtime.importModule(
    "src/dev/tools/controls/color_value.js",
  );
  for (const [text, expected] of [
    ["#3388ff", "#3388ff"],
    ["#fff", "#ffffff"],
    ["rgba(255, 0, 0, 0.5)", "rgba(255, 0, 0, 0.5)"],
    ["rgb(1,2,3)", "rgb(1, 2, 3)"],
    ["#11223380", "#11223380"],
  ]) {
    assert.equal(
      ColorValue.format(ColorValue.parse(text)),
      expected,
      `${text} is written back in its format`,
    );
  }
  assert.equal(ColorValue.parse("white"), null, "a named colour stays text");
  assert.equal(
    ColorValue.hasAlpha(ColorValue.parse("rgba(1, 2, 3, 0.4)")),
    true,
  );
  assert.equal(ColorValue.hasAlpha(ColorValue.parse("#123456")), false);
  // The tree draws a colour string as a colour field.
  const colorUi = new DevToolsUI(
    () => {},
    {},
    null,
    null,
    null,
    document.body,
    createElement("div"),
  );
  const host = createElement("div");
  colorUi.body.appendChild(host);
  const written = [];
  const { ConfigTreeRenderer } = runtime.importModule(
    "src/dev/tools/config/config_tree_renderer.js",
  );
  const tree = new ConfigTreeRenderer({
    ui: colorUi,
    schema,
    edits: {
      update: (path, value) => written.push([path.join("."), value]),
      isOverridden: () => false,
      resetParameter() {},
      read: () => undefined,
    },
    labels: {},
  });
  tree.renderScalar({
    key: "accuracyAreaFill",
    value: "rgba(0, 200, 255, 0.25)",
    parentElement: host,
    displayPath: ["CONFIG", "ui", "accuracyAreaFill"],
    canonicalPath: ["CONFIG", "ui", "accuracyAreaFill"],
  });
  const field = byClass("devtools__color", host)[0];
  assert.ok(field, "a colour parameter is a colour field");
  const controls = byClass("devtools__color-controls", field)[0];
  const chip = byClass("devtools__color-chip", controls)[0];
  const swatch = byClass("devtools__color-swatch", chip)[0];
  const colorInput = byClass("devtools__color-input", chip)[0];
  const picker = byClass("devtools__color-picker", field)[0];
  assert.ok(controls && chip && swatch && colorInput, "the colour input sits directly over the swatch inside controls");
  assert.equal(
    swatch.style.getPropertyValue("--devtools-color-value"),
    "rgba(0, 200, 255, 0.25)",
    "the swatch shows the colour",
  );
  assert.equal(picker.hidden, true);
  colorInput.click();
  assert.equal(picker.hidden, false, "for an rgba colour, clicking the swatch reveals the inline opacity slider");
  assert.equal(colorInput.value, "#00c8ff");
  const alpha = byClass("devtools__color-alpha", picker)[0];
  assert.equal(alpha.hidden, false, "an rgba colour has an opacity slider");
  colorInput.value = "#ff0000";
  colorInput.fire("input");
  assert.equal(
    JSON.stringify(written.at(-1)),
    JSON.stringify(["CONFIG.ui.accuracyAreaFill", "rgba(255, 0, 0, 0.25)"]),
    "a picked colour keeps the opacity and the rgba format",
  );
  assert.equal(
    swatch.style.getPropertyValue("--devtools-color-value"),
    "rgba(255, 0, 0, 0.25)",
    "the swatch immediately updates to the picked colour",
  );
  const alphaInput = byClass("devtools__color-alpha-input", alpha)[0];
  alphaInput.value = "0.6";
  alphaInput.fire("input");
  assert.equal(
    written.at(-1)[1],
    "rgba(255, 0, 0, 0.6)",
    "the slider changes the opacity",
  );
  assert.equal(
    byClass("devtools__color-alpha-value", alpha)[0].textContent,
    "60%",
  );
  // Clicking the swatch again closes the picker/native window while preserving the picked colour.
  const secondClick = colorInput.fire("click");
  assert.equal(secondClick.prevented, true, "second click cancels re-opening the native picker");
  assert.equal(picker.hidden, true, "second click hides the opacity drawer");
  assert.equal(swatch.style.getPropertyValue("--devtools-color-value"), "rgba(255, 0, 0, 0.6)");
  tree.renderScalar({
    key: "lineColor",
    value: "#3388ff",
    parentElement: host,
    displayPath: ["CONFIG", "ui", "lineColor"],
    canonicalPath: ["CONFIG", "ui", "lineColor"],
  });
  const hexField = byClass("devtools__color", host)[1];
  const hexPicker = byClass("devtools__color-picker", hexField)[0];
  const hexInput = byClass("devtools__color-input", hexField)[0];
  const firstHexClick = hexInput.fire("click");
  assert.equal(firstHexClick.prevented, false, "first click opens the native colour picker");
  assert.equal(hexPicker.hidden, true, "a #rrggbb colour keeps the inline box hidden on click (native picker opens directly)");
  hexInput.value = "#00ff00";
  hexInput.fire("input");
  const secondHexClick = hexInput.fire("click");
  assert.equal(secondHexClick.prevented, true, "second click on swatch closes the native picker while open");
  assert.equal(byClass("devtools__color-swatch", hexField)[0].style.getPropertyValue("--devtools-color-value"), "#00ff00");
  // After the native picker finishes closing (change), clicking the swatch opens it again.
  hexInput.fire("change");
  assert.equal(hexInput.fire("click").prevented, false);
  assert.equal(
    byClass("devtools__color-alpha", hexField)[0].hidden,
    true,
    "a #rrggbb colour has no opacity",
  );
  tree.renderScalar({
    key: "name",
    value: "Test",
    parentElement: host,
    displayPath: ["CONFIG", "name"],
    canonicalPath: ["CONFIG", "name"],
  });
  assert.equal(
    byClass("devtools__color", host).length,
    2,
    "other text stays a text field",
  );
  colorUi.dispose();
}

// --- TK-320: text in DevTools can be selected and copied ----------------------------------------------------------------
{
  const selectUi = new DevToolsUI(
    () => {},
    {},
    null,
    null,
    null,
    document.body,
    createElement("div"),
  );
  const menu = selectUi.body.fire("contextmenu", {});
  assert.equal(
    menu.stopped,
    true,
    "the browser's context menu (copy, the phone's selection menu) reaches the body's text",
  );
  assert.equal(menu.prevented, false, "and is not cancelled there");
  selectUi.dispose();
  const css = require("node:fs").readFileSync(
    require("node:path").resolve(
      __dirname,
      "../../../src/dev/styles/dev-tools.css",
    ),
    "utf8",
  );
  assert.match(
    css,
    /\.devtools__body \{\s*-webkit-user-select: text;\s*user-select: text;/u,
    "the body's text is selectable (the game shell forbids selection)",
  );
}

// --- TK-313: phone layouts win the cascade: no base rule of the same selector comes after a phone container query ----
// (TK-313: the base .devtools__rail rule sat below the portrait query and kept the rail a 60 px column on a phone).
{
  const fs = require("node:fs");
  const path = require("node:path");
  const css = fs
    .readFileSync(
      path.resolve(__dirname, "../../../src/dev/styles/dev-tools.css"),
      "utf8",
    )
    .replace(/\/\*[\s\S]*?\*\//gu, "");
  // Top-level rules and at-rule blocks in source order: { at, selectors, offset }.
  const blocks = [];
  let depth = 0;
  let headerStart = 0;
  let current = null;
  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    if (char === "{") {
      const header = css.slice(headerStart, i).trim();
      if (depth === 0)
        current = {
          at: header.startsWith("@") ? header : null,
          selectors: [],
          offset: i,
        };
      if (depth === 0 && !header.startsWith("@"))
        current.selectors.push(header);
      if (depth === 1 && current?.at) current.selectors.push(header);
      depth++;
      headerStart = i + 1;
    } else if (char === "}") {
      depth--;
      headerStart = i + 1;
      if (depth === 0) blocks.push(current);
    } else if (char === ";" && depth <= 1 && current?.at == null)
      headerStart = i + 1;
    else if (char === ";" && depth === 1) headerStart = i + 1;
  }
  const split = (selector) =>
    selector.split(",").map((part) => part.replace(/\s+/gu, " ").trim());
  const phone = blocks.filter((entry) =>
    /@container ui-surface .*(max-width: 480px|max-height: 480px)/u.test(
      entry.at ?? "",
    ),
  );
  assert.ok(
    phone.length >= 2,
    "the portrait and landscape phone layouts are found",
  );
  for (const query of phone) {
    const overridden = new Set(query.selectors.flatMap(split));
    for (const later of blocks.filter(
      (entry) => entry.at == null && entry.offset > query.offset,
    )) {
      for (const selector of later.selectors.flatMap(split)) {
        assert.equal(
          overridden.has(selector),
          false,
          `base rule "${selector}" comes after "${query.at}" and overrides the phone layout; keep phone queries last`,
        );
      }
    }
  }
  assert.ok(
    phone.some((query) =>
      query.selectors.flatMap(split).includes(".devtools__rail"),
    ),
    "the rail has a phone layout",
  );
  // TK-312.1: a full-width panel cannot close by the side panel's -400px offset (half stayed on a landscape phone); the
  // last landscape rule for «На весь екран» hides it by its own width, on either side, after the side layouts.
  const landscapeFullscreen = [
    ...css.matchAll(
      /@container ui-surface \(orientation: landscape\) and \(max-height: 480px\) \{([\s\S]*?)\n\}/gu,
    ),
  ].filter((match) =>
    /\.devtools\.devtools--fullscreen[^{]*\{[^}]*transform: translateX\(-105%\)/u.test(
      match[1],
    ),
  );
  assert.equal(
    landscapeFullscreen.length,
    1,
    "full screen on a landscape phone closes by transform over its whole width",
  );
  assert.match(
    landscapeFullscreen[0][1],
    /\.devtools\.devtools--fullscreen\.devtools--right \{ transform: translateX\(105%\); \}/u,
    "and to the right when the panel is on the right",
  );
  assert.ok(
    landscapeFullscreen[0].index >
      css.lastIndexOf(".devtools.devtools--right {"),
    "after the side layouts it overrides",
  );
}

// --- TK-312: the panel's own settings on the last rail page, remembered and applied ----------------------------------
{
  const { DevTools } = runtime.importModule("src/dev/tools/dev_tools.js");
  const stored = new Map([["dev_tools_panel_settings", { fullscreen: true }]]);
  const storageCache = {
    get: (key, fallback) => stored.get(key) ?? fallback,
    set: (key, value) => stored.set(key, value),
    remove: (key) => stored.delete(key),
  };
  const settingsUi = new DevToolsUI(
    () => {},
    {},
    null,
    null,
    null,
    document.body,
    createElement("div"),
  );
  const panel = settingsUi.body.parentNode;
  const tools = new DevTools(
    { debug: {} },
    { synchronize() {} },
    {
      catalogs: { items: {}, fishes: [], maps: {} },
      settingsStore: null,
      debugModulesSource: () => ({}),
      storageCache,
      createUI: () => ({
        ui: settingsUi,
        tooltipProvider: { ready: new Promise(() => {}) },
      }),
    },
  );
  assert.equal(
    panel.classList.contains("devtools--fullscreen"),
    true,
    "a remembered setting applies before the panel opens",
  );
  assert.equal(panel.classList.contains("devtools--adaptive"), true, "TK-331: adaptive width is on by default");
  tools.toggle();
  const buttons = byClass("devtools__rail-button", panel);
  assert.equal(
    buttons.at(-1).getAttribute("aria-label"),
    "Панель",
    "the settings are the last module on the rail",
  );
  buttons.at(-1).click();
  const page = byClass("devtools__page", panel).find(
    (element) => element.dataset.devtoolsPage === "panel",
  );
  const switchOf = (key) =>
    byClass("devtools__row", page).find(
      (row) => row.children[0]?.dataset?.devtoolsKey === key,
    );
  const adaptive = byClass(
    "devtools__switch-input",
    switchOf("Адаптивна ширина (ПК)"),
  )[0];
  assert.equal(adaptive.checked, true);
  adaptive.checked = false;
  adaptive.fire("change", { target: adaptive });
  assert.equal(
    panel.classList.contains("devtools--adaptive"),
    false,
    "disabling «Адаптивна ширина» switches back to fixed width",
  );
  assert.equal(
    JSON.stringify(stored.get("dev_tools_panel_settings")),
    JSON.stringify({
      adaptiveWidth: false,
      fullscreen: true,
      side: "left",
      searchMode: "filter",
    }),
    "and is remembered",
  );
  const fullscreen = byClass(
    "devtools__switch-input",
    switchOf("На весь екран (телефон горизонтально)"),
  )[0];
  assert.equal(
    fullscreen.checked,
    true,
    "the switch shows the remembered value",
  );
  fullscreen.checked = false;
  fullscreen.fire("change", { target: fullscreen });
  assert.equal(panel.classList.contains("devtools--fullscreen"), false);
  // TK-317: the side the panel opens from (computer, landscape phone), remembered.
  assert.equal(
    panel.classList.contains("devtools--right"),
    false,
    "the panel opens on the left by default",
  );
  const sides = byClass(
    "devtools__segment",
    switchOf("Сторона (ПК, горизонтально)"),
  );
  assert.equal(
    JSON.stringify(sides.map((side) => side.textContent)),
    JSON.stringify(["Ліворуч", "Праворуч"]),
  );
  sides[1].click();
  assert.equal(
    panel.classList.contains("devtools--right"),
    true,
    "«Праворуч» moves the panel to the right edge",
  );
  assert.equal(
    stored.get("dev_tools_panel_settings").side,
    "right",
    "and is remembered",
  );
  sides[0].click();
  assert.equal(panel.classList.contains("devtools--right"), false);
  // TK-319: the search mode, remembered.
  const modes = byClass("devtools__segment", switchOf("Пошук"));
  assert.equal(
    JSON.stringify(modes.map((mode) => mode.textContent)),
    JSON.stringify(["Фільтр", "Розгорнути"]),
  );
  modes[1].click();
  assert.equal(
    stored.get("dev_tools_panel_settings").searchMode,
    "reveal",
    "«Розгорнути» is remembered",
  );
  modes[0].click();
  tools.dispose();
}

// --- TK-360: the open panel's live updates reach the weather; «Болід зараз» closes the panel on a phone ----------------
{
  const { DevTools } = runtime.importModule("src/dev/tools/dev_tools.js");
  const liveUi = new DevToolsUI(() => {}, {}, null, null, null, document.body, createElement("div"));
  let reads = 0;
  let bolides = 0;
  let automatic = true;
  const events = { rain: { active: false }, storm: { active: false }, fog: { active: false } };
  const weatherModel = { snapshot: { events, strikeSerial: 0, strikeVariant: 0, strikeDistance: 0 },
    hold() {}, start() {}, stop() {}, releaseAll() {}, strike() {} };
  const starfall = { snapshot: { held: false, strength: 0, inWindow: false, active: false, periodLevels: [] },
    hold() {}, bolideNow: () => { bolides += 1; } };
  const tools = new DevTools({ debug: {}, locations: { map: {} } }, { synchronize() {} }, {
    catalogs: { items: {}, fishes: [], maps: {} },
    settingsStore: null,
    debugModulesSource: () => ({}),
    storageCache: { get: (key, fallback) => fallback, set() {}, remove() {} },
    weather: { locationId: "test", getModel: () => { reads += 1; return weatherModel; }, getWind: () => null,
      getStarfallModel: () => starfall, isAutomatic: () => automatic, setAutomatic: (on) => { automatic = on; } },
    createUI: () => ({ ui: liveUi, tooltipProvider: { ready: new Promise(() => {}) } }),
  });
  const fireLive = () => { for (const listener of document.listeners.get("debug-live-update") ?? []) listener({ detail: {} }); };
  fireLive();
  assert.equal(reads, 0, "the panel closed: the weather is not read on live updates");
  tools.toggle();
  const fogRow = () => byClass("devtools__row", liveUi.body).find((row) => row.children[0]?.dataset?.devtoolsKey === "Туман");
  const fogChecked = () => byClass("devtools__switch-input", fogRow())[0].checked;
  assert.equal(fogChecked(), false, "no fog: its switch is off");
  const readsBefore = reads;
  fireLive();
  assert.ok(reads > readsBefore, "open: a live update reaches the weather section");
  events.fog.active = true;
  fireLive();
  assert.equal(fogChecked(), true, "a fog that started by itself shows on its switch with the next live update");
  // TK-400 (owner): the section's «i» shows what is on now, in short, and follows the live updates while it is open.
  const summaryValue = (kind) => byClass("devtools__row", liveUi.body)
    .find((row) => row.dataset.devtoolsPath === `WEATHER.summary.${kind}`)?.children[1]?.innerText;
  assert.equal(summaryValue("active"), "туман", "«активні» names the fog that started");
  assert.equal(summaryValue("rain"), undefined, "a state that is off has no line");
  assert.equal(summaryValue("automatic"), "увімкнена", "the automatic weather is shown");
  const closedText = summaryValue("fog");
  Object.assign(events.fog, { strength: 0.4, phase: "peak", durationSec: 600, elapsedSec: 330 });
  fireLive();
  assert.ok(closedText.startsWith("0%") && summaryValue("fog") === closedText, "the «i» closed: its texts are not rewritten");
  const weatherSection = byClass("devtools__section", liveUi.body).find((section) => section.dataset.devtoolsPath === "WEATHER");
  // Its own «i» (a direct child; the nested sections have their own).
  [...weatherSection.children].find((child) => child.classList?.contains("devtools__section-info-button")).click();
  fireLive();
  assert.equal(summaryValue("fog"), "40% · пік · ще 4:30", "open: the fog's strength, phase and time left, live");
  events.fog.elapsedSec = 340;
  fireLive();
  assert.equal(summaryValue("fog"), "40% · пік · ще 4:20", "the next live update rewrites it without a redraw");
  // TK-401 (owner): a strength slider follows its element's live strength; the person's own move is not overridden.
  // Spec 187 A: the slider is on top of the element's section (ТУМАН), none in «Керування».
  assert.ok(!byClass("devtools__row", liveUi.body).some((row) => /^WEATHER\.controls\./u.test(row.dataset.devtoolsPath ?? "") &&
    byClass("devtools__range", row).length), "«Керування» holds no slider (the real DevToolsUI)");
  const fogRange = () => byClass("devtools__range", byClass("devtools__row", liveUi.body)
    .find((row) => row.dataset.devtoolsPath === "WEATHER.fog.strength"))[0];
  assert.equal(String(fogRange().value), "40", "the fog's slider stands at its live strength");
  events.fog.strength = 0.55;
  fireLive();
  assert.equal(String(fogRange().value), "55", "the next live update moves it");
  fogRange().value = "70";
  fogRange().fire("input", { target: fogRange() });
  events.fog.strength = 0.6;
  fireLive();
  assert.equal(String(fogRange().value), "70", "a slider just moved by the person keeps their value");
  // TK-367.1 (owner: «по 2 кнопки в ряду», short labels): «Керування»'s buttons sit in two-column grids, each button in
  // its own row with its own devtools path (links, search and the reveal outline still find it).
  const gridPaths = byClass("devtools__button-grid", liveUi.body)
    .map((grid) => byClass("devtools__row", grid).map((row) => row.dataset.devtoolsPath));
  // TK-398: «Автоматична погода» is a switch right under «Оновити» (a last odd button takes the whole line).
  assert.equal(JSON.stringify(gridPaths[0]), JSON.stringify(["WEATHER.controls.refresh"]), "«Оновити» alone in the first grid");
  const autoRow = () => byClass("devtools__row", liveUi.body).find((row) => row.dataset.devtoolsPath === "WEATHER.controls.auto");
  const autoInput = () => byClass("devtools__switch-input", autoRow())[0];
  assert.equal(autoInput().checked, true, "«Автоматична погода» is a switch, on");
  autoInput().checked = false;
  autoInput().fire("change", { target: autoInput() });
  assert.deepEqual([automatic, autoInput().checked], [false, false], "off reaches the weather port and the redrawn switch shows it");
  assert.ok(gridPaths.at(-1).includes("WEATHER.controls.strike") && gridPaths.at(-1).at(-1) === "WEATHER.controls.bolide",
    "the actions share the last grid, «Болід» at its end");
  const gridCss = require("node:fs").readFileSync(require("node:path").resolve(__dirname,
    "../../../src/dev/styles/dev-tools.css"), "utf8");
  assert.match(gridCss, /\n\.devtools__button-grid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/u,
    "the grid has two equal columns");
  assert.match(gridCss, /\n\.devtools__button-grid > \.devtools__row:last-child:nth-child\(odd\) \{ grid-column: 1 \/ -1; \}/u,
    "a last odd button takes the whole line");
  const bolideButton = () => byClass("devtools__action", liveUi.body).find((button) => button.innerText === "Болід");
  runtime.context.matchMedia = (query) => ({ matches: false, media: query });
  bolideButton().click();
  assert.deepEqual([bolides, tools.isOpen], [1, true], "on a computer «Болід зараз» drops a bolide and the panel stays");
  runtime.context.matchMedia = (query) => ({ matches: query === "(pointer: coarse)", media: query });
  bolideButton().click();
  assert.deepEqual([bolides, tools.isOpen], [2, false], "on a phone it drops a bolide and closes the panel");
  delete runtime.context.matchMedia;
  tools.dispose();
}

// --- TK-304 (spec 174 C2): seven modules on a rail, one page shown, the choice remembered -----------------------------
{
  const { DevTools } = runtime.importModule("src/dev/tools/dev_tools.js");
  const stored = new Map([["dev_tools_active_module", "data"]]);
  const storageCache = {
    get: (key, fallback) => stored.get(key) ?? fallback,
    set: (key, value) => stored.set(key, value),
    remove: (key) => stored.delete(key),
  };
  const railUi = new DevToolsUI(
    () => {},
    {},
    null,
    null,
    null,
    document.body,
    createElement("div"),
  );
  const tools = new DevTools(
    {
      debug: { flag: false },
      canvas: { rain: { enabled: false, opacity: 1 } },
    },
    { synchronize() {} },
    {
      catalogs: { items: {}, fishes: [], maps: {} },
      settingsStore: null,
      debugModulesSource: () => ({}),
      storageCache,
      createUI: () => ({
        ui: railUi,
        tooltipProvider: { ready: new Promise(() => {}) },
      }),
    },
  );
  tools.toggle();
  const buttons = byClass("devtools__rail-button");
  assert.deepEqual(
    buttons.map((button) => button.getAttribute("aria-label")),
    [
      "Гра",
      "Конфіг",
      "Бази",
      "Локація",
      "Сцена",
      "Діагностика",
      "Сервіс",
      "Панель",
    ],
    "seven modules in the spec's order, then the panel's own settings (TK-312)",
  );
  const pages = byClass("devtools__page");
  const shown = () =>
    pages
      .filter((page) => !page.hidden)
      .map((page) => page.dataset.devtoolsPage);
  assert.deepEqual(
    shown(),
    ["data"],
    "the remembered module opens; one page at a time",
  );
  assert.equal(buttons[2].getAttribute("aria-current"), "page");
  assert.equal(
    byClass("devtools__empty", pages[3]).length,
    1,
    "a module with nothing to show says so (no zone editor here)",
  );
  railUi.body.scrollTop = 120;
  buttons[1].click();
  assert.deepEqual(shown(), ["config"]);
  assert.equal(
    stored.get("dev_tools_active_module"),
    "config",
    "the choice is remembered",
  );
  assert.equal(
    railUi.body.scrollTop,
    0,
    "another module starts at its own top",
  );
  buttons[2].click();
  assert.equal(
    railUi.body.scrollTop,
    120,
    "and coming back restores where that module was scrolled",
  );
  // A link from the overlay (spec 177) to a parameter of another module shows that module first.
  assert.equal(
    tools.revealParameter(["CONFIG", "canvas", "rain", "opacity"]),
    true,
  );
  assert.deepEqual(
    shown(),
    ["config"],
    "revealing a parameter switches to its module",
  );
  buttons[0].click();
  // A blocked parameter whose switch is in another module shows that module (TK-292 feedback).
  const host = pages[0];
  railUi.addParameter(host, {
    control: "number",
    label: "rain opacity copy",
    value: 1,
    onCommit() {},
    path: ["TEST", "copy"],
    requires: [
      { path: ["CONFIG", "canvas", "rain", "enabled"], isEnabled: () => false },
    ],
  });
  byClass("devtools__row", host)
    .find((row) => row.children[0]?.dataset.devtoolsKey === "rain opacity copy")
    .fire("pointerdown");
  assert.deepEqual(
    shown(),
    ["config"],
    "the blocking switch's module is shown",
  );
  tools.dispose();
}

// --- Spec 180 stage E (TK-334): «Конфіг» shows every CONFIG key of the code ---------------------------------------------
{
  const rawUi = new DevToolsUI(() => {}, {}, null, null, null, document.body, createElement("div"));
  const host = createElement("div");
  rawUi.body.appendChild(host);
  const written = [];
  const { ConfigTreeRenderer } = runtime.importModule("src/dev/tools/config/config_tree_renderer.js");
  const { ConfigModule } = runtime.importModule("src/dev/tools/modules/config_module.js");
  const tree = new ConfigTreeRenderer({
    ui: rawUi, schema, aliases: { getAliasesForParent: () => [] },
    edits: { update: (path, value) => written.push([path.join("."), value]), isOverridden: () => false, resetParameter() {},
      read: () => undefined },
    createSection: (label, parent, path, options) => rawUi.createSection(label, parent, true, null, path, options),
  });
  const rowAt = (path) => byClass("devtools__row", host).find((row) => row.dataset.devtoolsPath === path);
  const inputOf = (path) => byClass("devtools__input", rowAt(path))[0];
  const data = { keys: ["Space", "KeyS"], hold: [], reelId: null, id: "feed_500", name: "Корм", amount: 2 };
  // Before stage E a text list, an empty list and a null value had no row at all.
  tree.render(data, host, ["CONFIG", "t"]);
  for (const path of ["CONFIG.t.keys", "CONFIG.t.hold", "CONFIG.t.reelId", "CONFIG.t.amount"]) assert.ok(rowAt(path), `${path} has a row`);
  assert.ok(!rowAt("CONFIG.t.id") && !rowAt("CONFIG.t.name"), "outside «Конфіг» the identifying keys stay hidden");
  assert.equal(inputOf("CONFIG.t.keys").value, "Space, KeyS", "a text list reads as commas");
  inputOf("CONFIG.t.keys").value = "Space, KeyA ,";
  inputOf("CONFIG.t.keys").fire("change");
  assert.equal(JSON.stringify(written.at(-1)), JSON.stringify(["CONFIG.t.keys", ["Space", "KeyA"]]), "and writes a text list");
  inputOf("CONFIG.t.hold").value = "KeyH";
  inputOf("CONFIG.t.hold").fire("change");
  assert.equal(JSON.stringify(written.at(-1)), JSON.stringify(["CONFIG.t.hold", ["KeyH"]]), "an empty list takes texts");
  assert.equal(inputOf("CONFIG.t.reelId").value, "null", "null shows as null");
  inputOf("CONFIG.t.reelId").value = "uuid-reel";
  inputOf("CONFIG.t.reelId").fire("change");
  inputOf("CONFIG.t.reelId").value = "";
  inputOf("CONFIG.t.reelId").fire("change");
  assert.equal(JSON.stringify(written.slice(-2)), JSON.stringify([["CONFIG.t.reelId", "uuid-reel"], ["CONFIG.t.reelId", null]]),
    "a nullable value writes a text, an empty field null");
  // raw («Конфіг»): the identifying keys show, read-only.
  host.replaceChildren();
  written.length = 0;
  tree.render(data, host, ["CONFIG", "t"], { raw: true });
  const idInput = inputOf("CONFIG.t.id");
  assert.ok(idInput && idInput.readOnly === true && idInput.value === "feed_500", "«Конфіг» shows id read-only");
  assert.ok(inputOf("CONFIG.t.name")?.readOnly === true, "and name");
  idInput.value = "other";
  idInput.fire("change");
  assert.equal(written.length, 0, "a read-only key never writes");
  // ConfigModule: CONFIG.debug in the code's order, the catalogs stay in «Бази».
  host.replaceChildren();
  const config = { liveBait: { a: 1 }, casting: { b: 2 }, debug: { seed: 0 }, locations: { map: { test: {} }, baseResolution: 1 },
    spawns: { fishes: {}, c: 3 } };
  new ConfigModule({ config }).mount(host, {
    createSection: (label, parent, path, options) => rawUi.createSection(label, parent, true, null, path, options), tree });
  const sectionPaths = byClass("devtools__section", host).map((section) => section.dataset.devtoolsPath);
  assert.equal(JSON.stringify(sectionPaths.filter((path) => path.split(".").length === 2)),
    JSON.stringify(["CONFIG.liveBait", "CONFIG.casting", "CONFIG.debug", "CONFIG.locations", "CONFIG.spawns"]),
    "every CONFIG group in the code's order, debug too");
  assert.ok(rowAt("CONFIG.debug.seed"), "debug's parameters are in «Конфіг»");
  assert.ok(!sectionPaths.includes("CONFIG.locations.map") && !sectionPaths.includes("CONFIG.spawns.fishes"),
    "the catalogs merged into CONFIG stay in «Бази»");
  // TK-364: «DEBUG» → «godMode» warns at its top while infinite casting is on: the pole's virtual reel and its values.
  host.replaceChildren();
  const { DebugModule } = runtime.importModule("src/dev/tools/modules/debug_module.js");
  const godConfig = { debug: { seed: 0, godMode: { enabled: true, infiniteCasting: true,
    infiniteCastingLine: { reserveMeters: 300, poleRetrieveSpeedMetersPerSec: 1.5, poleMinEfficiency: 0.25 } } } };
  const debugModule = new DebugModule({ config: godConfig });
  debugModule.mount(host, { ui: rawUi, tree, edits: { update() {}, isOverridden: () => false, resetParameter() {} },
    createSection: (label, parent, path, options) => rawUi.createSection(label, parent, true, null, path, options) });
  rawUi.materializeAll();
  const godSection = byClass("devtools__section", host).find((section) => section.dataset.devtoolsPath === "CONFIG.debug.godMode");
  const godAlert = godSection && byClass("devtools__alert", godSection)[0];
  assert.ok(godAlert && !godAlert.hidden, "«godMode» shows the infinite casting warning");
  const godText = byClass("devtools__alert-line", godAlert).map((line) => line.innerText).join("\n");
  assert.ok(godText.includes("ВІРТУАЛЬНА ПІДМОТКА 1.5 м/с") && godText.includes("25 %") && godText.includes("300 м"),
    "with the pole's virtual reel values and the reel's reserve");
  assert.ok(rowAt("CONFIG.debug.godMode.infiniteCasting"), "the God mode switches stay in the section");
  // TK-364.2: a live refresh with the same values does not rewrite the warning.
  const firstGodLine = byClass("devtools__alert-line", godAlert)[0];
  let godLineWrites = 0;
  let godLineText = firstGodLine.innerText;
  Object.defineProperty(firstGodLine, "innerText", { configurable: true, get: () => godLineText,
    set: (value) => { godLineWrites += 1; godLineText = value; } });
  for (let refresh = 0; refresh < 3; refresh += 1) debugModule.refreshLive();
  assert.equal(godLineWrites, 0, "live refreshes with unchanged values leave the warning's text alone");
  godConfig.debug.godMode.infiniteCastingLine.poleRetrieveSpeedMetersPerSec = 2;
  debugModule.refreshLive();
  assert.ok(byClass("devtools__alert-line", godAlert).some((line) => line.innerText.includes("ВІРТУАЛЬНА ПІДМОТКА 2 м/с")),
    "a changed value shows on the live refresh");
  godConfig.debug.godMode.infiniteCasting = false;
  debugModule.refreshLive();
  assert.equal(godAlert.hidden, true, "without infinite casting the warning hides");
  godConfig.debug.godMode.infiniteCasting = true;
  godConfig.debug.godMode.enabled = false;
  debugModule.refreshLive();
  assert.equal(godAlert.hidden, true, "and with God mode off");
  rawUi.dispose?.();
}

// --- Spec 181 D5 (TK-344): «СТАТУСИ» gives and takes the player's statuses, its descriptions edit them live -----------
{
  const statusUi = new DevToolsUI(() => {}, {}, null, null, null, document.body, createElement("div"));
  const host = createElement("div");
  statusUi.body.appendChild(host);
  const { StatusEffectsModule } = runtime.importModule("src/dev/tools/modules/status_effects_module.js");
  const { PlayerStatusEffects } = runtime.importModule("src/game/application/world/player_status_effects.js");
  const { CONFIG: gameConfig } = runtime.importModule("src/game/config/runtime/game_config.js");
  const config = { statusEffects: JSON.parse(JSON.stringify(gameConfig.statusEffects)) };
  let clock = 0;
  const statuses = new PlayerStatusEffects({ now: () => clock, getDefinitions: () => config.statusEffects,
    scheduler: { setTimeout: () => 1, clearTimeout() {} } });
  // Spec 185 D4: the gas mask is held with its filter's modifiers (GasMaskProtection), which the section shows.
  const filterModifiers = { emission: { vignette: 0, blur: 0, blurRate: 1 }, radiation: { grain: 0.5 } };
  statuses.hold("gasMask", true, { source: "gasMask", modifiers: filterModifiers });
  // The edits write into the live config, as DevConfigEditService does.
  const edits = { update: (path, value) => { let node = config; const keys = path.slice(1);
    for (const key of keys.slice(0, -1)) node = node[key]; node[keys.at(-1)] = value; },
  isOverridden: () => false, resetParameter() {},
  read: (path) => path.slice(1).reduce((node, key) => node?.[key], config) };
  const createSection = (label, parent, path, options) => statusUi.createSection(label, parent, true, null, path, options);
  // The tree double keeps ConfigTreeRenderer.render(obj, parent, path): it records what the module hands it.
  const rendered = [];
  const tree = { render: (obj, parent, path) => rendered.push({ obj, path: path.join(".") }) };
  // TK-378.1: the module gets the port the game gives it (createPlayerStatusesDevPort), never the whole PlayerStatusEffects.
  const { createPlayerStatusesDevPort } = runtime.importModule("src/game/application/world/player_statuses_dev_port.js");
  new StatusEffectsModule({ config, statuses: createPlayerStatusesDevPort(statuses) })
    .mount(host, { ui: statusUi, createSection, tree, edits });
  const button = (label) => byClass("devtools__action", host).find((element) => element.innerText === label);
  const activeText = () => byClass("devtools__row", host).filter((row) => row.children[0]?.dataset.devtoolsKey &&
    ["vodka", "gasMask", "активні"].includes(row.children[0].dataset.devtoolsKey))
    .map((row) => `${row.children[0].dataset.devtoolsKey}=${byClass("devtools__value", row)[0]?.innerText}`);
  assert.equal(JSON.stringify(activeText()), JSON.stringify(["gasMask=баф · без таймера (gasMask) · emission.vignette 0, " +
    "emission.blur 0, emission.blurRate 1, radiation.grain 0.5"]), "the gas mask held with its filter's modifiers is shown");
  assert.ok(button("Видати: vodka") && !button("Видати: gasMask") && !button("Зняти: gasMask"),
    "a timed status can be given; a held one belongs to its source");
  button("Видати: vodka").click();
  assert.ok(statuses.has("vodka"), "«Видати» applies the status");
  assert.ok(activeText().includes("vodka=баф · ще 1:00 · emission.vignette 0.7, emission.blur 0.7, emission.blurRate 1"),
    "the active vodka with its time left and modifiers");
  // Deep sections open as drill-ins outside the module's host (DevToolsUI), so the row is looked up in the whole panel.
  assert.ok(rendered.length === 1 && rendered[0].obj === config.statusEffects && rendered[0].path === "CONFIG.statusEffects",
    "the descriptions are the live CONFIG.statusEffects as a tree of parameters");
  edits.update(["CONFIG", "statusEffects", "vodka", "modifiers", "emission", "vignette"], 0.3);
  assert.equal(statuses.modifier("emission", "vignette"), 0, "the gas mask still wins (product)");
  statuses.hold("gasMask", false);
  assert.equal(statuses.modifier("emission", "vignette"), 0.3, "a live edit reaches the active vodka at once");
  button("Зняти: vodka").click();
  assert.equal(statuses.has("vodka"), false, "«Зняти» ends it");
  statuses.hold("gasMask", true, { source: "gasMask", modifiers: filterModifiers });
  button("Видати: vodka").click();
  button("Зняти всі").click();
  assert.equal(JSON.stringify(statuses.list().map((entry) => entry.id)), JSON.stringify(["gasMask"]),
    "«Зняти всі» ends the timed ones, the slot keeps the gas mask's");
  statusUi.dispose?.();

  // TK-378.1 (owner: after a bottle of vodka every DevTools page but the first stayed empty): the whole panel opens with
  // the game's port and an active vodka; and a section that throws while it draws shows its error in its own page while
  // the other pages still draw.
  const { DevTools } = runtime.importModule("src/dev/tools/dev_tools.js");
  const openPanel = (port) => {
    const panelUi = new DevToolsUI(() => {}, {}, null, null, null, document.body, createElement("div"));
    const tools = new DevTools({ debug: {}, locations: { map: {} }, statusEffects: config.statusEffects }, { synchronize() {} }, {
      catalogs: { items: {}, fishes: [], maps: {} }, settingsStore: null, debugModulesSource: () => ({}),
      storageCache: { get: (key, fallback) => fallback, set() {}, remove() {} }, statuses: port,
      createUI: () => ({ ui: panelUi, tooltipProvider: { ready: new Promise(() => {}) } }) });
    const errors = [];
    const consoleError = console.error;
    console.error = (...args) => errors.push(args);
    try { tools.toggle(); } finally { console.error = consoleError; }
    // A page's host (its sections start closed): what was drawn into it.
    const find = (node, id) => node?.dataset?.devtoolsPage === id ? node
      : (node?.children ?? []).reduce((found, child) => found ?? find(child, id), null);
    const page = (id) => find(panelUi.body, id)?.children ?? [];
    return { panelUi, tools, errors, page };
  };
  button("Видати: vodka").click();
  const drunk = openPanel(createPlayerStatusesDevPort(statuses));
  assert.equal(drunk.errors.length, 0, "an active vodka draws without an error");
  assert.ok(byClass("devtools__row", drunk.panelUi.body).some((row) => row.children[0]?.dataset?.devtoolsKey === "vodka"),
    "«СТАТУСИ» shows the active vodka");
  assert.ok(drunk.page("config").length > 0, "and the other pages are drawn");
  // TK-396 (spec 186): the overlay's startup report without a clipboard goes to the panel's text dialog, never the
  // browser's prompt.
  drunk.tools.toggle();
  assert.equal(drunk.tools.showText("Звіт завантаження", "{\"version\":\"1\"}"), true, "DevTools shows a handed-over text");
  assert.equal(drunk.tools.isOpen, true, "and opens itself for it");
  const textDialog = byClass("devtools__dialog-text", document.body).at(-1);
  assert.equal(textDialog?.value, "{\"version\":\"1\"}", "in its text dialog, read-only, to copy from");
  drunk.tools.dispose();
  const broken = openPanel({ ...createPlayerStatusesDevPort(statuses), stacks: () => { throw new TypeError("stacks broke"); } });
  assert.equal(broken.errors.length, 1, "a section that throws is reported once in the console");
  const alert = byClass("devtools__alert", broken.panelUi.body).find((element) =>
    byClass("devtools__alert-line", element).some((line) => line.innerText === "stacks broke"));
  assert.ok(alert, "and shows its error in the panel (a phone has no console)");
  assert.ok(broken.page("config").length > 0, "the other pages still draw");
  broken.tools.dispose();
  statuses.clear();
}

// --- TK-335: the RANDOMIZER's report is visible right after «Запустити» ------------------------------------------------
{
  const randomUi = new DevToolsUI(() => {}, {}, null, null, null, document.body, createElement("div"));
  const host = createElement("div");
  randomUi.body.appendChild(host);
  const { RandomizerModule } = runtime.importModule("src/dev/tools/modules/randomizer_module.js");
  const runs = [];
  const probe = { id: "p", label: "Проба", run: (options) => { runs.push(options); return {
    rows: [["частка часу", "8.3%"], ["подій за годину", "0.30"]], histogram: [["0–1 год", 0.25], ["1–2 год", 0.75]] }; } };
  new RandomizerModule({ probes: [probe], randomSeed: () => 11 }).mount(host, {
    // The owner opened «РАНДОМАЙЗЕР»; every other section starts closed, as the panel remembers none.
    ui: randomUi, createSection: (label, parent, path, options) => randomUi.createSection(label, parent,
      path?.join(".") === "RANDOMIZER", null, path, options) });
  byClass("devtools__action", byClass("devtools__row", host).find((row) => row.dataset.devtoolsPath === "RANDOMIZER.run"))[0].click();
  assert.equal(JSON.stringify(runs), JSON.stringify([{ count: 1000, seed: 11 }]), "«Запустити» runs the probe");
  const reportRow = byClass("devtools__row", host).find((row) => row.children[0]?.dataset.devtoolsKey === "частка часу");
  assert.ok(reportRow, "the report has its rows");
  for (let node = reportRow.parentNode; node && node !== host; node = node.parentNode) {
    assert.ok(!node.classList?.contains("devtools__section-info") && node.hidden !== true && node.style?.display !== "none",
      "the report is shown at once — not in a closed section or the hidden «i» description");
  }
  const chart = byClass("devtools__section", host).find((section) => section.dataset.devtoolsPath === "RANDOMIZER.histogram");
  assert.ok(chart && !chart.classList.contains("devtools__section--drill"), "the histogram opens in place");
}

// --- TK-285: the command after a file export ------------------------------------------------------------------------
(async () => {
  const { ExportCommandNotice } = runtime.importModule(
    "src/dev/tools/controls/export_command_notice.js",
  );
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  const section = createElement("div");
  document.body.appendChild(section);
  ui.createButtonRow("Експорт зон", section, () => {});
  let closed = 0;
  ui.showExportCommand(section, {
    fileName: "zones-test.json",
    command: "npm run apply:zones -- zones-test.json",
    onClose: () => closed++,
  });
  const notice = () => byClass("devtools__export", section);
  assert.equal(
    section.children[0],
    notice()[0],
    "the notice is at the top of the section the file was exported from",
  );
  assert.ok(
    notice()[0].textContent.includes("zones-test.json"),
    "it names the downloaded file",
  );
  assert.equal(
    byClass("devtools__export-command", section)[0].textContent,
    "npm run apply:zones -- zones-test.json",
  );
  byClass("devtools__export-copy", section)[0].click();
  await settle();
  assert.ok(
    clipboard.includes("npm run apply:zones -- zones-test.json"),
    "the copy button puts the command on the clipboard",
  );
  assert.equal(
    notice()[0].classList.contains("devtools__export--copied"),
    true,
    "and says so",
  );
  ui.showExportCommand(section, {
    fileName: "zones-next.json",
    command: "npm run apply:zones -- zones-next.json",
  });
  assert.equal(notice().length, 1, "the next export replaces the notice");
  assert.ok(notice()[0].textContent.includes("zones-next.json"));
  ui.showExportCommand(section, {
    fileName: "zones-test.json",
    command: "x",
    onClose: () => closed++,
  });
  byClass("devtools__export-close", section)[0].click();
  assert.equal(notice().length, 0, "the close button removes it");
  assert.equal(
    closed,
    1,
    "and tells the section, which stops showing it again",
  );

  // No clipboard (a page opened over http on the local network): no error, the person is told to copy by hand.
  const timers = [];
  const offline = new ExportCommandNotice({
    fileName: "a.json",
    command: "npm run apply:radio -- a.json",
    documentRef: document,
    copyText: () => {
      throw new Error("clipboard unavailable");
    },
    scheduler: {
      setTimeout: (callback) => timers.push(callback),
      clearTimeout() {},
    },
  });
  section.appendChild(offline.element);
  byClass("devtools__export-copy", offline.element)[0].click();
  await settle();
  assert.equal(
    offline.element.classList.contains("devtools__export--copied"),
    false,
  );
  assert.ok(
    byClass("devtools__export-status", offline.element)[0].textContent.length >
      0,
    "the failure is explained in the notice",
  );
  timers.at(-1)();
  assert.equal(
    byClass("devtools__export-status", offline.element)[0].textContent,
    "",
    "the message clears after a moment",
  );
  offline.dispose();

  // --- TK-296: DevTools revealPath + DevToolsDependencyFeedback green highlight ------------------------------------
  {
    const revealDoc = new TestDocument();
    const baseCreate = revealDoc.createElement.bind(revealDoc);
    const scrolled = [];
    revealDoc.createElement = (tag) => {
      const element = baseCreate(tag);
      Object.defineProperty(element, "parentElement", {
        get() {
          return this.parentNode;
        },
      });
      element.closest = (selector) => {
        if (!selector.startsWith(".")) return null;
        const cls = selector.slice(1);
        let current = element;
        while (current) {
          if (current.classList?.contains(cls)) return current;
          current = current.parentNode;
        }
        return null;
      };
      element.querySelector = (selector) => {
        if (selector.startsWith(":scope > .")) {
          const cls = selector.slice(":scope > .".length);
          return (
            element.children.find((child) => child.classList.contains(cls)) ||
            null
          );
        }
        if (selector.startsWith(".")) {
          const cls = selector.slice(1);
          const found = revealDoc.all(
            (el) => el !== element && el.classList.contains(cls),
            element,
          )[0];
          if (found) return found;
        }
        const child = baseCreate("div");
        child.className = selector.replace(/^\./u, "");
        element.appendChild(child);
        return child;
      };
      element.scrollIntoView = (opts) => scrolled.push({ element, opts });
      return element;
    };

    const revealTimers = [];
    const clearedTimerIds = new Set();
    let nextTimerId = 1;
    const revealRuntime = new SourceRuntime({
      globals: {
        document: revealDoc,
        setTimeout: (fn) => {
          const id = nextTimerId++;
          revealTimers.push({ id, fn });
          return id;
        },
        clearTimeout: (id) => {
          clearedTimerIds.add(id);
        },
      },
    });
    const { DevToolsUI: RevealUI } = revealRuntime.importModule(
      "src/dev/tools/dev_tools_ui.js",
    );
    const { DevToolsDependencyFeedback } = revealRuntime.importModule(
      "src/dev/services/dev_tools_dependency_feedback.js",
    );
    const feedback = new DevToolsDependencyFeedback({
      scheduler: {
        setTimeout: (fn) => {
          const id = nextTimerId++;
          revealTimers.push({ id, fn });
          return id;
        },
        clearTimeout: (id) => {
          clearedTimerIds.add(id);
        },
      },
      durationMs: 2400,
    });
    const panelParent = revealDoc.createElement("div");
    revealDoc.body.appendChild(panelParent);
    const revealUi = new RevealUI(
      () => {},
      {},
      null,
      null,
      null,
      panelParent,
      revealDoc.createElement("div"),
      feedback,
    );
    const rootBody = revealUi.body;
    revealUi.togglePanel(true);

    const toggled = [];
    const configSection = revealUi.createSection(
      "CONFIG",
      rootBody,
      false,
      (open) => toggled.push(["CONFIG", open]),
      "CONFIG",
    );
    const configCanvas = revealUi.createSection(
      "canvas",
      configSection,
      false,
      null,
      "CONFIG.canvas",
    );
    revealUi.createInputRow("amplitude", 12, configCanvas, "number", () => {}, [
      "CONFIG",
      "canvas",
      "water",
      "amplitude",
    ]);
    const configAmplitudeRow = configCanvas.children.find((el) =>
      el.classList.contains("devtools__row"),
    );

    const sceneSection = revealUi.createSection(
      "Сцена",
      rootBody,
      false,
      (open) => toggled.push(["SCENE_LAYER", open]),
      "SCENE_LAYER",
    );
    const sceneWater = revealUi.createSection(
      "water",
      sceneSection,
      false,
      (open) => toggled.push(["sceneWater", open]),
      "CONFIG.canvas.water",
    );
    revealUi.createRangeRow("amplitude", 12, sceneWater, () => {}, [
      "CONFIG",
      "canvas",
      "water",
      "amplitude",
    ]);
    const sceneAmplitudeRow = sceneWater.children.find((el) =>
      el.classList.contains("devtools__row"),
    );

    const weatherSection = revealUi.createSection(
      "Погода",
      rootBody,
      false,
      (open) => toggled.push(["WEATHER", open]),
      "WEATHER",
    );
    revealUi.createButtonRow(
      "Блискавка",
      weatherSection,
      () => {},
      null,
      null,
      ["WEATHER", "controls", "strike"],
    );
    const strikeButtonRow = weatherSection.children.find((el) =>
      el.classList.contains("devtools__row"),
    );

    // Exact path prefers specialized SCENE_LAYER section over generic CONFIG root.
    assert.equal(
      revealUi.revealPath("CONFIG.canvas.water.amplitude"),
      true,
      "revealPath resolves matching parameter path",
    );
    const sceneSectionEl = sceneSection.closest(".devtools__section");
    const sceneWaterEl = sceneWater.closest(".devtools__section");
    const configSectionEl = configSection.closest(".devtools__section");
    assert.equal(
      sceneSection.style.display,
      "block",
      "expands specialized parent section content",
    );
    assert.equal(
      sceneSectionEl.children[0].getAttribute("aria-expanded"),
      "true",
      "marks parent section aria-expanded",
    );
    assert.equal(
      sceneWater.style.display,
      "block",
      "expands nested water subsection content",
    );
    assert.equal(
      sceneWaterEl.children[0].getAttribute("aria-expanded"),
      "true",
      "marks subsection aria-expanded",
    );
    assert.equal(
      configSection.style.display,
      "none",
      "keeps duplicate generic CONFIG section closed",
    );
    assert.equal(
      configSectionEl.children[0].getAttribute("aria-expanded"),
      "false",
    );
    assert.equal(
      sceneAmplitudeRow.classList.contains("devtools__row--revealed"),
      true,
      "highlights target specialized row",
    );
    assert.equal(
      configAmplitudeRow.classList.contains("devtools__row--revealed"),
      false,
      "does not highlight duplicate generic row",
    );
    assert.equal(
      scrolled.at(-1)?.element,
      sceneAmplitudeRow,
      "scrolls revealed row into view",
    );
    assert.equal(scrolled.at(-1)?.opts?.block, "center");
    assert.deepEqual(
      toggled,
      [
        ["sceneWater", true],
        ["SCENE_LAYER", true],
      ],
      "persists opened state via onToggle callbacks",
    );

    // Revealing another path clears previous highlight and works with createButtonRow + timeout auto-clear.
    assert.equal(
      revealUi.revealPath(["WEATHER", "controls", "strike"]),
      true,
      "revealPath resolves array path for button rows",
    );
    assert.equal(
      sceneAmplitudeRow.classList.contains("devtools__row--revealed"),
      false,
      "previous reveal highlight clears",
    );
    assert.equal(
      strikeButtonRow.classList.contains("devtools__row--revealed"),
      true,
      "button row is highlighted",
    );
    assert.equal(
      weatherSection.style.display,
      "block",
      "expands weather section",
    );
    assert.equal(
      clearedTimerIds.has(revealTimers[0].id),
      true,
      "cancels superseded reveal timer",
    );
    revealTimers.at(-1).fn();
    assert.equal(
      strikeButtonRow.classList.contains("devtools__row--revealed"),
      false,
      "highlight clears automatically after timeout",
    );

    // Prefix fallback finds parent section path and togglePanel(false) clears highlight + timer.
    weatherSection.closest(".devtools__section").children[0].click();
    assert.equal(
      weatherSection.style.display,
      "none",
      "sanity: weather section starts collapsed",
    );
    assert.equal(
      revealUi.revealPath("WEATHER.controls.missingLeaf"),
      true,
      "falls back to registered section prefix when leaf is absent",
    );
    assert.equal(
      weatherSection.style.display,
      "block",
      "expands section matched by prefix fallback",
    );
    const weatherTitle =
      weatherSection.closest(".devtools__section").children[0];
    assert.equal(
      weatherTitle.classList.contains("devtools__row--revealed"),
      true,
      "highlights section header on section fallback",
    );
    const activeTimerId = revealTimers.at(-1).id;
    revealUi.togglePanel(false);
    assert.equal(
      clearedTimerIds.has(activeTimerId),
      true,
      "closing DevTools cancels pending reveal timer",
    );
    assert.equal(
      weatherTitle.classList.contains("devtools__row--revealed"),
      false,
      "closing DevTools clears highlight",
    );
    assert.equal(
      revealUi.revealPath("UNKNOWN.path"),
      false,
      "returns false for unknown path",
    );
  }

  // --- TK-328: «Змінені» shows changes in their owning section (without duplicating into «Конфіг») and flattens «Конфіг» when entered ---
  {
    const { ConfigTreeRenderer } = runtime.importModule(
      "src/dev/tools/config/config_tree_renderer.js",
    );
    const { DevConfigEditService } = runtime.importModule(
      "src/dev/tools/config/dev_config_edit_service.js",
    );
    const { DevToolsParameterAliasRegistry } = runtime.importModule(
      "src/dev/services/dev_tools_parameter_alias_registry.js",
    );
    const baseConfig = {
      canvas: { rain: { gravityPx: 400, durationSec: [120, 240] } },
      weather: { storm: { gustChanceMult: 1.5 } },
      casting: { basePower: 10 },
      locations: {
        map: { test: { weather: { rain: { chancePerCheck: 0.1 } } } },
      },
      debug: { waveTestBackground: false },
    };
    const config = JSON.parse(JSON.stringify(baseConfig));
    const overrides = new Set();
    const readKey = (obj, parts) => parts.reduce((cur, key) => cur?.[key], obj);
    const writeKey = (obj, parts, val) => {
      let cur = obj;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts.at(-1)] = val;
    };
    const configRuntime = {
      overrideStore: { has: (key) => overrides.has(key) },
      set(path, value) {
        const parts = path.slice(1);
        overrides.add(parts.join("."));
        writeKey(config, parts, value);
      },
      reset(path) {
        const parts = path.slice(1);
        overrides.delete(parts.join("."));
        writeKey(
          config,
          parts,
          JSON.parse(JSON.stringify(readKey(baseConfig, parts))),
        );
      },
    };
    const ui = new DevToolsUI(
      () => {},
      config,
      null,
      null,
      null,
      document.body,
      createElement("div"),
    );
    const pages = ui.createPages(
      [
        { id: "game", title: "Гра", icon: "hook" },
        { id: "config", title: "Конфіг", icon: "sliders" },
        { id: "scene", title: "Сцена", icon: "map" },
      ],
      "scene",
      () => {},
    );
    const aliases = new DevToolsParameterAliasRegistry();
    const edits = new DevConfigEditService({
      config,
      catalogs: {},
      configRuntime,
      getHookedFish: () => null,
      hookedFishSync: { afterEdit() {} },
      itemStatSync: { afterEdit() {} },
      debugModulesSource: () => ({}),
      syncValue: (path, value) => ui.syncValue(path, value),
      eventTarget: { dispatchEvent() {} },
      logger: { log() {} },
      parameterAliases: aliases,
    });
    const tree = new ConfigTreeRenderer({
      ui,
      edits,
      aliases,
      schema: { describe: () => null, prerequisitesOf: () => [] },
      createSection: (title, parent, path, options = {}) =>
        ui.createSection(title, parent, false, () => {}, path, options),
    });
    const configSection = ui.createSection(
      "НАЛАШТУВАННЯ (CONFIG)",
      pages.get("config"),
      false,
      () => {},
      ["CONFIG"],
    );
    tree.render(config, configSection, ["CONFIG"]);

    const gameDebugSection = ui.createSection(
      "DEBUG",
      pages.get("game"),
      false,
      () => {},
      ["CONFIG", "debug"],
    );
    tree.render(config.debug, gameDebugSection, ["CONFIG", "debug"]);

    const sceneSection = ui.createSection(
      "ПОГОДА",
      pages.get("scene"),
      false,
      () => {},
      ["WEATHER"],
    );
    const rainGroup = ui.createSection("ДОЩ", sceneSection, false, () => {}, [
      "WEATHER",
      "rain",
    ]);
    const chancePath = [
      "CONFIG",
      "locations",
      "map",
      "test",
      "weather",
      "rain",
      "chancePerCheck",
    ];
    ui.createInputRow(
      "Дощ: шанс перевірки",
      config.locations.map.test.weather.rain.chancePerCheck,
      rainGroup,
      "number",
      (next) => edits.update(chancePath, next),
      ["WEATHER", "chances", "rainChance"],
      chancePath,
      {
        isChanged: () => edits.isOverridden(chancePath),
        onReset: () => edits.resetParameter(chancePath),
      },
    );
    tree.render(config.locations.map.test.weather.rain, rainGroup, [
      "CONFIG",
      "locations",
      "map",
      "test",
      "weather",
      "rain",
    ]);
    const rainTree = ui.createSection(
      "Вигляд (загальний)",
      rainGroup,
      false,
      () => {},
      ["WEATHER", "rain", "look"],
    );
    tree.render(config.canvas.rain, rainTree, ["CONFIG", "canvas", "rain"]);
    const gustPath = ["CONFIG", "weather", "storm", "gustChanceMult"];
    ui.addParameter(sceneSection, {
      control: "number",
      label: "Шторм: пориви ×",
      value: config.weather.storm.gustChanceMult,
      path: ["WEATHER", "wind", "events", "gustChanceMult", "storm"],
      bindingPath: gustPath,
      onCommit: (next) => edits.update(gustPath, next),
      isChanged: () => edits.isOverridden(gustPath),
      onReset: () => edits.resetParameter(gustPath),
    });

    // Change a numberList, a CONFIG.* parameter rendered in Scene, and an event row wired via bindingPath.
    edits.update(["CONFIG", "canvas", "rain", "durationSec"], [60, 180]);
    edits.update(["CONFIG", "canvas", "rain", "gravityPx"], 500);
    edits.update(gustPath, 2.2);

    const rowsOn = (page, predicate = () => true) =>
      byClass("devtools__row--match", page).filter(predicate);
    const configPage = pages.get("config");
    const scenePage = pages.get("scene");
    const gamePage = pages.get("game");
    const durationInScene = byClass("devtools__row", scenePage).find(
      (row) => row.children[0]?.dataset?.devtoolsKey === "durationSec",
    );
    assert.equal(
      durationInScene.classList.contains("devtools__row--changed"),
      true,
      "numberList marks changed values",
    );
    assert.equal(
      byClass("devtools__reset", durationInScene).length,
      1,
      "numberList gets a reset button",
    );

    // Even when reveal mode is preferred for text search, «Змінені» still filters cleanly.
    ui.setPanelOptions({ searchMode: "reveal" });
    const panel = ui.body.parentNode;
    const filter = byClass("devtools__filter", panel)[0];
    filter.click();
    assert.equal(ui.body.classList.contains("devtools__body--filtered"), true);
    assert.equal(
      ui.body.classList.contains("devtools__body--revealing"),
      false,
    );
    assert.equal(
      ui.body.classList.contains("devtools__body--flat-sections"),
      false,
    );
    assert.equal(
      scenePage.classList.contains("devtools__page--match"),
      true,
      "scene shows its changed parameters",
    );
    assert.equal(
      configPage.classList.contains("devtools__page--match"),
      false,
      "Config does not appear when every changed CONFIG parameter lives in Scene",
    );
    assert.equal(rowsOn(scenePage).length, 3);
    assert.equal(rowsOn(configPage).length, 0);

    // Also change parameters skipped by ConfigModule (locations.map.* in Scene, debug.* in Game) + a Config-only one.
    edits.update(["CONFIG", "casting", "basePower"], 15);
    edits.update(chancePath, 0.35);
    edits.update(["CONFIG", "debug", "waveTestBackground"], true);
    ui.refreshFilter();
    assert.equal(configPage.classList.contains("devtools__page--match"), true);
    assert.deepEqual(
      rowsOn(configPage).map((row) => row.children[0]?.dataset?.devtoolsKey),
      ["basePower"],
    );
    assert.equal(rowsOn(scenePage).length, 5);
    assert.deepEqual(
      rowsOn(gamePage).map((row) => row.children[0]?.dataset?.devtoolsKey),
      ["waveTestBackground"],
    );

    // Entering Конфіг with «Змінені» active flattens sections and includes ALL unique changed parameters across the
    // panel (both ConfigModule rows and skipped CONFIG.locations.map / CONFIG.debug rows from other pages, deduplicated).
    ui.selectPage("config", { remember: true });
    assert.equal(
      ui.body.classList.contains("devtools__body--flat-sections"),
      true,
      "Config uses flat sections mode",
    );
    const allMatchedKeys = byClass("devtools__row--match", ui.body)
      .map((row) => row.children[0]?.dataset?.devtoolsKey)
      .sort();
    assert.deepEqual(allMatchedKeys, [
      "basePower",
      "chancePerCheck",
      "durationSec",
      "gravityPx",
      "gustChanceMult",
      "waveTestBackground",
    ]);
    assert.deepEqual(
      rowsOn(configPage)
        .map((row) => row.children[0]?.dataset?.devtoolsKey)
        .sort(),
      ["basePower", "durationSec", "gravityPx", "gustChanceMult"],
    );
    assert.deepEqual(
      rowsOn(scenePage).map((row) => row.children[0]?.dataset?.devtoolsKey),
      ["chancePerCheck"],
    );
    assert.deepEqual(
      rowsOn(gamePage).map((row) => row.children[0]?.dataset?.devtoolsKey),
      ["waveTestBackground"],
    );

    // Switching back to Scene restores specialized ownership and drops flat mode.
    ui.selectPage("scene", { remember: true });
    assert.equal(
      ui.body.classList.contains("devtools__body--flat-sections"),
      false,
    );
    assert.equal(scenePage.classList.contains("devtools__page--match"), true);
    assert.deepEqual(
      rowsOn(configPage).map((row) => row.children[0]?.dataset?.devtoolsKey),
      ["basePower"],
    );

    // Resetting numberList clears its changed state and drops it from filtered results.
    byClass("devtools__reset", durationInScene)[0].click();
    assert.equal(
      durationInScene.classList.contains("devtools__row--changed"),
      false,
    );
    ui.refreshFilter();
    assert.equal(rowsOn(scenePage).length, 4);

    filter.click();
    assert.equal(ui.body.classList.contains("devtools__body--filtered"), false);
    assert.equal(
      ui.body.classList.contains("devtools__body--flat-sections"),
      false,
    );
    ui.dispose();
  }

  // --- TK-330: clicking «Викид: пік зараз» inside drilled-in «Стан і керування» updates the switch immediately ---
  {
    const { WeatherDevSection } = runtime.importModule(
      "src/dev/tools/weather_dev_section.js",
    );
    const { EmissionModel } = runtime.importModule(
      "src/game/domain/weather/emission_model.js",
    );
    const { SeededRng } = runtime.importModule(
      "src/engine/random/seeded_rng.js",
    );
    const emissionSettings = {
      emission: {
        durationSec: [300, 300],
        peakAtShare: [0.25, 0.25],
        peakShare: [0.4, 0.4],
        peakStrength: [1, 1],
      },
      radiation: { base: 0, emissionPeak: 1 },
    };
    const emission = new EmissionModel({
      rng: new SeededRng(3),
      getSettings: () => emissionSettings,
    });
    const weatherModel = {
      snapshot: {
        events: {},
        strikeSerial: 0,
        strikeVariant: 0,
        strikeDistance: 0,
      },
      start() {},
      stop() {},
      hold() {},
      releaseAll() {},
      strike() {},
    };
    const ui = new DevToolsUI(
      () => {},
      {},
      null,
      null,
      null,
      document.body,
      createElement("div"),
    );
    const pages = ui.createPages(
      [{ id: "scene", title: "Сцена", icon: "map" }],
      "scene",
      () => {},
    );
    const scenePage = pages.get("scene");
    const createSection = (label, parent, path, options = {}) =>
      ui.createSection(label, parent, false, () => {}, path, options);
    // Match real SceneModule depth: СЦЕНА WebGL (0) -> ПОГОДА (1) -> Стан і керування (2, drill-in).
    const sceneLayerContent = createSection("СЦЕНА WebGL", scenePage, [
      "SCENE_LAYER",
    ]);
    const section = new WeatherDevSection({
      ui,
      weather: {
        locationId: "test",
        getModel: () => weatherModel,
        getEmissionModel: () => emission,
        getWind: () => null,
      },
      config: () => emissionSettings,
      createSection,
      renderConfigTree() {},
    });
    section.render(sceneLayerContent);

    const weatherContent = byClass(
      "devtools__section-content",
      sceneLayerContent,
    )[0];
    const controlsSection = byClass("devtools__section", weatherContent).find(
      (el) => el.dataset.devtoolsPath === "WEATHER.controls",
    );
    assert.equal(
      controlsSection.classList.contains("devtools__section--drill"),
      true,
      "Стан і керування opens as drill-in under СЦЕНА WebGL -> ПОГОДА",
    );
    controlsSection.children[0].click();
    assert.equal(scenePage.classList.contains("devtools__page--drilled"), true);

    const visibleEmissionSwitch = () =>
      byClass("devtools__row", byClass("devtools__drill", scenePage)[0]).find(
        (row) => row.dataset.devtoolsPath === "WEATHER.controls.emission",
      )?.children[1]?.children[0];
    const visiblePeakBtn = () =>
      byClass("devtools__row", byClass("devtools__drill", scenePage)[0]).find(
        (row) => row.dataset.devtoolsPath === "WEATHER.emission.peak",
      )?.children[0];

    assert.equal(
      visibleEmissionSwitch().checked,
      false,
      "emission switch starts OFF",
    );
    emission.holdIntensity(0);
    assert.equal(emission.snapshot.phase, "idle");

    visiblePeakBtn().click();
    assert.equal(
      emission.snapshot.phase,
      "peak",
      "force('peak') clears zero hold and enters peak",
    );
    assert.equal(
      scenePage.classList.contains("devtools__page--drilled"),
      true,
      "stays inside Стан і керування drill-in",
    );
    assert.equal(
      visibleEmissionSwitch().checked,
      true,
      "visible emission switch immediately updates to ON",
    );

    // Crumbs back to ПОГОДА leave the drill cleanly on the rebuilt DOM.
    byClass("devtools__crumb", scenePage)
      .find((crumb) => crumb.textContent === "ПОГОДА")
      .click();
    assert.equal(
      scenePage.classList.contains("devtools__page--drilled"),
      false,
    );
    section.dispose();
    ui.dispose();
  }

  // --- TK-347: from-to numeric pairs render two NumberField controls with - / + step buttons ---
  {
    const { ConfigTreeRenderer } = runtime.importModule("src/dev/tools/config/config_tree_renderer.js");
    const { DevConfigEditService } = runtime.importModule("src/dev/tools/config/dev_config_edit_service.js");
    const { DevToolsParameterAliasRegistry } = runtime.importModule("src/dev/services/dev_tools_parameter_alias_registry.js");
    const baseConfig = {
      canvas: { rain: { strength: { lengthJitter: [0.08, 0.2] } } },
      emission: { screen: { vignette: { clearRadius: [0.95, 0.15] } } },
      ui: { rgb: [10, 20, 30] },
    };
    const config = JSON.parse(JSON.stringify(baseConfig));
    const overrides = new Set();
    const readKey = (obj, parts) => parts.reduce((cur, key) => cur?.[key], obj);
    const writeKey = (obj, parts, val) => {
      let cur = obj;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts.at(-1)] = val;
    };
    const configRuntime = {
      overrideStore: { has: (key) => overrides.has(key) },
      set(path, value) {
        const parts = path.slice(1);
        overrides.add(parts.join("."));
        writeKey(config, parts, value);
      },
      reset(path) {
        const parts = path.slice(1);
        overrides.delete(parts.join("."));
        writeKey(config, parts, JSON.parse(JSON.stringify(readKey(baseConfig, parts))));
      },
    };
    const pairUi = new DevToolsUI(() => {}, config, null, null, null, document.body, createElement("div"));
    const pages = pairUi.createPages([{ id: "scene", title: "Сцена", icon: "map" }], "scene", () => {});
    const scenePage = pages.get("scene");
    const aliases = new DevToolsParameterAliasRegistry();
    const edits = new DevConfigEditService({
      config,
      catalogs: {},
      configRuntime,
      getHookedFish: () => null,
      hookedFishSync: { afterEdit() {} },
      itemStatSync: { afterEdit() {} },
      debugModulesSource: () => ({}),
      syncValue: (path, value) => pairUi.syncValue(path, value),
      eventTarget: { dispatchEvent() {} },
      logger: { log() {} },
      parameterAliases: aliases,
    });
    const tree = new ConfigTreeRenderer({
      ui: pairUi,
      edits,
      aliases,
      schema: { describe: () => null, prerequisitesOf: () => [] },
      createSection: (title, parent, path, options = {}) => pairUi.createSection(title, parent, false, () => {}, path, options),
    });
    tree.render(config.canvas.rain.strength, scenePage, ["CONFIG", "canvas", "rain", "strength"]);
    tree.render(config.emission.screen.vignette, scenePage, ["CONFIG", "emission", "screen", "vignette"]);
    tree.render(config.ui, scenePage, ["CONFIG", "ui"]);

    const rowOf = (key) => byClass("devtools__row", scenePage).find((row) => row.children[0]?.dataset?.devtoolsKey === key);
    const jitterRow = rowOf("lengthJitter");
    const pair = byClass("devtools__number-pair", jitterRow)[0];
    assert.ok(pair, "lengthJitter renders as a number pair");
    const [fromBox, toBox] = byClass("devtools__number", pair);
    const [fromDown, fromInput, fromUp] = fromBox.children;
    const [toDown, toInput, toUp] = toBox.children;
    assert.equal(fromInput.value, "0.08");
    assert.equal(toInput.value, "0.2");

    fromUp.click();
    assert.equal(JSON.stringify(config.canvas.rain.strength.lengthJitter), JSON.stringify([0.09, 0.2]),
      "+ steps first bound at its own precision");
    toDown.click();
    assert.equal(JSON.stringify(config.canvas.rain.strength.lengthJitter), JSON.stringify([0.09, 0.1]),
      "- steps second bound independently");
    assert.equal(jitterRow.classList.contains("devtools__row--changed"), true);

    byClass("devtools__reset", jitterRow)[0].click();
    assert.equal(JSON.stringify(config.canvas.rain.strength.lengthJitter), JSON.stringify([0.08, 0.2]),
      "reset restores both bounds");
    assert.equal(fromInput.value, "0.08");
    assert.equal(toInput.value, "0.2");
    assert.equal(jitterRow.classList.contains("devtools__row--changed"), false);

    // Inverted bounds ([from > to]) stay independent without clamping.
    const radiusRow = rowOf("clearRadius");
    const [rFrom, rTo] = byClass("devtools__number", radiusRow);
    rFrom.children[2].click();
    assert.equal(JSON.stringify(config.emission.screen.vignette.clearRadius), JSON.stringify([0.96, 0.15]));
    assert.equal(rTo.children[1].value, "0.15");

    // 3+ number arrays (RGB triplets, liveBait capacities) stay comma-separated text lists.
    const rgbRow = rowOf("rgb");
    assert.equal(byClass("devtools__number-pair", rgbRow).length, 0);
    assert.equal(byClass("devtools__input--text", rgbRow)[0].value, "10, 20, 30");

    // createInputRow with a 2-number array also builds NumberPairField.
    pairUi.createInputRow("customRange", [1, 5], scenePage, "array", () => {}, ["TEST", "customRange"]);
    assert.equal(byClass("devtools__number", rowOf("customRange")).length, 2);

    pairUi.dispose();
  }

  console.log(
    "DevTools controls passed: number field steps, modifiers, typed values, rejected text, external values and held buttons; list picker search, keyboard, unknown ids; segmented options; export command notice.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
