class UnlimitedAssemblyCapacityPolicy {
  canApply() {
    return { allowed: true, reason: null };
  }
}
