const { CanonicalJson } = require("./canonical_json");

function immutableRecord(value) {
  const clone = CanonicalJson.clone(value);
  const freeze = (item) => {
    if (!item || typeof item !== "object" || Object.isFrozen(item)) return item;
    Object.values(item).forEach(freeze);
    return Object.freeze(item);
  };
  return freeze(clone);
}

class EsmDependencyObservation {
  constructor(value) { return immutableRecord(value); }
}

class UnifiedDependencyEdge {
  constructor(value) { return immutableRecord(value); }
}

class GuardDiagnostic {
  constructor(value) { return immutableRecord(value); }
}

class GuardReport {
  constructor(diagnostics, passCount = 0) {
    const ordered = [...diagnostics].sort(GuardReport.compareDiagnostics);
    const failureCount = ordered.filter((item) => item.status === "FAIL").length;
    const knownDebtCount = ordered.filter((item) => item.status === "KNOWN-DEBT").length;
    return immutableRecord({
      status: failureCount > 0 ? "FAIL" : knownDebtCount > 0 ? "KNOWN-DEBT" : "PASS",
      passCount,
      knownDebtCount,
      failureCount,
      diagnostics: ordered,
    });
  }

  static compareDiagnostics(left, right) {
    const a = [left.status, left.rule, left.source || "", left.target || "", left.location?.line || 0, left.message].join("\u0000");
    const b = [right.status, right.rule, right.source || "", right.target || "", right.location?.line || 0, right.message].join("\u0000");
    return a < b ? -1 : a > b ? 1 : 0;
  }
}

module.exports = {
  EsmDependencyObservation,
  GuardDiagnostic,
  GuardReport,
  UnifiedDependencyEdge,
  immutableRecord,
};
