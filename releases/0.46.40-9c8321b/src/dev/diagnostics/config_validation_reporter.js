// Validates the live configuration on request (after a DEV edit, import or reset, never per frame) and
// reports the problems to the console. It reads the configuration and never changes it.
export class ConfigValidationReporter {
  #createValidator;
  #labelsUrl;
  #labels = null;

  // createValidator(parameterLabels) returns a ConfigSchemaValidator over the live config.
  constructor({ createValidator, labelsUrl = "src/dev/metadata/parameter_labels.json" }) {
    this.#createValidator = createValidator;
    this.#labelsUrl = labelsUrl;
  }

  async report(reason, { quietWhenValid = false } = {}) {
    try {
      this.#labels ??= fetch(this.#labelsUrl).then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      });
      const result = this.#createValidator(await this.#labels).validate();
      const issues = [...result.errors, ...result.warnings];
      if (quietWhenValid && issues.length === 0) return result;
      const message = `[ConfigValidation] ${reason}: ${result.errors.length} errors, ${result.warnings.length} warnings`;
      if (issues.length === 0) console.info(message, result.summary);
      else console.warn(message, issues);
      return result;
    } catch (error) {
      this.#labels = null;
      console.warn(`[ConfigValidation] ${reason}: validation unavailable`, error);
      return null;
    }
  }
}
