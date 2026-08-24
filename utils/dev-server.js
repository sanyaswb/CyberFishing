const fs = require("fs");
const http = require("http");
const path = require("path");
const {
  LegacyBridgeBuildApplication,
} = require("./build/build_legacy_bridges");
const {
  StageThreeCompatibilityBuildApplication,
} = require("./build/build_stage_3_compat_runtime");

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4173;
const ROOT_DIR = path.resolve(__dirname, "..");

class DevServerConfig {
  constructor(env = process.env, argv = process.argv) {
    this.host = env.HOST || DEFAULT_HOST;
    this.port = this.#readPort(env, argv);
    this.rootDir = ROOT_DIR;
  }

  #readPort(env, argv) {
    const portArg = argv.find((arg) => arg.startsWith("--port="));
    const rawPort = portArg ? portArg.slice("--port=".length) : env.PORT;
    const parsedPort = Number.parseInt(rawPort || `${DEFAULT_PORT}`, 10);
    return Number.isFinite(parsedPort) ? parsedPort : DEFAULT_PORT;
  }
}

class MimeTypeRegistry {
  #types = new Map([
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".css", "text/css; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".webp", "image/webp"],
    [".mp3", "audio/mpeg"],
    [".png", "image/png"],
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".gif", "image/gif"],
    [".svg", "image/svg+xml"],
    [".ico", "image/x-icon"],
    [".txt", "text/plain; charset=utf-8"],
  ]);

  getForFile(filePath) {
    return this.#types.get(path.extname(filePath).toLowerCase()) ||
      "application/octet-stream";
  }
}

class StaticFileResolver {
  #rootDir;

  constructor(rootDir) {
    this.#rootDir = rootDir;
  }

  resolve(requestUrl) {
    const pathname = this.#getPathname(requestUrl);
    const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
    const filePath = path.resolve(this.#rootDir, relativePath);

    if (!this.#isInsideRoot(filePath)) return null;
    return filePath;
  }

  #getPathname(requestUrl) {
    try {
      return decodeURIComponent(new URL(requestUrl, "http://local").pathname);
    } catch {
      return "/";
    }
  }

  #isInsideRoot(filePath) {
    const relative = path.relative(this.#rootDir, filePath);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  }
}

class StaticFileServer {
  #config;
  #mimeTypes;
  #resolver;

  constructor(config) {
    this.#config = config;
    this.#mimeTypes = new MimeTypeRegistry();
    this.#resolver = new StaticFileResolver(config.rootDir);
  }

  createServer() {
    return http.createServer((request, response) => {
      if (request.method !== "GET" && request.method !== "HEAD") {
        this.#sendText(response, 405, "Method Not Allowed");
        return;
      }

      const filePath = this.#resolver.resolve(request.url || "/");
      if (!filePath) {
        this.#sendText(response, 403, "Forbidden");
        return;
      }

      this.#serveFile(filePath, request, response);
    });
  }

  #serveFile(filePath, request, response) {
    fs.stat(filePath, (statError, stats) => {
      if (statError || !stats.isFile()) {
        this.#sendText(response, 404, "Not Found");
        return;
      }

      response.writeHead(200, {
        "Content-Type": this.#mimeTypes.getForFile(filePath),
        "Content-Length": stats.size,
        "Cache-Control": "no-store",
      });

      if (request.method === "HEAD") {
        response.end();
        return;
      }

      fs.createReadStream(filePath)
        .on("error", () => this.#sendText(response, 500, "Internal Server Error"))
        .pipe(response);
    });
  }

  #sendText(response, statusCode, message) {
    response.writeHead(statusCode, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(message);
  }
}

class DevServerApplication {
  #config;
  #server;
  #bridgeBuilder;
  #compatibilityBuilder;
  #fatalErrorHandler;
  #logger;

  constructor(
    config = new DevServerConfig(),
    {
      bridgeBuilder = new LegacyBridgeBuildApplication({
        projectRoot: config.rootDir,
      }),
      compatibilityBuilder = new StageThreeCompatibilityBuildApplication({
        projectRoot: config.rootDir,
      }),
      server = new StaticFileServer(config).createServer(),
      fatalErrorHandler = null,
      logger = console,
    } = {},
  ) {
    this.#config = config;
    this.#server = server;
    this.#bridgeBuilder = bridgeBuilder;
    this.#compatibilityBuilder = compatibilityBuilder;
    this.#logger = logger;
    this.#fatalErrorHandler = fatalErrorHandler || ((error) => {
      this.#printServerError(error);
      process.exitCode = 1;
    });
  }

  async start() {
    const legacyBuildReport = await this.#bridgeBuilder.run();
    const compatibilityBuildReport = await this.#compatibilityBuilder.run();
    const buildReport = compatibilityBuildReport.status === "no-stage-3-state" ||
      compatibilityBuildReport.status === "no-active-runtime"
      ? legacyBuildReport
      : compatibilityBuildReport;
    this.#server.on("error", (error) => this.#fatalErrorHandler(error));
    this.#server.listen(this.#config.port, this.#config.host, () => {
      const url = `http://${this.#config.host}:${this.#config.port}/`;
      this.#logger.log(`Frontend dev server: ${url}`);
      this.#logger.log(`Serving: ${this.#config.rootDir}`);
      this.#logger.log(
        `Legacy bridges: ${legacyBuildReport.status} ` +
          `(${legacyBuildReport.bridgeCount || 0}).`,
      );
      this.#logger.log(
        `Stage 3 compatibility: ${compatibilityBuildReport.status} ` +
          `(${compatibilityBuildReport.activationCount || 0} activations).`,
      );
      this.#logger.log("Press Ctrl+C to stop.");
    });
    return buildReport;
  }

  #printServerError(error) {
    if (error.code === "EADDRINUSE") {
      this.#logger.error(
        `Port ${this.#config.port} is already in use. Try npm run dev -- --port=4174.`,
      );
    } else {
      this.#logger.error(`Dev server error: ${error.message}`);
    }
  }
}

if (require.main === module) {
  new DevServerApplication().start().catch((error) => {
    console.error(`Legacy bridge build failed before listen: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  DevServerApplication,
  DevServerConfig,
  MimeTypeRegistry,
  StaticFileResolver,
  StaticFileServer,
};
