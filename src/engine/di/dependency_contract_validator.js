function createDependencyContractError(contract, dependencyName, missingMember) {
  return new TypeError(
    `[${contract.stage}] ${contract.consumer} requires ${dependencyName}.${missingMember}`,
  );
}

export class DependencyContractValidator {
  constructor({ stage = "bootstrap", consumer = "composition" } = {}) {
    this.stage = stage;
    this.consumer = consumer;
  }

  requireMethods(value, dependencyName, methods) {
    if (!value) {
      throw createDependencyContractError(
        this,
        dependencyName,
        methods[0] || "value",
      );
    }
    for (let index = 0; index < methods.length; index += 1) {
      const method = methods[index];
      if (typeof value[method] !== "function") {
        throw createDependencyContractError(this, dependencyName, method);
      }
    }
    return value;
  }

  requireProperties(value, dependencyName, properties) {
    if (!value) {
      throw createDependencyContractError(
        this,
        dependencyName,
        properties[0] || "value",
      );
    }
    for (let index = 0; index < properties.length; index += 1) {
      const property = properties[index];
      if (!(property in value)) {
        throw createDependencyContractError(this, dependencyName, property);
      }
    }
    return value;
  }
}
