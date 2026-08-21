const { CanonicalJson } = require("./canonical_json");
const { GuardDiagnostic } = require("./guard_models");

class GuardOutcomeClassifier {
  constructor({ debts = [], exceptions = [] }) {
    this.debts = new Map(debts.map((item) => [item.evidenceFingerprint, item]));
    this.exceptions = exceptions;
    this.matchedDebtIds = new Set();
    this.matchedExceptionIds = new Set();
  }

  classify(violation, { debtEligible = true, exceptionRule = null, exceptionSubject = null } = {}) {
    const identity = violation.identity || {
      rule: violation.rule,
      source: violation.source,
      target: violation.target,
    };
    const evidenceFingerprint = CanonicalJson.fingerprint(identity);
    const exception = this.#findException(violation, exceptionRule, exceptionSubject);
    if (exception) {
      this.matchedExceptionIds.add(exception.id);
      return new GuardDiagnostic({ ...violation, status: "PASS", evidenceFingerprint, exceptionId: exception.id });
    }
    const debt = debtEligible ? this.debts.get(evidenceFingerprint) : null;
    if (debt && debt.rule === violation.rule && debt.source === violation.source && debt.target === violation.target) {
      this.matchedDebtIds.add(debt.id);
      return new GuardDiagnostic({ ...violation, status: "KNOWN-DEBT", evidenceFingerprint, debtId: debt.id, removalStage: debt.removalStage });
    }
    return new GuardDiagnostic({ ...violation, status: "FAIL", evidenceFingerprint });
  }

  staleMetadataDiagnostics(bridges = []) {
    const diagnostics = [];
    for (const debt of this.debts.values()) {
      if (!this.matchedDebtIds.has(debt.id)) diagnostics.push(this.#stale("stale-known-debt", debt));
    }
    for (const exception of this.exceptions) {
      if (!this.matchedExceptionIds.has(exception.id)) diagnostics.push(this.#stale("stale-exception", exception));
    }
    for (const bridge of bridges) {
      if (bridge.active === false) diagnostics.push(this.#stale("stale-bridge", bridge));
    }
    return diagnostics;
  }

  #findException(violation, rule, subject) {
    if (!rule) return null;
    return this.exceptions.find((item) => item.rule === rule && item.currentPath === violation.source &&
      (item.target === undefined || item.target === violation.target) &&
      (item.subject === undefined || item.subject === subject));
  }

  #stale(rule, item) {
    return new GuardDiagnostic({
      status: "FAIL", rule, source: item.currentPath || item.source || item.bridge || "architecture", target: item.target || "metadata",
      location: null, message: `Registered metadata is stale: ${item.id}`,
      evidenceFingerprint: CanonicalJson.fingerprint({ rule, id: item.id }),
    });
  }
}

module.exports = { GuardOutcomeClassifier };
