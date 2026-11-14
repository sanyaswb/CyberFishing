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
    const child = createElement("div"); child.className = selector.slice(1); element.appendChild(child); return child;
  };
  return element;
};
// Rows made through DevToolsUI use the page's timers; nothing in this check waits for them.
const clipboard = [];
const runtime = new SourceRuntime({ globals: { document, setTimeout: () => 0, clearTimeout() {}, CustomEvent,
  navigator: { clipboard: { writeText: async (text) => { clipboard.push(text); } } } } });
const { DevToolsUI } = runtime.importModule("src/dev/tools/dev_tools_ui.js");
const { NumberField } = runtime.importModule("src/dev/tools/controls/number_field.js");
const { addSteps, decimalsOf, parseDecimal } = runtime.importModule("src/dev/tools/controls/decimal_step.js");
const ui = new DevToolsUI(() => {}, {}, null, null, null, document.body, createElement("div"));

// --- TK-282: the number field ---------------------------------------------------------------------------------------
function numberRow(value, path = ["test", String(value)]) {
  const host = createElement("div"); document.body.appendChild(host);
  const written = [];
  ui.createInputRow("value", value, host, "number", (next) => written.push(next), path);
  const root = document.all((element) => element.className.split(" ").includes("devtools__number"), host)[0];
  const [down, input, up] = root.children;
  return { host, root, input, down, up, written };
}
{
  const { input, up, down, written } = numberRow(0.1);
  input.fire("keydown", { key: "ArrowUp" });
  assert.deepEqual(written, [0.2], "0.1 stepped up is 0.2 (the owner's case: it used to become 1.1)");
  input.fire("keydown", { key: "ArrowUp" });
  assert.deepEqual(written, [0.2, 0.3], "0.2 + 0.1 is written as 0.3, without a binary tail");
  assert.equal(input.value, "0.3");
  up.fire("pointerdown", { pointerId: 1 }); up.fire("pointerup"); up.fire("click");
  assert.equal(written.at(-1), 0.4, "one press of + is one step, not two");
  down.fire("pointerdown", { pointerId: 1 }); down.fire("pointerup"); down.fire("click");
  assert.equal(written.at(-1), 0.3);
  up.fire("click");
  assert.equal(written.at(-1), 0.4, "a click without a pointer press (keyboard) is a step too");
  input.fire("keydown", { key: "ArrowUp", shiftKey: true });
  assert.equal(written.at(-1), 1.4, "Shift steps ten times further");
  input.fire("keydown", { key: "ArrowDown", altKey: true });
  assert.equal(written.at(-1), 1.39, "Alt steps a tenth");
  assert.equal(input.fire("keydown", { key: "ArrowUp" }).prevented, true, "the field owns its up/down keys");
  assert.equal(written.at(-1), 1.4, "after an Alt step the field keeps the finer step");
  for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
    assert.equal(input.fire("keydown", { key }).prevented, false, `${key} is left to the caret`);
  }
}
{
  const { input, written } = numberRow(0.9);
  input.fire("keydown", { key: "ArrowUp" }); input.fire("keydown", { key: "ArrowUp" });
  assert.deepEqual(written, [1, 1.1], "the step stays 0.1 when the value passes a whole number");
}
{
  const { input, written } = numberRow(40);
  input.fire("keydown", { key: "ArrowDown" });
  assert.deepEqual(written, [39], "a whole number steps by one");
  input.value = "0,25"; input.fire("input"); input.fire("keydown", { key: "Enter" });
  assert.deepEqual(written, [39, 0.25], "a decimal comma is a decimal point");
  input.fire("keydown", { key: "ArrowUp" });
  assert.equal(written.at(-1), 0.26, "a typed finer value makes the step finer");
}
{
  const { root, input, written } = numberRow(5);
  for (const text of ["", "abc", "1.2.3", "--4"]) {
    input.value = text; input.fire("input"); input.fire("keydown", { key: "Enter" });
    assert.deepEqual(written, [], `"${text}" is never written (it used to write 0)`);
    assert.equal(root.classList.contains("devtools__number--error"), true, "the field shows the error");
    assert.equal(input.getAttribute("aria-invalid"), "true");
  }
  input.fire("blur");
  assert.equal(input.value, "5", "leaving the field restores the written value");
  assert.equal(root.classList.contains("devtools__number--error"), false);
  input.value = "7"; input.fire("input"); input.fire("keydown", { key: "Escape" });
  assert.equal(input.value, "5", "Escape restores the written value");
  input.fire("blur");
  assert.deepEqual(written, [], "a focus that changes nothing writes nothing");
  input.value = "12"; input.fire("input"); input.fire("blur");
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
  const timers = new Map(); let nextId = 1;
  const scheduler = { setTimeout: (callback, ms) => { timers.set(nextId, { callback, ms }); return nextId++; },
    clearTimeout: (id) => timers.delete(id) };
  const tick = () => { const [id, timer] = [...timers][0]; timers.delete(id); timer.callback(); return timer.ms; };
  const written = [];
  const field = new NumberField({ value: 1, onCommit: (next) => written.push(next), documentRef: document, scheduler });
  const up = field.element.children[2];
  up.fire("pointerdown", { pointerId: 1 });
  assert.deepEqual(written, [2]);
  const delay = tick(), repeat = tick();
  assert.deepEqual(written, [2, 3, 4], "holding + keeps stepping");
  assert.ok(delay > repeat, "the first repeat waits longer than the following ones");
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
const { DevParameterSchema } = runtime.importModule("src/dev/tools/config/dev_parameter_schema.js");
const byClass = (name, root) => document.all((element) => element.className.split(" ").includes(name), root);
// The real species and the real config: every rule of the schema must describe a parameter the game has.
const { FISH_DB } = runtime.importModule("src/game/config/databases/fish_database.js");
const { CONFIG } = runtime.importModule("src/game/config/runtime/game_config.js");
const fishOptions = FISH_DB.map((fish) => ({ value: fish.id, label: fish.name, hint: fish.id, imageUrl: "" }));
const schema = new DevParameterSchema({ sources: { fish: () => fishOptions } });
{
  const fishId = CONFIG.debug.fixedCatch.fishId;
  const described = schema.describe(["CONFIG", "debug", "fixedCatch", "fishId"], fishId);
  assert.equal(described.control, "choice", "Fixed Catch's fish is chosen from a list");
  assert.ok(described.options.some((option) => option.value === fishId), "the configured fish is one of the species");
  assert.equal(described.options.length, FISH_DB.length);
  for (const key of ["size", "openSize", "compactShape", "compactPlacement", "compactActionsSide"]) {
    const value = CONFIG.ui.inventorySelector[key];
    const options = schema.describe(["CONFIG", "ui", "inventorySelector", key], value)?.options.map((option) => option.value);
    assert.ok(options?.includes(value), `inventorySelector.${key} = ${value} is one of its listed values`);
  }
  assert.equal(schema.describe(["CONFIG", "debug", "inventorySplit", "defaultSide"], "right").control, "segments");
  assert.equal(schema.describe(["CONFIG", "debug", "fixedCatch", "weight"], 0.8), null, "other parameters keep their fields");
  assert.equal(new DevParameterSchema().describe(["CONFIG", "debug", "fixedCatch", "fishId"], fishId), null,
    "without the species list the parameter stays a text field");
}
function choiceRow(options, value, path) {
  const host = createElement("div"); document.body.appendChild(host);
  const written = [];
  ui.addParameter(host, { control: "choice", label: "fishId", options, value, onCommit: (next) => written.push(next), path });
  const root = byClass("devtools__choice", host)[0];
  const button = byClass("devtools__choice-button", root)[0];
  return { host, root, button, written, options: () => byClass("devtools__choice-option", root),
    search: () => byClass("devtools__choice-search", root)[0] };
}
{
  const first = fishOptions[0], second = fishOptions[1];
  const row = choiceRow(fishOptions, first.value, ["test", "fish"]);
  assert.ok(row.button.textContent.includes(first.label), "the closed field shows the chosen fish by name");
  assert.equal(row.options().length, 0, "the list is closed until asked for");
  row.button.click();
  assert.equal(row.button.getAttribute("aria-expanded"), "true");
  assert.equal(row.options().length, fishOptions.length, "the list offers every species");
  assert.equal(row.options()[0].getAttribute("aria-selected"), "true", "the current fish is marked");
  if (fishOptions.length >= 8) {
    // Searching by id finds the fish; nothing typed by hand reaches the config.
    row.search().value = second.hint.toUpperCase(); row.search().fire("input");
    assert.ok(row.options().length >= 1 && row.options().length < fishOptions.length, "typing narrows the list");
    assert.ok(row.options()[0].textContent.includes(second.label));
    row.search().value = "zzzz-no-such-fish"; row.search().fire("input");
    assert.equal(row.options().length, 0);
    row.root.fire("keydown", { key: "Enter", target: row.search() });
    assert.deepEqual(row.written, [], "Enter on an empty result writes nothing");
    row.search().value = ""; row.search().fire("input");
  }
  // Keyboard: down to the second fish, Enter chooses it.
  const down = row.root.fire("keydown", { key: "ArrowDown" });
  assert.equal(down.prevented && down.stopped, true, "the list's arrows are the list's (not the page's, not the game's)");
  row.root.fire("keydown", { key: "Enter" });
  assert.deepEqual(row.written, [second.value], "the chosen fish's id is written");
  assert.equal(row.options().length, 0, "choosing closes the list");
  assert.ok(row.button.textContent.includes(second.label));
  assert.equal(document.activeElement, row.button, "focus returns to the field");
  // Pointer: open, press a fish.
  row.button.click();
  row.options()[0].fire("click");
  assert.deepEqual(row.written, [second.value, first.value]);
  row.button.click(); row.options()[0].fire("click");
  assert.deepEqual(row.written, [second.value, first.value], "choosing the current fish again writes nothing");
  // Escape and focus leaving close without a change.
  row.button.click(); row.root.fire("keydown", { key: "Escape" });
  assert.equal(row.options().length, 0);
  row.button.click(); row.root.fire("focusout", { relatedTarget: document.body });
  assert.equal(row.options().length, 0, "focus leaving the field closes the list");
  assert.deepEqual(row.written, [second.value, first.value]);
  // A value changed elsewhere is shown.
  ui.syncValue(["test", "fish"], second.value);
  assert.ok(row.button.textContent.includes(second.label));
}
{
  const row = choiceRow(fishOptions, "no_such_fish", ["test", "unknown-fish"]);
  assert.ok(row.button.textContent.includes("no_such_fish"), "an id the game does not have stays visible");
  assert.equal(byClass("devtools__choice-hint--unknown", row.root).length, 1, "and is marked as unknown");
  assert.deepEqual(row.written, []);
}
{
  const host = createElement("div"); document.body.appendChild(host);
  const written = [];
  const options = [1, 2, 3].map((value) => ({ value, label: String(value) }));
  ui.addParameter(host, { control: "segments", label: "size", options, value: 2, onCommit: (next) => written.push(next),
    path: ["test", "size"] });
  const segments = byClass("devtools__segment", host);
  assert.deepEqual(segments.map((segment) => segment.textContent), ["1", "2", "3"], "every option is visible at once");
  assert.deepEqual(segments.map((segment) => segment.getAttribute("aria-checked")), ["false", "true", "false"]);
  segments[2].click();
  assert.deepEqual(written, [3], "one press selects an option and writes its value (a number stays a number)");
  segments[2].click();
  assert.deepEqual(written, [3], "pressing the selected option writes nothing");
  const key = segments[2].fire("keydown", { key: "ArrowRight" });
  assert.deepEqual(written, [3, 1], "the arrows move the selection round the group");
  assert.equal(key.prevented && key.stopped, true);
  ui.syncValue(["test", "size"], 2);
  assert.equal(segments[1].getAttribute("aria-checked"), "true", "a value changed elsewhere is shown");
  assert.deepEqual(written, [3, 1]);
}

// --- TK-293: every list is the list picker, under its label ---------------------------------------------------------
{
  const host = createElement("div"); document.body.appendChild(host);
  const chosen = [];
  ui.createSelectRow("Номер зони", ["1", "2", "Усі"], "2", host, (value) => chosen.push(value), ["test", "zone-number"],
    { swatches: { 1: "#ff0000" } });
  assert.equal(document.all((element) => element.tagName === "select", host).length, 0, "no browser select is left");
  const root = byClass("devtools__choice", host)[0], button = byClass("devtools__choice-button", root)[0];
  assert.ok(button.textContent.includes("2"), "the field shows the current value");
  assert.equal(host.children[0].classList.contains("devtools__row--stacked"), true, "the field and its list sit under the label");
  assert.equal(host.children[0].children[1], root, "the label comes first, the field after it");
  button.click();
  const options = byClass("devtools__choice-option", root);
  assert.deepEqual(options.map((option) => option.textContent), ["1", "2", "Усі"], "the list offers the same values");
  assert.equal(byClass("devtools__swatch", options[0]).length, 1, "a value's colour is shown in the list");
  options[2].fire("click");
  assert.deepEqual(chosen, ["Усі"], "the section receives the chosen value as before");
  assert.ok(button.textContent.includes("Усі"));
}

// --- TK-292: parameters that depend on a switch -----------------------------------------------------------------------
{
  const { DevToolsDependencyFeedback } = runtime.importModule("src/dev/services/dev_tools_dependency_feedback.js");
  const guardedUi = new DevToolsUI(() => {}, {}, null, null, null, document.body, createElement("div"),
    new DevToolsDependencyFeedback({ scheduler: { setTimeout: () => 1, clearTimeout() {} }, durationMs: 3000 }));
  const host = createElement("div"); document.body.appendChild(host);
  const group = { enabled: false };
  const switchPath = ["CONFIG", "test", "group", "enabled"];
  const requires = { requires: [{ path: switchPath, isEnabled: () => group.enabled }] };
  guardedUi.createSwitcherRow("enabled", false, host, (value) => { group.enabled = value; }, switchPath);
  const switchRow = host.children[0];
  const written = [];
  const write = (name) => (value) => written.push([name, value]);
  guardedUi.createInputRow("number", 5, host, "number", write("number"), ["CONFIG", "test", "group", "number"], undefined, requires);
  guardedUi.createInputRow("text", "abc", host, "string", write("text"), ["CONFIG", "test", "group", "text"], undefined, requires);
  guardedUi.addParameter(host, { control: "segments", label: "segments", options: [{ value: "a", label: "a" }, { value: "b", label: "b" }],
    value: "a", onCommit: write("segments"), path: ["CONFIG", "test", "group", "segments"], ...requires });
  guardedUi.addParameter(host, { control: "choice", label: "choice", options: [{ value: "x", label: "X" }, { value: "y", label: "Y" }],
    value: "x", onCommit: write("choice"), path: ["CONFIG", "test", "group", "choice"], ...requires });
  guardedUi.createInputRow("free", 1, host, "number", write("free"), ["CONFIG", "test", "free"]);
  const [, numberRow, textRow, segmentsRow, choiceRow, freeRow] = host.children;
  const dependent = [numberRow, textRow, segmentsRow, choiceRow];
  const inactive = (row) => row.classList.contains("devtools__row--dependency-disabled");
  const highlighted = () => switchRow.classList.contains("devtools__row--blocked-prerequisite");
  assert.deepEqual(dependent.map(inactive), [true, true, true, true], "with the switch off every dependent row is inactive");
  assert.equal(inactive(freeRow), false, "a parameter without that switch stays active");

  // The row answers before its control: pointer, keyboard and paste are stopped and the blocking switch is shown.
  for (const type of ["pointerdown", "click", "keydown", "beforeinput"]) {
    const event = numberRow.fire(type, { key: "ArrowUp" });
    assert.equal(event.prevented && event.stopped, true, `${type} on an inactive row is stopped`);
  }
  assert.equal(highlighted(), true, "an attempt highlights the switch that blocks it");
  assert.equal(numberRow.fire("keydown", { key: "Tab" }).prevented, false, "Tab still leaves the row");
  // Whatever still reaches a control is refused: nothing is written and the shown value is restored.
  const numberInput = byClass("devtools__input--number", numberRow)[0];
  numberInput.fire("keydown", { key: "ArrowUp" });
  assert.equal(numberInput.value, "5", "a number is not stepped");
  const textInput = byClass("devtools__input--text", textRow)[0];
  textInput.value = "typed"; textInput.fire("change", { target: textInput });
  assert.equal(textInput.value, "abc", "text is restored");
  byClass("devtools__segment", segmentsRow)[1].click();
  assert.equal(byClass("devtools__segment", segmentsRow)[0].getAttribute("aria-checked"), "true", "the segment stays");
  byClass("devtools__choice-button", choiceRow)[0].click();
  byClass("devtools__choice-option", choiceRow)[1].fire("click");
  assert.ok(byClass("devtools__choice-button", choiceRow)[0].textContent.includes("X"), "the list keeps its value");
  assert.deepEqual(written, [], "nothing is written through an inactive row");

  // Turning the switch on makes the rows active at once (no rebuild) and ends the highlight.
  byClass("devtools__switch-input", switchRow)[0].checked = true;
  byClass("devtools__switch-input", switchRow)[0].fire("change", { target: byClass("devtools__switch-input", switchRow)[0] });
  assert.equal(group.enabled, true);
  assert.deepEqual(dependent.map(inactive), [false, false, false, false], "with the switch on the rows are active");
  assert.equal(highlighted(), false);
  assert.equal(numberRow.fire("pointerdown").prevented, false, "an active row lets its control work");
  numberInput.fire("keydown", { key: "ArrowUp" });
  byClass("devtools__segment", segmentsRow)[1].click();
  assert.equal(JSON.stringify(written), JSON.stringify([["number", 6], ["segments", "b"]]));
  // Off again (from anywhere: the config changed): inactive again, the values stay shown.
  group.enabled = false; guardedUi.syncValue(switchPath, false);
  assert.deepEqual(dependent.map(inactive), [true, true, true, true], "switching off deactivates them again");
  assert.equal(numberInput.value, "6", "the value stays visible");
  guardedUi.dispose();
}
{
  // The dependencies of the real config: a group's `enabled`, `<name>Enabled`, and the named master switches.
  const read = (path) => path.slice(1).reduce((value, key) => value?.[key], CONFIG);
  const of = (text) => JSON.stringify(schema.prerequisitesOf(text.split("."), read).map((path) => path.join(".")));
  assert.equal(of("CONFIG.debug.fixedCatch.fishId"), JSON.stringify(["CONFIG.debug.fixedCatch.enabled"]),
    "Fixed Catch's fish and weight depend on its switch");
  assert.equal(of("CONFIG.debug.fixedCatch.enabled"), "[]", "a switch does not depend on itself");
  assert.equal(of("CONFIG.canvas.rain.rings.ripple.strength"),
    JSON.stringify(["CONFIG.canvas.rain.enabled", "CONFIG.canvas.rain.rings.enabled", "CONFIG.canvas.rain.rings.ripple.enabled"]),
    "a nested group depends on the outer switches too, outermost first");
  assert.equal(of("CONFIG.canvas.rain.rings.enabled"), JSON.stringify(["CONFIG.canvas.rain.enabled"]));
  assert.equal(of("CONFIG.debug.godMode.fixedBiteChancePercent"),
    JSON.stringify(["CONFIG.debug.godMode.enabled", "CONFIG.debug.godMode.fixedBiteChanceEnabled"]),
    "<name>Enabled gates its <name>… sibling");
  assert.equal(of("CONFIG.debug.godMode.infiniteCasting"), JSON.stringify(["CONFIG.debug.godMode.enabled"]));
  assert.equal(of("CONFIG.locations.showNetZone"), JSON.stringify(["CONFIG.locations.debugVisuals"]));
  assert.equal(of("CONFIG.locations.showChumZones"), "[]", "a zone the game draws without the overlay switch is independent");
  assert.equal(of("CONFIG.locations.cellSize"), "[]");
  assert.equal(JSON.stringify(schema.prerequisitesOf(["ITEM_DB", "rods", "x", "enabled2"], read)), "[]", "only CONFIG has switches");
  for (const text of ["CONFIG.locations.debugVisuals", "CONFIG.debug.overlay", "CONFIG.locations.showNetZone", "CONFIG.locations.showLastDashZone",
    "CONFIG.locations.showCatchZone", "CONFIG.locations.showPoleFightSector", "CONFIG.locations.showFightLineRadius", "CONFIG.debug.overlayUpdateMs"]) {
    assert.notEqual(read(text.split(".")), undefined, `${text} named by the schema exists in the config`);
  }
}

// --- TK-303 (spec 174 C1): DevTools' own icons, no emoji ---------------------------------------------------------------
{
  const fs = require("node:fs");
  const path = require("node:path");
  const toolsRoot = path.resolve(__dirname, "../../../src/dev/tools");
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
  // Emoji and the text arrows the panel used to draw (▶ ▼ ⏩): icons replace them, the same on every platform.
  const forbidden = /[\p{Extended_Pictographic}▶▼⏩]/u;
  for (const file of walk(toolsRoot).filter((name) => name.endsWith(".js"))) {
    fs.readFileSync(file, "utf8").split("\n").forEach((line, index) => {
      assert.equal(forbidden.test(line), false, `${path.relative(toolsRoot, file)}:${index + 1} draws an emoji; use createDevIcon`);
    });
  }
  const { DEV_ICONS, createDevIcon } = runtime.importModule("src/dev/tools/controls/dev_icon.js");
  // Every icon a DevTools source names exists.
  const named = new Set();
  for (const file of walk(toolsRoot).filter((name) => name.endsWith(".js"))) {
    const text = fs.readFileSync(file, "utf8");
    for (const [, name] of text.matchAll(/icon: "([a-z]+)"/gu)) named.add(name);
    for (const [, name] of text.matchAll(/createDevIcon\([^,]+, "([a-z]+)"/gu)) named.add(name);
    for (const [, name] of text.matchAll(/\(\) => this\.#open(?:Game|House)\(\), "([a-z]+)"/gu)) named.add(name);
  }
  for (const name of named) assert.ok(DEV_ICONS[name], `icon "${name}" exists`);
  assert.ok(named.has("gear") && named.has("chevron") && named.has("map"), "the scan found the panel's icons");
  const icon = createDevIcon(document, "chevron", "devtools__section-chevron");
  assert.equal(icon.getAttribute("class"), "devtools__icon devtools__section-chevron");
  assert.equal(icon.getAttribute("aria-hidden"), "true", "icons are decoration; the label names the control");
  // The sandbox has its own RangeError: compare by name.
  assert.throws(() => createDevIcon(document, "nope"), (error) => error.name === "RangeError");
  // A section title: chevron, optional icon, label; opening it is still one click.
  const host = createElement("div"); document.body.appendChild(host);
  const content = ui.createSection("Секція", host, false, () => {}, ["test", "section"], { icon: "map" });
  const title = content.parentNode.children[0];
  assert.equal(title.textContent, "Секція", "the title reads as its label only");
  assert.equal(title.children.length, 3, "chevron, icon, label");
  title.click();
  assert.equal(title.getAttribute("aria-expanded"), "true");
  assert.equal(content.style.display, "block");
}

// --- TK-302 (spec 174 B1): one description per parameter row -------------------------------------------------------
{
  const host = createElement("div"); document.body.appendChild(host);
  const written = [];
  const add = (spec) => ui.addParameter(host, { onCommit: (next) => written.push([spec.label, next]), ...spec });
  add({ control: "numberList", label: "list", value: [1, 2], path: ["test", "list"] });
  const list = byClass("devtools__input--text", host).at(-1);
  assert.equal(list.value, "1, 2", "a number list shows its numbers");
  list.value = "3, 4;5 x"; list.fire("change", { target: list });
  assert.equal(JSON.stringify(written.at(-1)), JSON.stringify(["list", [3, 4, 5, 0]]), "and writes them as numbers");
  ui.syncValue(["test", "list"], [7, 8]);
  assert.equal(list.value, "7, 8");
  add({ control: "range", label: "opacity", value: 30.4, path: ["test", "opacity"] });
  const range = byClass("devtools__range", host).at(-1);
  assert.equal(range.value, "30", "a slider shows the whole number");
  range.value = "55"; range.fire("input", { target: range });
  assert.equal(JSON.stringify(written.at(-1)), JSON.stringify(["opacity", 55]), "and writes while it moves");
  assert.equal(byClass("devtools__range-value", host).at(-1).textContent, "55");
  add({ control: "text", label: "name", value: "a", path: ["test", "name"], bindingPath: null });
  const name = byClass("devtools__input--text", host).at(-1);
  name.value = "b"; name.fire("change", { target: name });
  assert.equal(JSON.stringify(written.at(-1)), JSON.stringify(["name", "b"]), "a text field writes its text");
  let parentOn = false;
  add({ control: "switch", label: "child", value: false, path: ["test", "child"],
    requires: [{ path: ["test", "parent"], isEnabled: () => parentOn }] });
  const childInput = byClass("devtools__switch-input", host).at(-1);
  childInput.checked = true; childInput.fire("change", { target: childInput });
  assert.equal(childInput.checked, false, "a switch whose prerequisite is off stays off");
  assert.equal(written.some(([label]) => label === "child"), false);
  parentOn = true;
  childInput.checked = true; childInput.fire("change", { target: childInput });
  assert.equal(JSON.stringify(written.at(-1)), JSON.stringify(["child", true]), "and turns on once it is on");
}

// --- TK-299 (spec 174 B2): the one edit path, moved out of DevTools ---------------------------------------------------
{
  const { DevConfigEditService } = runtime.importModule("src/dev/tools/config/dev_config_edit_service.js");
  const { HookedFishEditSync } = runtime.importModule("src/dev/tools/config/hooked_fish_edit_sync.js");
  const { ItemStatAliasSync } = runtime.importModule("src/dev/tools/config/item_stat_alias_sync.js");
  const { DevToolsParameterAliasRegistry } = runtime.importModule("src/dev/services/dev_tools_parameter_alias_registry.js");
  const events = [], synced = [], logs = [], sets = [], resets = [];
  const config = { debug: { consoleModules: { forces: false }, fixedCatch: {}, godMode: { forceAnomalyChance: false } },
    canvas: { rain: { opacity: 1 } } };
  const overrides = { "canvas.rain.opacity": 0.5, "canvas.rain": {}, "canvas.rainy": 1 };
  const configRuntime = {
    set: (path, value) => { sets.push(path.join(".")); let target = config; for (const key of path.slice(1, -1)) target = target[key]; target[path.at(-1)] = value; },
    exportOverrides: () => overrides, reset: (key) => resets.push(key),
  };
  const rod = { itemType: "rod", displayStats: { level: 3, power: 4 }, gameplayStats: { equipmentPowerLevel: 3, basePower: 4 } };
  const fish = { id: "carp", weight: 1, physics: { forceProfile: { basePower: 2 } } };
  const synchronizations = [];
  const modules = {};
  const edits = new DevConfigEditService({ config, catalogs: { items: { rods: { rod } }, fishes: [{ id: "carp" }], maps: {} },
    configRuntime, configValidation: { report() {} }, parameterAliases: new DevToolsParameterAliasRegistry(),
    getHookedFish: () => fish,
    hookedFishSync: new HookedFishEditSync({ fishes: [{ id: "carp" }],
      synchronizer: { synchronize: (input) => { synchronizations.push(input.changedKey); return { range: { basePower: 7, baseSpeed: 1.5 } }; } } }),
    itemStatSync: new ItemStatAliasSync({ items: { rods: { rod } } }), debugModulesSource: () => modules,
    syncValue: (path, value) => synced.push([path.join("."), value]),
    eventTarget: { dispatchEvent: (event) => events.push([event.type, JSON.stringify(event.detail.path ?? event.detail.module)]) },
    logger: { log: (...args) => logs.push(args.join(" ")) } });
  edits.update(["CONFIG", "debug", "consoleModules", "forces"], true);
  assert.equal(sets.at(-1), "CONFIG.debug.consoleModules.forces", "CONFIG goes through the override store");
  assert.equal(modules.forces, true, "a console module switch reaches the console's module list");
  assert.equal(JSON.stringify(events.splice(0)), JSON.stringify([["debug-module-toggled", '"forces"'],
    ["config-updated", '["CONFIG","debug","consoleModules","forces"]']]));
  assert.equal(JSON.stringify(synced.at(-1)), JSON.stringify(["CONFIG.debug.consoleModules.forces", true]), "the panel's controls are synced");
  edits.update(["CONFIG", "debug", "fixedCatch", "hasAnomaly"], true);
  assert.equal(sets.at(-1), "CONFIG.debug.godMode.forceAnomalyChance", "a linked parameter is written at its canonical path");
  edits.update(["ITEM_DB", "rods", "rod", "displayStats", "power"], 9);
  assert.equal(rod.gameplayStats.basePower, 9, "an item's display stat keeps its gameplay stat equal");
  edits.update(["ITEM_DB", "rods", "rod", "gameplayStats", "equipmentPowerLevel"], 5);
  assert.equal(rod.displayStats.level, 5, "and the other way round");
  assert.ok(events.some(([type]) => type === "item-progression-updated"), "an item edit invalidates the item progression view");
  events.length = 0;
  edits.update(["HOOKED_FISH", "weight"], 2);
  assert.equal(fish.weight, 2);
  assert.equal(JSON.stringify(synchronizations), JSON.stringify(["weight"]), "a weight edit recomputes the level balance");
  assert.equal(fish.physics.levelBasePower, 7);
  assert.equal(fish.physics.movementProfile.baseSpeed, 1.5);
  edits.update(["HOOKED_FISH", "physics", "forceProfile", "basePower"], 3);
  assert.equal(fish.physics.basePower, 3, "a profile field updates its physics alias");
  assert.equal(JSON.stringify(events.map(([type]) => type)), JSON.stringify(["debug-hooked-fish-updated", "debug-hooked-fish-updated"]),
    "the hooked fish is announced as such, never as a config edit");
  assert.equal(edits.read(["HOOKED_FISH", "physics", "basePower"]), 3, "read reaches every root");
  assert.equal(edits.read(["NOWHERE", "x"]), undefined);
  events.length = 0;
  const rainBefore = config.canvas.rain;
  edits.resetOverrideTree(["canvas", "rain"]);
  assert.equal(JSON.stringify(resets), JSON.stringify(["canvas.rain.opacity", "canvas.rain"]),
    "a subtree reset drops that subtree's overrides only (not canvas.rainy)");
  assert.equal(events.at(-1)[0], "config-updated");
  assert.equal(rainBefore, config.canvas.rain);
}

// --- TK-300 (spec 174 B4): sections remembered by their place; a new fish on the hook redraws only its sections ------
{
  const { DevTools } = runtime.importModule("src/dev/tools/dev_tools.js");
  const stored = new Map([["dev_tools_sections_state", { x: true }]]);
  const storageCache = { get: (key, fallback) => stored.get(key) ?? fallback, set: (key, value) => stored.set(key, JSON.parse(JSON.stringify(value))),
    remove: (key) => stored.delete(key) };
  const panelUi = new DevToolsUI(() => {}, {}, null, null, null, document.body, createElement("div"));
  const tools = new DevTools({ debug: { x: { a: 1 } }, x: { b: 2 } }, { synchronize() {} },
    { catalogs: { items: {}, fishes: [], maps: {} }, settingsStore: null, debugModulesSource: () => ({}), storageCache,
      createUI: () => ({ ui: panelUi, tooltipProvider: { ready: new Promise(() => {}) } }) });
  assert.equal(stored.has("dev_tools_sections_state"), false, "the title-keyed states of before are dropped");
  tools.toggle();
  const body = panelUi.body;
  const sectionTitled = (title, root = body) => document.all((element) => element.className === "devtools__section-title" &&
    element.textContent === title, root);
  const isOpen = (title) => title.parentNode.children[1].style.display === "block";
  const [firstX, secondX] = sectionTitled("x");
  assert.ok(firstX && secondX && !isOpen(firstX) && !isOpen(secondX), "two sections titled x, both closed (the old x: true is gone)");
  firstX.click();
  tools.toggle(); tools.toggle();
  const [firstAgain, secondAgain] = sectionTitled("x");
  assert.equal(isOpen(firstAgain), true, "the opened section is open after a redraw");
  assert.equal(isOpen(secondAgain), false, "a section with the same title elsewhere keeps its own state (it used to open too)");
  assert.match(JSON.stringify([...stored.values()]), /\/CONFIG(\.debug)?\/CONFIG(\.debug)?\.x"/u, "kept by place, not by title");

  // The hooked fish: only its own sections are drawn again.
  body.scrollTop = 480;
  const before = body.children.slice();
  const fish = (id, weight) => ({ detail: { hookedFish: { id, level: 1, weight, physics: { forceProfile: { power: 2 } } } } });
  document.fire("debug-live-update", fish("carp", 1));
  const fishSection = () => sectionTitled("ACTIVE FISH (carp)").length + sectionTitled("ACTIVE FISH (perch)").length;
  assert.equal(fishSection(), 1, "the fish's section appears");
  assert.equal(JSON.stringify(body.children.filter((node) => !before.includes(node)).length), "0",
    "nothing else in the panel is replaced");
  assert.ok(before.every((node) => node.parentNode === body), "every other section is the same node");
  assert.equal(body.scrollTop, 480, "the panel keeps its scroll");
  document.fire("debug-live-update", fish("perch", 2));
  assert.equal(sectionTitled("ACTIVE FISH (perch)").length, 1, "another fish replaces it");
  assert.equal(sectionTitled("ACTIVE FISH (carp)").length, 0);
  document.fire("debug-live-update", { detail: {} });
  assert.equal(fishSection(), 0, "no fish, no section");
  tools.dispose();
}

// --- TK-305 (spec 174 C3): names, descriptions, changed values, search -----------------------------------------------
{
  const provider = { describe: (path, key) => (path === "CONFIG.rain.opacity" ? { name: "Непрозорість дощу",
    description: "Наскільки видно краплі." } : key === "speed" ? { name: "швидкість", description: "" } : null), dispose() {} };
  const searchUi = new DevToolsUI(() => {}, {}, provider, null, null, document.body, createElement("div"));
  const pages = searchUi.createPages([{ id: "a", title: "A", icon: "hook" }, { id: "b", title: "B", icon: "map" }], "a", () => {});
  const changed = new Set(["CONFIG.rain.opacity"]);
  const resets = [];
  const sectionOf = (page, title) => searchUi.createSection(title, page, false, () => {}, ["SECTION", title]);
  const rain = sectionOf(pages.get("b"), "rain");
  const add = (parent, key, path) => searchUi.addParameter(parent, { control: "number", label: key, value: 1, onCommit() {},
    path, isChanged: () => changed.has(path.join(".")), onReset: () => { resets.push(path.join(".")); changed.delete(path.join(".")); } });
  add(rain, "opacity", ["CONFIG", "rain", "opacity"]);
  add(rain, "speed", ["CONFIG", "rain", "speed"]);
  add(pages.get("a"), "flag", ["CONFIG", "flag"]);
  const rowOf = (key) => byClass("devtools__row", searchUi.body).find((row) => row.children[0]?.dataset?.devtoolsKey === key);
  const opacity = rowOf("opacity");
  assert.equal(byClass("devtools__label-name", opacity)[0].innerText, "Непрозорість дощу", "the Ukrainian name is under the key");
  assert.equal(byClass("devtools__label-key", opacity)[0].innerText, "opacity", "the key comes first, as in the code");
  assert.equal(byClass("devtools__label-name", rowOf("flag")).length, 0, "no name, no second line");
  const info = byClass("devtools__info", opacity)[0];
  const description = byClass("devtools__description", opacity)[0];
  assert.equal(description.hidden, true);
  info.click();
  assert.equal(description.hidden, false, "«i» opens the description under the row (reachable by touch)");
  assert.equal(info.getAttribute("aria-expanded"), "true");
  assert.equal(byClass("devtools__info", rowOf("speed")).length, 0, "no description, no «i»");
  // Changed values: marked, reset one by one, the mark follows syncs.
  assert.equal(opacity.classList.contains("devtools__row--changed"), true, "a changed value is marked");
  assert.equal(rowOf("speed").classList.contains("devtools__row--changed"), false);
  byClass("devtools__reset", opacity)[0].click();
  assert.equal(JSON.stringify(resets), JSON.stringify(["CONFIG.rain.opacity"]), "its reset puts that one parameter back");
  searchUi.syncValue(["CONFIG", "rain", "opacity"], 1);
  assert.equal(opacity.classList.contains("devtools__row--changed"), false, "the mark follows the sync after the reset");
  changed.add("CONFIG.rain.speed");
  searchUi.syncValue(["CONFIG"], {});
  assert.equal(rowOf("speed").classList.contains("devtools__row--changed"), true, "an import or reset of all refreshes every mark");
  // Search: every module, in place, editable; sections open for the search and close after it.
  const panel = searchUi.body.parentNode;
  const input = byClass("devtools__search-input", panel)[0];
  const status = byClass("devtools__search-status", panel)[0];
  const search = (query) => { input.value = query; input.fire("input"); };
  const body = searchUi.body;
  search("ДОЩУ");
  assert.equal(body.classList.contains("devtools__body--filtered"), true);
  assert.equal(opacity.classList.contains("devtools__row--match"), true, "found by its Ukrainian name, any case");
  assert.equal(rowOf("flag").classList.contains("devtools__row--match"), false);
  assert.equal(rain.style.display, "block", "the section holding a match opens");
  assert.equal(pages.get("b").classList.contains("devtools__page--match"), true, "a match in another module shows that module");
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, "Знайдено: 1");
  search("config.flag");
  assert.equal(rowOf("flag").classList.contains("devtools__row--match"), true, "found by its path");
  assert.equal(rain.style.display, "none", "a section opened by the search closes again");
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
  assert.equal(rowOf("speed").classList.contains("devtools__row--match"), true, "«Змінені» shows the changed values");
  assert.equal(opacity.classList.contains("devtools__row--match"), false);
  filter.click();
  assert.equal(body.classList.contains("devtools__body--filtered"), false);
  searchUi.dispose();
}
{
  // The edit path: whether a parameter is changed, and putting one back.
  const { DevConfigEditService } = runtime.importModule("src/dev/tools/config/dev_config_edit_service.js");
  const { DevToolsParameterAliasRegistry } = runtime.importModule("src/dev/services/dev_tools_parameter_alias_registry.js");
  const config = { rain: { opacity: 0.5 } };
  const overrides = new Set(["rain.opacity"]);
  const events = [], synced = [];
  const edits = new DevConfigEditService({ config, catalogs: {}, parameterAliases: new DevToolsParameterAliasRegistry(),
    configRuntime: { overrideStore: { has: (key) => overrides.has(key) },
      reset: (path) => { overrides.delete(path.slice(1).join(".")); config.rain.opacity = 1; } },
    getHookedFish: () => null, hookedFishSync: { afterEdit() {} }, itemStatSync: { afterEdit() {} }, debugModulesSource: () => ({}),
    syncValue: (path, value) => synced.push([path.join("."), value]),
    eventTarget: { dispatchEvent: (event) => events.push(event.type) }, logger: { log() {} } });
  assert.equal(edits.isOverridden(["CONFIG", "rain", "opacity"]), true);
  edits.resetParameter(["CONFIG", "rain", "opacity"]);
  assert.equal(edits.isOverridden(["CONFIG", "rain", "opacity"]), false);
  assert.equal(JSON.stringify(synced), JSON.stringify([["CONFIG.rain.opacity", 1]]), "the panel shows the code's value");
  assert.equal(JSON.stringify(events), JSON.stringify(["config-updated"]), "the game hears it like an edit");
}

// --- TK-306 (spec 174 C4): deep sections open inside, with breadcrumbs ------------------------------------------------
{
  const drillUi = new DevToolsUI(() => {}, {}, null, null, null, document.body, createElement("div"));
  const pages = drillUi.createPages([{ id: "config", title: "Конфіг", icon: "sliders" }, { id: "other", title: "Інше", icon: "map" }],
    "config", () => {});
  const page = pages.get("config");
  const toggles = [];
  const section = (title, parent, path) => drillUi.createSection(title, parent, false, (open) => toggles.push([title, open]), path);
  const root = section("НАЛАШТУВАННЯ", page, ["CONFIG"]);
  const physics = section("physics", root, ["CONFIG", "physics"]);
  const fight = section("fight", physics, ["CONFIG", "physics", "fight"]);
  const rod = section("rodControl", fight, ["CONFIG", "physics", "fight", "rodControl"]);
  drillUi.addParameter(rod, { control: "number", label: "ratio", value: 2, onCommit() {},
    path: ["CONFIG", "physics", "fight", "rodControl", "ratio"] });
  const titleOf = (content) => content.parentNode.children[0];
  const fightSection = titleOf(fight).parentNode;
  assert.equal(titleOf(physics).parentNode.classList.contains("devtools__section--drill"), false, "two levels stay in place");
  assert.equal(fightSection.classList.contains("devtools__section--drill"), true, "the third level opens inside");
  titleOf(root).click(); titleOf(physics).click();
  titleOf(fight).click();
  assert.equal(page.classList.contains("devtools__page--drilled"), true, "the page shows the section alone");
  assert.equal(fight.parentNode.className, "devtools__drill", "its content is in the page's drill area");
  assert.equal(fight.style.display, "block");
  assert.equal(toggles.some(([title]) => title === "fight"), false, "a drill-in is not an open/closed state to remember");
  const crumbs = () => byClass("devtools__crumb", page).map((crumb) => crumb.textContent);
  assert.deepEqual(crumbs(), ["Конфіг", "НАЛАШТУВАННЯ", "physics", "fight"], "breadcrumbs: module, every section above, here");
  // Deeper again: rodControl opens inside fight's place.
  titleOf(rod).click();
  assert.deepEqual(crumbs(), ["Конфіг", "НАЛАШТУВАННЯ", "physics", "fight", "rodControl"]);
  assert.equal(fight.parentNode, fightSection, "the previous drill-in went back to its place");
  // A crumb back to a drill section shows it; a crumb to an inline section leaves the drill-in and shows it in place.
  byClass("devtools__crumb", page).find((crumb) => crumb.textContent === "fight").click();
  assert.equal(crumbs().at(-1), "fight");
  byClass("devtools__crumb", page).find((crumb) => crumb.textContent === "physics").click();
  assert.equal(page.classList.contains("devtools__page--drilled"), false);
  assert.equal(byClass("devtools__crumbs", page).length, 0);
  assert.equal(fight.parentNode, fightSection, "every row is back in its own place");
  // A reveal (an overlay link) of a parameter inside opens its innermost drill-in.
  drillUi.selectPage("other");
  assert.equal(drillUi.revealPath(["CONFIG", "physics", "fight", "rodControl", "ratio"]), true);
  assert.equal(page.hidden, false, "its module is shown");
  assert.equal(crumbs().at(-1), "rodControl", "and the section holding it");
  // A search works on the whole tree: it leaves the drill-in.
  const input = byClass("devtools__search-input", drillUi.body.parentNode)[0];
  input.value = "ratio"; input.fire("input");
  assert.equal(page.classList.contains("devtools__page--drilled"), false);
  drillUi.dispose();
}

// --- TK-307 (spec 174 C5): the panel's text dialog and result line instead of prompt and alert --------------------------
(async () => {
  const { ServiceModule } = runtime.importModule("src/dev/tools/modules/service_module.js");
  const serviceUi = new DevToolsUI(() => {}, {}, null, null, null, document.body, createElement("div"));
  const host = createElement("div"); serviceUi.body.appendChild(host);
  const downloads = [], imported = [], redraws = [], picked = ['{"a": 1}'];
  const plan = { saved: [], edited: false };
  const module = new ServiceModule({ redraw: () => redraws.push(1), gameVersion: "0.50.122", now: () => new Date(2026, 10, 14, 9, 5),
    configRuntime: { overrideStore: { entries: () => [["x", 1]] }, exportOverrides: () => ({ "rain.opacity": 0.5 }) },
    files: { download: (name, text) => downloads.push([name, text]), pickFile: async () => picked.shift() ?? null },
    assetLoadPlanStore: { isEdited: () => plan.edited, exportText: () => "export const PLAN = [];", plan: () => ({ steps: [] }),
      save: (value) => (value.steps ? (plan.saved.push(value), []) : ["steps missing"]), reset() { plan.edited = false; } },
    logger: { log() {}, warn() {} } });
  const edits = { importOverrides: (value) => { if (value.bad) throw new Error("bad key"); imported.push(value); }, resetAll() {} };
  module.mount(host, { ui: serviceUi, createSection: (label, parent, path, options) =>
    serviceUi.createSection(label, parent, true, () => {}, path, options), edits });
  const button = (label) => byClass("devtools__action", host).find((element) => element.textContent.includes(label) ||
    element.innerText === label);
  const panel = serviceUi.body.parentNode;
  const dialog = () => byClass("devtools__dialog", panel)[0];
  const action = (label) => byClass("devtools__dialog-action", dialog()).find((element) => element.textContent === label);
  const text = () => byClass("devtools__dialog-text", dialog())[0];
  const message = () => byClass("devtools__dialog-message", dialog())[0];
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  // Export: the text in a dialog, copied or downloaded.
  button("Export overrides").click();
  assert.ok(dialog(), "an export opens the panel's dialog, not the browser's prompt");
  assert.equal(JSON.parse(text().value)["rain.opacity"], 0.5);
  assert.equal(text().readOnly, true);
  action("Копіювати").click(); await settle();
  // Another async scenario of this check copies too: look for this text, not the last one.
  assert.ok(clipboard.includes(text().value), "Копіювати puts the text on the clipboard");
  assert.equal(message().textContent, "Скопійовано.");
  action("Завантажити файл").click();
  assert.equal(downloads.at(-1)[0], "overrides-v0.50.122-20261114-0905.json", "and Завантажити saves it as a file");
  const escape = byClass("devtools__dialog-layer", panel)[0].fire("keydown", { key: "Escape" });
  assert.equal(escape.stopped, true);
  assert.equal(dialog(), undefined, "Escape closes the dialog");
  // Import: invalid text stays in the dialog with the reason; valid text is applied, the panel redrawn, the result shown.
  button("Import overrides").click();
  text().value = "{oops"; action("Застосувати").click();
  assert.match(message().textContent, /^Це не JSON/u);
  assert.equal(message().classList.contains("devtools__dialog-message--error"), true);
  text().value = '{"bad": true}'; action("Застосувати").click();
  assert.equal(message().textContent, "Не застосовано: bad key", "a refused import says why");
  action("Відкрити файл").click(); await settle();
  assert.equal(text().value, '{"a": 1}', "Відкрити файл reads a file into the dialog");
  action("Застосувати").click();
  assert.equal(JSON.stringify(imported), JSON.stringify([{ a: 1 }]));
  assert.equal(dialog(), undefined, "a successful import closes the dialog");
  assert.equal(redraws.length, 1);
  const toast = byClass("devtools__toast", panel)[0];
  assert.equal(toast.textContent, "Перевизначення застосовано.", "the result line replaces the browser's alert");
  assert.equal(toast.hidden, false);
  // The load plan: an edit with errors is kept in the dialog; a valid one is saved.
  button("Змінити план (з наступного старту)").click();
  text().value = "{}"; action("Зберегти").click();
  assert.equal(message().textContent, "План не збережено:\nsteps missing");
  text().value = '{"steps": []}'; action("Зберегти").click();
  assert.equal(plan.saved.length, 1);
  assert.equal(toast.textContent, "План збережено: діє з наступного старту.");
  serviceUi.dispose();
})().catch((error) => { console.error(error); process.exitCode = 1; });

// --- TK-308: opening the panel draws only what is open; everything else when it is first needed ---------------------
{
  const { DevTools } = runtime.importModule("src/dev/tools/dev_tools.js");
  const storage = new Map();
  const lazyUi = new DevToolsUI(() => {}, {}, null, null, null, document.body, createElement("div"));
  const config = { debug: {}, physics: { drag: 0.4, fight: { rodControl: { ratio: 2, enabled: true } } } };
  const tools = new DevTools(config, { synchronize() {} }, { catalogs: { items: {}, fishes: [], maps: {} }, settingsStore: null,
    debugModulesSource: () => ({}), createUI: () => ({ ui: lazyUi, tooltipProvider: { ready: new Promise(() => {}) } }),
    storageCache: { get: (key, fallback) => storage.get(key) ?? fallback, set: (key, value) => storage.set(key, value), remove() {} } });
  tools.toggle();
  const rowsOf = (key) => byClass("devtools__row", lazyUi.body).filter((row) => row.children[0]?.dataset?.devtoolsKey === key);
  assert.equal(rowsOf("drag").length, 0, "a closed section's rows are not drawn when the panel opens");
  const physicsTitle = byClass("devtools__section-title", lazyUi.body).find((title) => title.textContent === "physics");
  physicsTitle.click();
  assert.equal(rowsOf("drag").length, 1, "opening the section draws its rows");
  assert.equal(rowsOf("ratio").length, 0, "but not those of the sections inside it");
  // Edited while closed: drawn with the value as it is now.
  config.physics.fight.rodControl.ratio = 3;
  const input = byClass("devtools__search-input", lazyUi.body.parentNode)[0];
  input.value = "ratio"; input.fire("input");
  const ratio = rowsOf("ratio");
  assert.equal(ratio.length, 1, "a search draws the rest and finds it");
  assert.equal(byClass("devtools__input--number", ratio[0])[0].value, "3", "with the value it has now");
  input.value = ""; input.fire("input");
  tools.toggle(); tools.toggle();
  assert.equal(rowsOf("ratio").length, 0, "a redraw is lazy again");
  assert.equal(tools.revealParameter(["CONFIG", "physics", "fight", "rodControl", "ratio"]), true,
    "a link from the overlay draws and opens a row that was not drawn");
  tools.dispose();
}

// --- TK-310 (spec 174 D): the bottom sheet's handle switches between half and nearly the whole height ---------------
{
  const sheetUi = new DevToolsUI(() => {}, {}, null, null, null, document.body, createElement("div"));
  const panel = sheetUi.body.parentNode;
  const handle = byClass("devtools__sheet-handle", panel)[0];
  assert.equal(handle.getAttribute("aria-expanded"), "false");
  handle.click();
  assert.equal(panel.classList.contains("devtools--sheet-tall"), true, "the handle makes the sheet tall");
  assert.equal(handle.getAttribute("aria-expanded"), "true");
  assert.equal(handle.getAttribute("aria-label"), "Згорнути панель");
  handle.click();
  assert.equal(panel.classList.contains("devtools--sheet-tall"), false, "and half again");
  sheetUi.dispose();
}

// --- TK-312: the panel's own settings on the last rail page, remembered and applied ----------------------------------
{
  const { DevTools } = runtime.importModule("src/dev/tools/dev_tools.js");
  const stored = new Map([["dev_tools_panel_settings", { fullscreen: true }]]);
  const storageCache = { get: (key, fallback) => stored.get(key) ?? fallback, set: (key, value) => stored.set(key, value),
    remove: (key) => stored.delete(key) };
  const settingsUi = new DevToolsUI(() => {}, {}, null, null, null, document.body, createElement("div"));
  const panel = settingsUi.body.parentNode;
  const tools = new DevTools({ debug: {} }, { synchronize() {} }, { catalogs: { items: {}, fishes: [], maps: {} },
    settingsStore: null, debugModulesSource: () => ({}), storageCache,
    createUI: () => ({ ui: settingsUi, tooltipProvider: { ready: new Promise(() => {}) } }) });
  assert.equal(panel.classList.contains("devtools--fullscreen"), true, "a remembered setting applies before the panel opens");
  assert.equal(panel.classList.contains("devtools--adaptive"), false);
  tools.toggle();
  const buttons = byClass("devtools__rail-button", panel);
  assert.equal(buttons.at(-1).getAttribute("aria-label"), "Панель", "the settings are the last module on the rail");
  buttons.at(-1).click();
  const page = byClass("devtools__page", panel).find((element) => element.dataset.devtoolsPage === "panel");
  const switchOf = (key) => byClass("devtools__row", page).find((row) => row.children[0]?.dataset?.devtoolsKey === key);
  const adaptive = byClass("devtools__switch-input", switchOf("Адаптивна ширина (ПК)"))[0];
  assert.equal(adaptive.checked, false);
  adaptive.checked = true; adaptive.fire("change", { target: adaptive });
  assert.equal(panel.classList.contains("devtools--adaptive"), true, "«Адаптивна ширина» widens the panel to its content");
  assert.equal(JSON.stringify(stored.get("dev_tools_panel_settings")), JSON.stringify({ adaptiveWidth: true, fullscreen: true }),
    "and is remembered");
  const fullscreen = byClass("devtools__switch-input", switchOf("На весь екран (телефон)"))[0];
  assert.equal(fullscreen.checked, true, "the switch shows the remembered value");
  fullscreen.checked = false; fullscreen.fire("change", { target: fullscreen });
  assert.equal(panel.classList.contains("devtools--fullscreen"), false);
  tools.dispose();
}

// --- TK-304 (spec 174 C2): seven modules on a rail, one page shown, the choice remembered -----------------------------
{
  const { DevTools } = runtime.importModule("src/dev/tools/dev_tools.js");
  const stored = new Map([["dev_tools_active_module", "data"]]);
  const storageCache = { get: (key, fallback) => stored.get(key) ?? fallback, set: (key, value) => stored.set(key, value),
    remove: (key) => stored.delete(key) };
  const railUi = new DevToolsUI(() => {}, {}, null, null, null, document.body, createElement("div"));
  const tools = new DevTools({ debug: { flag: false }, canvas: { rain: { enabled: false, opacity: 1 } } }, { synchronize() {} },
    { catalogs: { items: {}, fishes: [], maps: {} }, settingsStore: null, debugModulesSource: () => ({}), storageCache,
      createUI: () => ({ ui: railUi, tooltipProvider: { ready: new Promise(() => {}) } }) });
  tools.toggle();
  const buttons = byClass("devtools__rail-button");
  assert.deepEqual(buttons.map((button) => button.getAttribute("aria-label")),
    ["Гра", "Конфіг", "Бази", "Локація", "Сцена", "Діагностика", "Сервіс", "Панель"],
    "seven modules in the spec's order, then the panel's own settings (TK-312)");
  const pages = byClass("devtools__page");
  const shown = () => pages.filter((page) => !page.hidden).map((page) => page.dataset.devtoolsPage);
  assert.deepEqual(shown(), ["data"], "the remembered module opens; one page at a time");
  assert.equal(buttons[2].getAttribute("aria-current"), "page");
  assert.equal(byClass("devtools__empty", pages[3]).length, 1, "a module with nothing to show says so (no zone editor here)");
  railUi.body.scrollTop = 120;
  buttons[1].click();
  assert.deepEqual(shown(), ["config"]);
  assert.equal(stored.get("dev_tools_active_module"), "config", "the choice is remembered");
  assert.equal(railUi.body.scrollTop, 0, "another module starts at its own top");
  buttons[2].click();
  assert.equal(railUi.body.scrollTop, 120, "and coming back restores where that module was scrolled");
  // A link from the overlay (spec 177) to a parameter of another module shows that module first.
  assert.equal(tools.revealParameter(["CONFIG", "canvas", "rain", "opacity"]), true);
  assert.deepEqual(shown(), ["config"], "revealing a parameter switches to its module");
  buttons[0].click();
  // A blocked parameter whose switch is in another module shows that module (TK-292 feedback).
  const host = pages[0];
  railUi.addParameter(host, { control: "number", label: "rain opacity copy", value: 1, onCommit() {},
    path: ["TEST", "copy"], requires: [{ path: ["CONFIG", "canvas", "rain", "enabled"], isEnabled: () => false }] });
  byClass("devtools__row", host).find((row) => row.children[0]?.dataset.devtoolsKey === "rain opacity copy").fire("pointerdown");
  assert.deepEqual(shown(), ["config"], "the blocking switch's module is shown");
  tools.dispose();
}

// --- TK-285: the command after a file export ------------------------------------------------------------------------
(async () => {
  const { ExportCommandNotice } = runtime.importModule("src/dev/tools/controls/export_command_notice.js");
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  const section = createElement("div"); document.body.appendChild(section);
  ui.createButtonRow("Експорт зон", section, () => {});
  let closed = 0;
  ui.showExportCommand(section, { fileName: "zones-test.json", command: "npm run apply:zones -- zones-test.json",
    onClose: () => closed++ });
  const notice = () => byClass("devtools__export", section);
  assert.equal(section.children[0], notice()[0], "the notice is at the top of the section the file was exported from");
  assert.ok(notice()[0].textContent.includes("zones-test.json"), "it names the downloaded file");
  assert.equal(byClass("devtools__export-command", section)[0].textContent, "npm run apply:zones -- zones-test.json");
  byClass("devtools__export-copy", section)[0].click(); await settle();
  assert.ok(clipboard.includes("npm run apply:zones -- zones-test.json"), "the copy button puts the command on the clipboard");
  assert.equal(notice()[0].classList.contains("devtools__export--copied"), true, "and says so");
  ui.showExportCommand(section, { fileName: "zones-next.json", command: "npm run apply:zones -- zones-next.json" });
  assert.equal(notice().length, 1, "the next export replaces the notice");
  assert.ok(notice()[0].textContent.includes("zones-next.json"));
  ui.showExportCommand(section, { fileName: "zones-test.json", command: "x", onClose: () => closed++ });
  byClass("devtools__export-close", section)[0].click();
  assert.equal(notice().length, 0, "the close button removes it");
  assert.equal(closed, 1, "and tells the section, which stops showing it again");

  // No clipboard (a page opened over http on the local network): no error, the person is told to copy by hand.
  const timers = [];
  const offline = new ExportCommandNotice({ fileName: "a.json", command: "npm run apply:radio -- a.json", documentRef: document,
    copyText: () => { throw new Error("clipboard unavailable"); },
    scheduler: { setTimeout: (callback) => timers.push(callback), clearTimeout() {} } });
  section.appendChild(offline.element);
  byClass("devtools__export-copy", offline.element)[0].click(); await settle();
  assert.equal(offline.element.classList.contains("devtools__export--copied"), false);
  assert.ok(byClass("devtools__export-status", offline.element)[0].textContent.length > 0, "the failure is explained in the notice");
  timers.at(-1)();
  assert.equal(byClass("devtools__export-status", offline.element)[0].textContent, "", "the message clears after a moment");
  offline.dispose();

  // --- TK-296: DevTools revealPath + DevToolsDependencyFeedback green highlight ------------------------------------
  {
    const revealDoc = new TestDocument();
    const baseCreate = revealDoc.createElement.bind(revealDoc);
    const scrolled = [];
    revealDoc.createElement = (tag) => {
      const element = baseCreate(tag);
      Object.defineProperty(element, "parentElement", { get() { return this.parentNode; } });
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
          return element.children.find((child) => child.classList.contains(cls)) || null;
        }
        if (selector.startsWith(".")) {
          const cls = selector.slice(1);
          const found = revealDoc.all((el) => el !== element && el.classList.contains(cls), element)[0];
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
    const { DevToolsUI: RevealUI } = revealRuntime.importModule("src/dev/tools/dev_tools_ui.js");
    const { DevToolsDependencyFeedback } = revealRuntime.importModule("src/dev/services/dev_tools_dependency_feedback.js");
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
    const revealUi = new RevealUI(() => {}, {}, null, null, null, panelParent, revealDoc.createElement("div"), feedback);
    const rootBody = revealUi.body;
    revealUi.togglePanel(true);

    const toggled = [];
    const configSection = revealUi.createSection("CONFIG", rootBody, false, (open) => toggled.push(["CONFIG", open]), "CONFIG");
    const configCanvas = revealUi.createSection("canvas", configSection, false, null, "CONFIG.canvas");
    revealUi.createInputRow("amplitude", 12, configCanvas, "number", () => {}, ["CONFIG", "canvas", "water", "amplitude"]);
    const configAmplitudeRow = configCanvas.children.find((el) => el.classList.contains("devtools__row"));

    const sceneSection = revealUi.createSection("Сцена", rootBody, false, (open) => toggled.push(["SCENE_LAYER", open]), "SCENE_LAYER");
    const sceneWater = revealUi.createSection("water", sceneSection, false, (open) => toggled.push(["sceneWater", open]), "CONFIG.canvas.water");
    revealUi.createRangeRow("amplitude", 12, sceneWater, () => {}, ["CONFIG", "canvas", "water", "amplitude"]);
    const sceneAmplitudeRow = sceneWater.children.find((el) => el.classList.contains("devtools__row"));

    const weatherSection = revealUi.createSection("Погода", rootBody, false, (open) => toggled.push(["WEATHER", open]), "WEATHER");
    revealUi.createButtonRow("Блискавка", weatherSection, () => {}, null, null, ["WEATHER", "controls", "strike"]);
    const strikeButtonRow = weatherSection.children.find((el) => el.classList.contains("devtools__row"));

    // Exact path prefers specialized SCENE_LAYER section over generic CONFIG root.
    assert.equal(revealUi.revealPath("CONFIG.canvas.water.amplitude"), true, "revealPath resolves matching parameter path");
    const sceneSectionEl = sceneSection.closest(".devtools__section");
    const sceneWaterEl = sceneWater.closest(".devtools__section");
    const configSectionEl = configSection.closest(".devtools__section");
    assert.equal(sceneSection.style.display, "block", "expands specialized parent section content");
    assert.equal(sceneSectionEl.children[0].getAttribute("aria-expanded"), "true", "marks parent section aria-expanded");
    assert.equal(sceneWater.style.display, "block", "expands nested water subsection content");
    assert.equal(sceneWaterEl.children[0].getAttribute("aria-expanded"), "true", "marks subsection aria-expanded");
    assert.equal(configSection.style.display, "none", "keeps duplicate generic CONFIG section closed");
    assert.equal(configSectionEl.children[0].getAttribute("aria-expanded"), "false");
    assert.equal(sceneAmplitudeRow.classList.contains("devtools__row--revealed"), true, "highlights target specialized row");
    assert.equal(configAmplitudeRow.classList.contains("devtools__row--revealed"), false, "does not highlight duplicate generic row");
    assert.equal(scrolled.at(-1)?.element, sceneAmplitudeRow, "scrolls revealed row into view");
    assert.equal(scrolled.at(-1)?.opts?.block, "center");
    assert.deepEqual(toggled, [["sceneWater", true], ["SCENE_LAYER", true]], "persists opened state via onToggle callbacks");

    // Revealing another path clears previous highlight and works with createButtonRow + timeout auto-clear.
    assert.equal(revealUi.revealPath(["WEATHER", "controls", "strike"]), true, "revealPath resolves array path for button rows");
    assert.equal(sceneAmplitudeRow.classList.contains("devtools__row--revealed"), false, "previous reveal highlight clears");
    assert.equal(strikeButtonRow.classList.contains("devtools__row--revealed"), true, "button row is highlighted");
    assert.equal(weatherSection.style.display, "block", "expands weather section");
    assert.equal(clearedTimerIds.has(revealTimers[0].id), true, "cancels superseded reveal timer");
    revealTimers.at(-1).fn();
    assert.equal(strikeButtonRow.classList.contains("devtools__row--revealed"), false, "highlight clears automatically after timeout");

    // Prefix fallback finds parent section path and togglePanel(false) clears highlight + timer.
    weatherSection.closest(".devtools__section").children[0].click();
    assert.equal(weatherSection.style.display, "none", "sanity: weather section starts collapsed");
    assert.equal(revealUi.revealPath("WEATHER.controls.missingLeaf"), true, "falls back to registered section prefix when leaf is absent");
    assert.equal(weatherSection.style.display, "block", "expands section matched by prefix fallback");
    const weatherTitle = weatherSection.closest(".devtools__section").children[0];
    assert.equal(weatherTitle.classList.contains("devtools__row--revealed"), true, "highlights section header on section fallback");
    const activeTimerId = revealTimers.at(-1).id;
    revealUi.togglePanel(false);
    assert.equal(clearedTimerIds.has(activeTimerId), true, "closing DevTools cancels pending reveal timer");
    assert.equal(weatherTitle.classList.contains("devtools__row--revealed"), false, "closing DevTools clears highlight");
    assert.equal(revealUi.revealPath("UNKNOWN.path"), false, "returns false for unknown path");
  }

  console.log("DevTools controls passed: number field steps, modifiers, typed values, rejected text, external values and held buttons; list picker search, keyboard, unknown ids; segmented options; export command notice.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
