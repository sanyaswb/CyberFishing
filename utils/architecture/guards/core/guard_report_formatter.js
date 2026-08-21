class GuardReportFormatter {
  format(report) {
    const lines = [`Architecture guards: ${report.status}; ${report.passCount} PASS, ${report.knownDebtCount} KNOWN-DEBT, ${report.failureCount} FAIL.`];
    for (const item of report.diagnostics) {
      const id = item.debtId || item.exceptionId || item.evidenceFingerprint.slice(0, 12);
      const location = item.location?.line ? `:${item.location.line}:${item.location.column || 0}` : "";
      lines.push(`[${item.status}] ${item.rule} ${id} ${item.source}${location} -> ${item.target}: ${item.message}`);
    }
    return lines.join("\n");
  }
}

module.exports = { GuardReportFormatter };
