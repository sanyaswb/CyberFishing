class RootPackageValidator {
  validate({ packageJson, contract, projectVersion }) {
    const errors = [];
    const require = (condition, message) => { if (!condition) errors.push(message); };
    require(packageJson.name === contract.package.name, "package.json name differs from package contract");
    require(packageJson.version === projectVersion, "package.json version differs from CURRENT_PROJECT_VERSION");
    require(packageJson.private === contract.package.private, "package.json must remain private");
    require(packageJson.engines?.node === contract.runtime.node, "package.json Node range differs from package contract");
    require(packageJson.engines?.npm === contract.runtime.npm, "package.json npm range differs from package contract");
    require(packageJson.packageManager === contract.runtime.packageManager, "package.json packageManager differs from package contract");
    require(packageJson.type === undefined, "root package.json must not set type while utils use CommonJS");
    require(packageJson.source === "index.html", "classic index.html source entrypoint must remain unchanged");
    require(packageJson.dependencies?.vite === undefined, "Vite cannot be a production dependency");
    for (const section of contract.dependencyPolicy.directSections) {
      require(packageJson[section] && typeof packageJson[section] === "object", `package.json requires ${section}`);
      for (const [name, range] of Object.entries(packageJson[section] || {})) require(typeof range === "string" && range.length > 0, `${section}.${name} requires a compatible range`);
    }
    if (errors.length) throw new Error(`Root package definition is invalid:\n- ${errors.join("\n- ")}`);
  }
}

module.exports = { RootPackageValidator };
