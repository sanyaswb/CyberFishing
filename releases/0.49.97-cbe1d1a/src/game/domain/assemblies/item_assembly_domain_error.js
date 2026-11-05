export class ItemAssemblyDomainError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ItemAssemblyDomainError";
    this.code = code;
    this.details = details;
  }
}
