"use strict";

const assert = require("node:assert/strict");
const vm = require("node:vm");
const espree = require("espree");

const key = (property) => property.key?.name ?? property.key?.value;
const objectArgument = (node) => {
  assert.equal(node?.type, "CallExpression", "Expected the approved frozen transport surface");
  assert.equal(node.arguments.length, 1);
  assert.equal(node.arguments[0].type, "ObjectExpression");
  return node.arguments[0];
};

// Test-only, in-memory instrumentation of an already hash-validated bundle.
// Mapping is resolved through its exact transport table and export getters, never
// through file-name guesses. This intentionally supports eager single-class leaf
// modules only; a different emitted topology requires an explicit probe extension.
class EagerClassModuleEvaluationProbe {
  prepare(code, transportSymbol, sources) {
    const tree = espree.parse(code, { ecmaVersion: "latest", sourceType: "script", range: true });
    assert.equal(tree.body.length, 1, "Expected exactly one cumulative IIFE");
    const iife = tree.body[0].expression;
    assert.equal(iife?.type, "CallExpression");
    assert.equal(iife.callee.type, "FunctionExpression");
    const statements = iife.callee.body.body;
    const assignment = statements.filter((node) => node.type === "ExpressionStatement" &&
      node.expression.type === "AssignmentExpression" &&
      node.expression.left.object?.name === "globalThis" &&
      node.expression.left.property?.name === transportSymbol);
    assert.equal(assignment.length, 1, "Expected one transport assignment");
    const surface = objectArgument(assignment[0].expression.right);
    const modules = objectArgument(surface.properties.find((node) => key(node) === "modules")?.value);
    const declarations = statements.filter((node) => node.type === "VariableDeclaration")
      .flatMap((statement) => statement.declarations.map((declaration) => ({ statement, declaration })));
    const binding = (name) => {
      const matches = declarations.filter((item) => item.declaration.id.name === name);
      assert.equal(matches.length, 1, `Non-unique eager binding: ${name}`);
      assert.equal(matches[0].statement.declarations.length, 1, "Unsupported grouped initialization");
      return matches[0];
    };
    const hook = "__CYBER_FISHING_TEST_EVALUATION_PROBE__";
    assert(!code.includes(hook), "Probe must not already exist in production code");
    const insertions = [];
    for (const source of sources) {
      const records = modules.properties.filter((node) => key(node) === source.targetPath);
      assert.equal(records.length, 1, `Non-unique module record: ${source.targetPath}`);
      assert.equal(records[0].value.type, "Identifier");
      const namespace = binding(records[0].value.name);
      const exports = objectArgument(namespace.declaration.init);
      const getters = exports.properties.filter((node) => key(node) === source.exportName);
      assert.equal(exports.properties.length, 1, "Probe requires an exact single-export leaf");
      assert.equal(getters.length, 1);
      const getter = getters[0].value;
      assert.equal(getter.type, "ArrowFunctionExpression");
      assert.equal(getter.body.type, "Identifier");
      const type = binding(getter.body.name);
      assert.equal(type.declaration.init.type, "ClassExpression");
      for (const [kind, item] of [["namespace", namespace], ["class", type]]) {
        assert(item.statement.end < assignment[0].start, "Module must initialize before exposure transport");
        insertions.push({ at: item.statement.end,
          text: `\n${hook}(${JSON.stringify(source.targetPath)},${JSON.stringify(kind)},${item.declaration.id.name});` });
      }
    }
    assert.equal(new Set(insertions.map((item) => item.at)).size, insertions.length,
      "Different source modules must not share a probe binding");
    insertions.sort((a, b) => a.at - b.at);
    let instrumented = "", restored = "", previous = 0;
    for (const item of insertions) {
      const unchanged = code.slice(previous, item.at);
      instrumented += unchanged + item.text;
      restored += unchanged;
      previous = item.at;
    }
    instrumented += code.slice(previous);
    restored += code.slice(previous);
    assert.equal(restored, code, "Instrumentation altered existing bytes");
    return { code: instrumented, hook, insertionCount: insertions.length };
  }

  run(code, transportSymbol, sources, { executions = 1 } = {}) {
    const prepared = this.prepare(code, transportSymbol, sources);
    const observations = new Map(sources.map((item) => [item.targetPath, { namespace: [], class: [] }]));
    const context = vm.createContext({ [prepared.hook]: (source, kind, value) => {
      assert(observations.has(source) && ["namespace", "class"].includes(kind), "Unexpected probe event");
      observations.get(source)[kind].push(value);
    } });
    for (let run = 0; run < executions; run += 1) {
      vm.runInContext(prepared.code, context, { timeout: 5000 });
    }
    const transport = context[transportSymbol];
    return sources.map((source) => {
      const record = observations.get(source.targetPath);
      assert.equal(record.namespace.length, 1, "Module namespace evaluated more/less than once");
      assert.equal(record.class.length, 1, "Module class evaluated more/less than once");
      assert.equal(record.namespace[0], transport.modules[source.targetPath]);
      assert.equal(record.class[0], transport.modules[source.targetPath][source.exportName]);
      return { source: source.targetPath, exportName: source.exportName,
        namespaceInitializationCount: record.namespace.length,
        classInitializationCount: record.class.length, moduleEvaluationCount: record.namespace.length,
        exactNamespaceAndClassReferences: true };
    });
  }
}

module.exports = { EagerClassModuleEvaluationProbe };
