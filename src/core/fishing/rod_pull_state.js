class RodPullState {
  active = false;
  ratio = 0;
  distanceMeters = 0;
  maxDistanceMeters = 0;
  availableDistanceMeters = 0;
  forceKg = 0;
  availableExtraForceKg = 0;
  totalTensionKg = 0;
  deltaMeters = 0;
  canMoveFish = false;
  blockedReason = "none";
  dragSlipping = false;
  releasedThisFrame = false;
  releaseRecovering = false;
  releaseRecoveryRatio = 0;
  lineHasReserve = true;
  canReleaseLine = true;
  spoolEmpty = false;

  reset() {
    this.active = false;
    this.ratio = 0;
    this.distanceMeters = 0;
    this.maxDistanceMeters = 0;
    this.availableDistanceMeters = 0;
    this.forceKg = 0;
    this.availableExtraForceKg = 0;
    this.totalTensionKg = 0;
    this.deltaMeters = 0;
    this.canMoveFish = false;
    this.blockedReason = "none";
    this.dragSlipping = false;
    this.releasedThisFrame = false;
    this.releaseRecovering = false;
    this.releaseRecoveryRatio = 0;
    this.lineHasReserve = true;
    this.canReleaseLine = true;
    this.spoolEmpty = false;
  }
}
