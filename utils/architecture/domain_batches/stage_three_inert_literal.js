"use strict";

// An inert literal evaluates without reading or writing any state: a string literal or a
// finite numeric literal, optionally negated. Reviewed frozen static tables may only hold these.
function isInertLiteral(node) {
  if (node?.type === "UnaryExpression") {
    return node.operator === "-" && node.prefix === true &&
      node.argument?.type === "Literal" && typeof node.argument.value === "number" &&
      Number.isFinite(node.argument.value);
  }
  return node?.type === "Literal" && (typeof node.value === "string" ||
    (typeof node.value === "number" && Number.isFinite(node.value)));
}

module.exports = { isInertLiteral };
