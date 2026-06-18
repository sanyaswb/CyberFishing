class DependencyContractValidator {
  constructor({ stage = "bootstrap", consumer = "composition" } = {}) {
    this.stage = stage;
    this.consumer = consumer;
  }

  requireMethods(value, dependencyName, methods) {
    if (!value) {
      throw this.#error(dependencyName, methods[0] || "value");
    }
    for (let index = 0; index < methods.length; index += 1) {
      const method = methods[index];
      if (typeof value[method] !== "function") {
        throw this.#error(dependencyName, method);
      }
    }
    return value;
  }

  requireProperties(value, dependencyName, properties) {
    if (!value) {
      throw this.#error(dependencyName, properties[0] || "value");
    }
    for (let index = 0; index < properties.length; index += 1) {
      const property = properties[index];
      if (!(property in value)) {
        throw this.#error(dependencyName, property);
      }
    }
    return value;
  }

  #error(dependencyName, missingMember) {
    return new TypeError(
      `[${this.stage}] ${this.consumer} requires ${dependencyName}.${missingMember}`,
    );
  }
}
