const estraverse = require("estraverse");

class AstNodeContextIndex {
  constructor(syntaxTree) {
    this.contexts = new WeakMap();
    this.#build(syntaxTree);
  }

  get(node) {
    return this.contexts.get(node) || null;
  }

  ancestors(node) {
    const ancestors = [];
    let context = this.get(node);
    while (context) {
      ancestors.push(context);
      context = this.get(context.parent);
    }
    return ancestors;
  }

  hasAncestorType(node, type) {
    return this.ancestors(node).some(
      (context) => context.parent.type === type,
    );
  }

  #build(syntaxTree) {
    estraverse.traverse(syntaxTree, {
      fallback: "iteration",
      enter: (node, parent) => {
        if (!parent) return;
        const location = this.#findLocation(parent, node);
        this.contexts.set(node, {
          parent,
          key: location.key,
          index: location.index,
        });
      },
    });
  }

  #findLocation(parent, child) {
    for (const [key, value] of Object.entries(parent)) {
      if (value === child) return { key, index: null };
      if (!Array.isArray(value)) continue;
      const index = value.indexOf(child);
      if (index >= 0) return { key, index };
    }
    return { key: null, index: null };
  }
}

module.exports = { AstNodeContextIndex };
