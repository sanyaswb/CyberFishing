const crypto = require("node:crypto");

class CanonicalJson {
  static stringify(value) {
    return JSON.stringify(this.#normalize(value));
  }

  static fingerprint(value) {
    return crypto.createHash("sha256").update(this.stringify(value)).digest("hex");
  }

  static debtId(rule, identity) {
    return `debt-${rule}-${this.fingerprint(identity).slice(0, 12)}`;
  }

  static clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  static #normalize(value) {
    if (Array.isArray(value)) return value.map((item) => this.#normalize(item));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, this.#normalize(value[key])]),
    );
  }
}

module.exports = { CanonicalJson };
