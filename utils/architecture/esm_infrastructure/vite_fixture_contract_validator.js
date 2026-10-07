const fs = require("node:fs");
const path = require("node:path");
const { EsmDependencyObserver } = require("../guards/observation/esm_dependency_observer");

class ViteFixtureContractValidator {
  constructor(projectRoot) { this.projectRoot = projectRoot; }

  validate({ contract, packageJson, installedVite }) {
    const errors = [];
    const require = (condition, message) => { if (!condition) errors.push(message); };
    require(contract?.schemaVersion === 1, "Vite fixture contract schemaVersion must equal 1");
    require(contract?.kind === "cyber-fishing-vite-fixture-build-contract", "Vite fixture contract kind is invalid");
    require(contract?.vite?.dependencyType === "exact-dev-dependency", "Vite must use an exact devDependency");
    require(packageJson.devDependencies?.vite === contract?.vite?.version, "package.json must pin the contracted Vite version exactly");
    require(packageJson.dependencies?.vite === undefined, "Vite must not be a production dependency");
    require(installedVite?.version === contract?.vite?.version, "installed Vite version differs from contract");
    require(installedVite?.engines?.node === contract?.vite?.nodeEngines, "Vite Node engine differs from reviewed contract");
    require(contract?.vite?.usage === "synthetic-fixture-build-only", "Vite usage must remain fixture-only");
    require(contract?.fixture?.moduleType === "module", "ESM fixture requires local module semantics");
    require(contract?.viteBuild?.configFile === false, "Vite fixture build must disable config-file discovery");
    require(contract?.viteBuild?.publicDir === false, "Vite fixture build must disable publicDir");
    require(contract?.viteBuild?.output === "operating-system-temporary-directory", "Vite output must use an OS temporary directory");
    require(contract?.viteBuild?.cleanup === "required", "Vite temporary output cleanup is required");
    require(contract?.viteBuild?.repositoryMutation === "forbidden", "Vite build cannot mutate the repository");
    require(this.#sameValues(contract?.forbiddenInputs, ["index.html", "src/", "assets/"]), "forbidden Vite inputs are incomplete");
    require(this.#sameValues(contract?.forbiddenEntrypoints, ["src/entrypoints/game.entry.js", "src/entrypoints/dev.entry.js"]), "forbidden entrypoints are incomplete");
    const localPackagePath = path.resolve(this.projectRoot, contract.fixture.localPackage);
    const entryPath = path.resolve(this.projectRoot, contract.fixture.entry);
    require(fs.existsSync(localPackagePath), "local ESM fixture package.json is missing");
    require(fs.existsSync(entryPath), "ESM fixture entry is missing");
    if (fs.existsSync(localPackagePath)) {
      const localPackage = JSON.parse(fs.readFileSync(localPackagePath, "utf8"));
      require(localPackage.type === "module", "ESM fixture local package must set type=module");
      require(localPackage.private === true, "ESM fixture local package must remain private");
    }
    if (errors.length) throw new Error(`Vite fixture contract is invalid:\n- ${errors.join("\n- ")}`);
  }

  validateRuntimeTopology({ legacySource, indexHtml, legacyHtml, version, runtimePath,
    gameEntrypointExists, devEntrypointExists, nativeDevelopment = false }) {
    const scripts = html => [...html.replace(/<!--[\s\S]*?-->/gu, "")
      .matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)];
    const source = script => /\bsrc\s*=\s*["']([^"']+)["']/iu.exec(script[1])?.[1];
    const module = script => /\btype\s*=\s*["']module["']/iu.test(script[1]);
    const require = (condition, message) => { if (!condition) throw new Error("Runtime entrypoint topology: " + message); };
    require(["index.html", "dev.html"].includes(legacySource), "unreviewed legacy source");
    if (nativeDevelopment) {
      require(legacySource === "dev.html" && gameEntrypointExists && devEntrypointExists,"both native entries are required");
      for (const [html,entry] of [[indexHtml,"game"],[legacyHtml,"dev"]]) {
        const tags=scripts(html);
        require(tags.length === 1 && module(tags[0]) && !tags[0][2].trim() &&
          source(tags[0]) === `src/entrypoints/${entry}.entry.js?v=${version}`,"native page must contain only its exact native entrypoint");
      }
      return;
    }
    require(!devEntrypointExists, "native DEV entrypoint is reserved for Stage 6");
    const classic = scripts(legacyHtml);
    require(classic.every(script => source(script) && !script[2].trim() && !module(script)), "legacy document must remain external classic scripts");
    require(classic.filter(script => source(script).split(/[?#]/u, 1)[0] === runtimePath).length === 1,
      "legacy document must contain exactly one cumulative runtime");
    if (legacySource === "index.html") {
      require(!gameEntrypointExists && indexHtml === legacyHtml, "historical classic production topology changed");
      return;
    }
    const production = scripts(indexHtml);
    require(gameEntrypointExists, "native production entrypoint is missing");
    require(production.length === 1 && module(production[0]) && !production[0][2].trim() &&
      source(production[0]) === "src/entrypoints/game.entry.js?v=" + version, "index must contain only the exact native game entrypoint");
    require(!classic.some(script => /src\/entrypoints\/(?:game|dev)\.entry\.js/u.test(source(script))),
      "classic DEV cannot load a native entrypoint");
  }

  validateProductionGraph({ manifest }) {
    const observer = new EsmDependencyObserver({ projectRoot: this.projectRoot });
    const entries = new Map(manifest.modules.map(module => [module.currentPath, module]));
    const allowed = ["engine", "game-config-raw", "game-config", "game-domain", "game-application-ports",
      "game-application", "game-presentation", "platform", "bootstrap-production", "entrypoint-game"];
    const entry = "src/entrypoints/game.entry.js", pending = [entry], visited = new Set();
    while (pending.length) {
      const file = pending.pop(); if (visited.has(file)) continue;
      visited.add(file);
      const ownership = entries.get(file)?.architecture;
      if (!allowed.includes(ownership?.targetBoundary) || !["esm", "verified"].includes(ownership?.migrationStatus) ||
        ownership.roles.includes("compatibility-bridge") ||
        file.startsWith("src/engine/compat/")) throw new Error("Native production graph reaches forbidden ownership: " + file);
      const text = fs.readFileSync(path.join(this.projectRoot, file), "utf8");
      if (text.includes("__CYBER_FISHING_COMPAT_RUNTIME__")) throw new Error("Native production graph reads compatibility transport: " + file);
      const observed = observer.observeFile(file, text);
      if (observed.status !== "verified") throw new Error("Native production graph contains unresolved or invalid syntax: " + file);
      if (observed.externalIdentifiers.some(name => ["DEV", "GodMode", "DevTools"].includes(name)) ||
        observed.globalMemberReads.some(read => ["DEV", "GodMode", "DevTools"].includes(read.identifier)))
        throw new Error("Native production graph reads a DEV global: " + file);
      for (const dependency of observed.observations) {
        if (dependency.resolutionStatus !== "confirmed-project" || !dependency.hasExplicitJsExtension)
          throw new Error("Native production graph contains an unapproved import: " + file + " -> " + dependency.specifier);
        pending.push(dependency.resolvedTarget);
      }
      if (file === entry && (observed.observations.length !== 1 || observed.observations[0].mechanism !== "static-import" ||
        entries.get(observed.observations[0].resolvedTarget)?.architecture.targetBoundary !== "bootstrap-production"))
        throw new Error("Native game entry must import only Production Bootstrap");
    }
    return [...visited].sort();
  }

  validateDevelopmentGraph({ manifest }) {
    const observer=new EsmDependencyObserver({projectRoot:this.projectRoot});
    const entries=new Map(manifest.modules.map(item=>[item.currentPath,item]));
    const allowed=new Set(["engine","game-config-raw","game-config","game-domain","game-application-ports",
      "game-application","game-presentation","platform","bootstrap-production","dev","bootstrap-development","entrypoint-dev"]);
    const entry="src/entrypoints/dev.entry.js",visited=new Set(),active=new Set();
    const visit=file=>{
      if (active.has(file)) throw new Error("Native DEV graph contains an import cycle: " + file);
      if (visited.has(file)) return;
      active.add(file);
      const ownership=entries.get(file)?.architecture;
      if (!allowed.has(ownership?.targetBoundary) || !["esm","verified"].includes(ownership?.migrationStatus) ||
        ownership.roles.includes("compatibility-bridge") || file.startsWith("src/engine/compat/") ||
        file === "src/bootstrap/production/game_startup.js") throw new Error("Native DEV graph reaches forbidden ownership: " + file);
      const source=fs.readFileSync(path.join(this.projectRoot,file),"utf8");
      if (source.includes("__CYBER_FISHING_COMPAT_RUNTIME__")) throw new Error("Native DEV graph reads compatibility transport: " + file);
      const tree=require("espree").parse(source,{ecmaVersion:"latest",sourceType:"module"});
      if (!tree.body.some(node=>node.type === "ExportNamedDeclaration" || node.type === "ImportDeclaration") ||
        tree.body.some(node=>["ExportAllDeclaration","ExportDefaultDeclaration"].includes(node.type)))
        throw new Error("Native DEV graph requires authored named ESM: " + file);
      const observed=observer.observeFile(file,source);
      if (observed.status !== "verified") throw new Error("Native DEV graph contains invalid syntax: " + file);
      if (observed.externalIdentifiers.some(name=>["CONFIG","BASE_CONFIG","DEBUG_MODULES","GodMode","DevTools"].includes(name)))
        throw new Error("Native DEV graph reads an unbound config/DEV global: " + file);
      for (const dependency of observed.observations) {
        if (dependency.resolutionStatus !== "confirmed-project" || !dependency.hasExplicitJsExtension)
          throw new Error("Native DEV graph contains an unapproved import: " + file + " -> " + dependency.specifier);
        visit(dependency.resolvedTarget);
      }
      if (file === entry && (observed.observations.length !== 1 || observed.observations[0].mechanism !== "static-import" ||
        entries.get(observed.observations[0].resolvedTarget)?.architecture.targetBoundary !== "bootstrap-development"))
        throw new Error("Native DEV entry must import only Development Bootstrap");
      active.delete(file);visited.add(file);
    };
    visit(entry);
    return [...visited].sort();
  }

  #sameValues(actual, expected) {
    return Array.isArray(actual) && actual.length === expected.length && expected.every((value, index) => actual[index] === value);
  }
}

module.exports = { ViteFixtureContractValidator };
