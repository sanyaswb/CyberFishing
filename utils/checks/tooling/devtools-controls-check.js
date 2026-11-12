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
const runtime = new SourceRuntime({ globals: { document, setTimeout: () => 0, clearTimeout() {} } });
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

console.log("DevTools controls passed: number field steps, modifiers, typed values, rejected text, external values and held buttons.");
