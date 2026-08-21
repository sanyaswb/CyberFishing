class PackageLockValidator {
  validate({ packageJson, packageLock, contract }) {
    const errors = [];
    const require = (condition, message) => { if (!condition) errors.push(message); };
    require(packageLock.lockfileVersion === contract.lockfile.lockfileVersion, "package-lock lockfileVersion differs from contract");
    require(packageLock.requires === true, "package-lock must require dependency resolution");
    const root = packageLock.packages?.[""];
    require(!!root, "package-lock root package metadata is missing");
    require(packageLock.name === packageJson.name && root?.name === packageJson.name, "package-lock package name is stale");
    require(packageLock.version === packageJson.version && root?.version === packageJson.version, "package-lock package version is stale");
    require(root?.engines?.node === packageJson.engines.node && root?.engines?.npm === packageJson.engines.npm, "package-lock engines are stale");
    for (const section of contract.dependencyPolicy.directSections) {
      const expected = packageJson[section] || {};
      const actual = root?.[section] || {};
      require(this.#sameRecord(actual, expected), `package-lock root ${section} differs from package.json`);
      for (const name of Object.keys(expected)) {
        const locked = packageLock.packages?.[`node_modules/${name}`];
        require(!!locked, `package-lock is missing direct package ${name}`);
        require(typeof locked?.version === "string" && /^\d+\.\d+\.\d+/.test(locked.version), `${name} requires an exact locked version`);
        if (contract.lockfile.requiresIntegrity) require(typeof locked?.integrity === "string" && locked.integrity.startsWith("sha512-"), `${name} requires sha512 integrity`);
      }
    }
    if (errors.length) throw new Error(`Package lock is invalid:\n- ${errors.join("\n- ")}`);
  }

  #sameRecord(left, right) {
    return JSON.stringify(this.#sortRecord(left)) === JSON.stringify(this.#sortRecord(right));
  }

  #sortRecord(value) {
    return Object.fromEntries(Object.entries(value || {}).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
  }
}

module.exports = { PackageLockValidator };
