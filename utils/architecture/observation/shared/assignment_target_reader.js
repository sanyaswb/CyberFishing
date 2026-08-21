class AssignmentTargetReader {
  read(target) {
    const targets = [];
    this.#collect(target, targets);
    return targets;
  }

  #collect(target, targets) {
    if (!target) return;
    if (target.type === "Identifier" || target.type === "MemberExpression") {
      targets.push(target);
      return;
    }
    if (target.type === "RestElement") {
      this.#collect(target.argument, targets);
      return;
    }
    if (target.type === "AssignmentPattern") {
      this.#collect(target.left, targets);
      return;
    }
    if (target.type === "ArrayPattern") {
      for (const element of target.elements) this.#collect(element, targets);
      return;
    }
    if (target.type === "ObjectPattern") {
      for (const property of target.properties) {
        this.#collect(
          property.type === "RestElement" ? property.argument : property.value,
          targets,
        );
      }
    }
  }
}

module.exports = { AssignmentTargetReader };
