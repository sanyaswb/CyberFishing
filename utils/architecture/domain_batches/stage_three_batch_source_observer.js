"use strict";

const espree = require("espree");
const estraverse = require("estraverse");
const { immutableRecord } = require("../guards/core/guard_models");

class StageThreeBatchSourceObserver {
  observe(source, currentPath) {
    const tree = espree.parse(source, {
      ecmaVersion: "latest",
      sourceType: "script",
      loc: true,
    });
    const classes = tree.body.filter((node) => node.type === "ClassDeclaration");
    const topLevelBindings = tree.body.filter((node) =>
      node.type === "VariableDeclaration" || node.type === "FunctionDeclaration");
    const topLevelEffects = tree.body.filter((node) =>
      !["ClassDeclaration", "EmptyStatement"].includes(node.type));
    const fields = [];
    const methods = [];
    const forbiddenReads = [];
    const allocationTotals = this.#emptyAllocationCounts();

    for (const classNode of classes) {
      for (const element of classNode.body.body) {
        if (element.type === "PropertyDefinition") {
          fields.push({
            name: this.#memberName(element.key),
            visibility: element.key.type === "PrivateIdentifier" ? "private" : "public",
            initializerType: element.value?.type || null,
            objectShape: element.value?.type === "ObjectExpression"
              ? element.value.properties.map((property) => this.#memberName(property.key)).sort()
              : [],
          });
          this.#walk(element.value, allocationTotals, forbiddenReads);
        }
        if (element.type === "MethodDefinition") {
          const counts = this.#emptyAllocationCounts();
          this.#walk(element.value, counts, forbiddenReads);
          for (const key of Object.keys(allocationTotals)) allocationTotals[key] += counts[key];
          methods.push({
            name: this.#memberName(element.key),
            kind: element.kind,
            parameterCount: element.value.params.length,
            allocations: counts,
          });
        }
      }
    }

    return immutableRecord({
      currentPath,
      classDeclarations: classes.map((node) => node.id.name).sort(),
      topLevelBindings: topLevelBindings.map((node) => node.type).sort(),
      topLevelEffects: topLevelEffects.map((node) =>
        `${node.type}@${node.loc.start.line}:${node.loc.start.column + 1}`).sort(),
      fields: fields.sort((left, right) => left.name.localeCompare(right.name)),
      methods: methods.sort((left, right) =>
        `${left.kind}\0${left.name}`.localeCompare(`${right.kind}\0${right.name}`)),
      allocationTotals,
      forbiddenReads: [...new Set(forbiddenReads)].sort(),
    });
  }

  #emptyAllocationCounts() {
    return {
      objectExpressions: 0,
      arrayExpressions: 0,
      newExpressions: 0,
      objectFreezeCalls: 0,
      objectAssignCalls: 0,
      roundingCalls: 0,
    };
  }

  #walk(root, counts, forbiddenReads) {
    if (!root) return;
    estraverse.traverse(root, {
      fallback: "iteration",
      enter(node, parent) {
        if (node.type === "ObjectExpression") counts.objectExpressions += 1;
        if (node.type === "ArrayExpression") counts.arrayExpressions += 1;
        if (node.type === "NewExpression") counts.newExpressions += 1;
        if (node.type === "CallExpression" && node.callee?.type === "MemberExpression") {
          const object = node.callee.object;
          const property = node.callee.property;
          if (object?.name === "Object" && property?.name === "freeze") counts.objectFreezeCalls += 1;
          if (object?.name === "Object" && property?.name === "assign") counts.objectAssignCalls += 1;
          if (object?.name === "Math" && ["round", "floor", "ceil", "trunc"].includes(property?.name)) {
            counts.roundingCalls += 1;
          }
        }
        if (node.type !== "Identifier") return;
        const isStaticProperty = parent?.type === "MemberExpression" &&
          parent.property === node && !parent.computed;
        if (isStaticProperty) return;
        if (node.name === "__CYBER_FISHING_COMPAT_RUNTIME__") forbiddenReads.push("transport");
        if ([
          "window", "document", "localStorage", "sessionStorage", "Audio", "AudioContext",
          "CanvasRenderingContext2D", "requestAnimationFrame", "cancelAnimationFrame",
        ].includes(node.name)) {
          forbiddenReads.push(`browser:${node.name}`);
        }
        if (["CONFIG", "GAME_CONFIG", "FISHING_CONFIG"].includes(node.name)) {
          forbiddenReads.push(`config:${node.name}`);
        }
      },
    });
  }

  #memberName(node) {
    if (node?.type === "PrivateIdentifier") return `#${node.name}`;
    if (node?.type === "Identifier") return node.name;
    if (node?.type === "Literal") return String(node.value);
    return "computed";
  }
}

module.exports = { StageThreeBatchSourceObserver };
