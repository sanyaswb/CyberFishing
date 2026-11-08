import { ConfigSchemaValidator } from "../../game/config/validation/config_schema_validator.js";
import { ConfigValidationReporter } from "../../dev/diagnostics/config_validation_reporter.js";
import { FISH_DB } from "../../game/config/databases/fish_database.js";
import { PROJECT_VERSION_CONFIG } from "../../game/presentation/version/project_version.js";

// One DEV validation composition for every page that edits the runtime config (location and House).
export function composeDevConfigValidation({ configRuntime, itemCatalog }) {
  return new ConfigValidationReporter({
    createValidator: parameterLabels => new ConfigSchemaValidator({config: configRuntime.runtimeConfig, fishDb: FISH_DB,
      itemDb: itemCatalog, mapDb: configRuntime.runtimeConfig.locations.map, parameterLabels, baseConfig: configRuntime.baseConfig,
      overrideStore: configRuntime.overrideStore, projectVersion: PROJECT_VERSION_CONFIG}),
  });
}
