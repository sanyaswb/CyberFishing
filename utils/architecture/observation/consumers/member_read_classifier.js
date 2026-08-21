class MemberReadClassifier {
  constructor({ assignmentTargetReader, contextIndex }) {
    this.assignmentTargetReader = assignmentTargetReader;
    this.contextIndex = contextIndex;
  }

  isRead(member) {
    for (const { parent, key } of this.contextIndex.ancestors(member)) {
      if (
        parent.type === "AssignmentExpression" &&
        key === "left" &&
        this.#isExactTarget(parent.left, member)
      ) {
        return parent.operator !== "=";
      }
      if (
        (parent.type === "ForInStatement" || parent.type === "ForOfStatement") &&
        key === "left" &&
        parent.left.type !== "VariableDeclaration" &&
        this.#isExactTarget(parent.left, member)
      ) {
        return false;
      }
      if (
        parent.type === "UnaryExpression" &&
        parent.operator === "delete" &&
        parent.argument === member
      ) {
        return false;
      }
    }
    return true;
  }

  #isExactTarget(root, member) {
    return this.assignmentTargetReader.read(root).includes(member);
  }
}

module.exports = { MemberReadClassifier };
