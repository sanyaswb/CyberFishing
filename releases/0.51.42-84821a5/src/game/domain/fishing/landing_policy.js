export class LandingPolicy {
  getLandingDistanceMeters(_context = {}) {
    throw new Error("LandingPolicy.getLandingDistanceMeters() must be implemented");
  }
}
