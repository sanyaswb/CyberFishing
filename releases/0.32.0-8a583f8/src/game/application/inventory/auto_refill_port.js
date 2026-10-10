export class AutoRefillPort {
  refillExact(_target, _signature) {
    throw new Error("AutoRefillPort.refillExact() must be implemented");
  }
}
