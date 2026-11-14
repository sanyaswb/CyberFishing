export class ConfigValidationResult {
  constructor({ errors = [], warnings = [], summary = {} } = {}) {
    this.errors = errors;
    this.warnings = warnings;
    this.summary = summary;
  }

  get ok() {
    return this.errors.length === 0;
  }
}
