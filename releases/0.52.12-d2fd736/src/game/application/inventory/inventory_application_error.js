export class InventoryApplicationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "InventoryApplicationError";
    this.code = code;
    this.details = details;
  }
}
