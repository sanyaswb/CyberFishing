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
const runtime = new SourceRuntime({ globals: { document, setTimeout: () => 0, clearTimeout() {},
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
  ui.createChoiceRow("fishId", options, value, host, (next) => written.push(next), path);
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
  ui.createSegmentsRow("size", options, 2, host, (next) => written.push(next), ["test", "size"]);
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
  guardedUi.createSegmentsRow("segments", [{ value: "a", label: "a" }, { value: "b", label: "b" }], "a", host, write("segments"),
    ["CONFIG", "test", "group", "segments"], undefined, requires);
  guardedUi.createChoiceRow("choice", [{ value: "x", label: "X" }, { value: "y", label: "Y" }], "x", host, write("choice"),
    ["CONFIG", "test", "group", "choice"], undefined, requires);
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
  assert.deepEqual(clipboard, ["npm run apply:zones -- zones-test.json"], "the copy button puts the command on the clipboard");
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

  console.log("DevTools controls passed: number field steps, modifiers, typed values, rejected text, external values and held buttons; list picker search, keyboard, unknown ids; segmented options; export command notice.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
