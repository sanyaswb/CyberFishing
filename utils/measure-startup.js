"use strict";

// npm run measure:startup (spec 157 R9, owner decision Q5-b): the startup of a local copy of the Pages release,
// measured in headless Chrome through Playwright, so a regression shows before a release without a phone.
// - The release is built from a commit (default HEAD) with the Pages release builder into a temporary site and served
//   like GitHub Pages: HTTP/2 over TLS (a throwaway self-signed certificate made with openssl; without openssl the
//   server falls back to HTTP/1.1, whose 6 connections per host make the cold start slower than on Pages, and the
//   report says so), gzip for text, `Cache-Control: max-age=600`.
// - The network is emulated through the DevTools protocol (default 4G), the viewport is a portrait phone.
// - Cold start (the spec's main metric): a new browser context with the cache disabled per run. Warm start: one
//   context, one unmeasured load, then reloads.
// - Every run waits for data-game-ready and reads the page's timing entries; the report is the DEV overlay's
//   StartupLoadReport. Medians are compared with the spec 157 Q4 budget; --strict exits 1 when one is exceeded.
// Options: --ref <commit> --page index.html|dev.html --network 4g|3g|none --runs N --browser chrome|msedge|<path>
//   --cpu N (CPU slowdown through the DevTools protocol: 4 is close to a mid-range phone, where the scene's setup takes
//   long enough for images of hidden views to arrive before ready; 1 = the PC as it is) --prefix pages|root (pages: the
//   Pages site with root copies and releases/<id>/; root: the release folder at the server root, spec 157 R13) --strict.
//   The summary is written to utils/generated/startup-measure.json.

const fs = require("node:fs");
const http = require("node:http");
const http2 = require("node:http2");
const { spawnSync } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const { pathToFileURL } = require("node:url");
const { GitCommitTree, PagesReleaseBuilder } = require("./build-pages-release.js");
const { MimeTypeRegistry } = require("./dev-server.js");

const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_FILE = path.join(ROOT_DIR, "utils", "generated", "startup-measure.json");
const MEBIBYTE = 1048576;
const READY_TIMEOUT_MS = 180000;
const COMPRESSED_TYPES = /^(?:text\/|application\/(?:json|javascript))|image\/svg\+xml/u;
// Chrome DevTools throttling presets: "Fast 4G" and "Slow 4G" (the former "Fast 3G"); bytes per second.
const NETWORKS = Object.freeze({
  "4g": Object.freeze({ latency: 60, downloadThroughput: 9000 * 1000 / 8, uploadThroughput: 1500 * 1000 / 8 }),
  "3g": Object.freeze({ latency: 150, downloadThroughput: 1600 * 1000 / 8, uploadThroughput: 750 * 1000 / 8 }),
  none: null,
});
// Spec 157 Q4 (owner, 2026-10-30): T-paint <= 1 s, cold T-play <= 4 s, warm T-play <= 2 s, <= 3 MB transferred
// before T-play, <= 3 sequential network steps.
const BUDGET = Object.freeze({ paintMs: 1000, coldPlayMs: 4000, warmPlayMs: 2000, bytes: 3 * MEBIBYTE, networkSteps: 3 });
const PHONE = Object.freeze({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  ignoreHTTPSErrors: true });

function readOptions(argv) {
  const value = (name, fallback) => {
    const index = argv.indexOf(name);
    return index === -1 ? fallback : argv[index + 1];
  };
  const options = { ref: value("--ref", "HEAD"), page: value("--page", "index.html"), network: value("--network", "4g"),
    runs: Number(value("--runs", "5")), browser: value("--browser", "chrome"), cpu: Number(value("--cpu", "1")),
    prefix: value("--prefix", "pages"),
    strict: argv.includes("--strict") };
  if (!["index.html", "dev.html"].includes(options.page)) throw new Error("--page must be index.html or dev.html");
  if (!Object.hasOwn(NETWORKS, options.network)) throw new Error("--network must be 4g, 3g or none");
  if (!Number.isInteger(options.runs) || options.runs < 1) throw new Error("--runs must be a positive integer");
  if (!Number.isFinite(options.cpu) || options.cpu < 1 || options.cpu > 20) throw new Error("--cpu must be 1..20");
  if (!["pages", "root"].includes(options.prefix)) throw new Error("--prefix must be pages or root");
  return options;
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// One series of runs (cold or warm) -> medians and the verdict against the budget.
function summarize(kind, reports) {
  const medians = {
    paintMs: median(reports.map((report) => report.paintMs)),
    playMs: median(reports.map((report) => report.playMs)),
    bytes: median(reports.map((report) => report.beforePlay.transferred)),
    requests: median(reports.map((report) => report.beforePlay.count)),
    networkSteps: median(reports.map((report) => report.networkSteps)),
  };
  const playBudget = kind === "cold" ? BUDGET.coldPlayMs : BUDGET.warmPlayMs;
  const verdicts = [
    ["T-paint", medians.paintMs, BUDGET.paintMs],
    ["T-play", medians.playMs, playBudget],
    ...(kind === "cold" ? [["Bytes-play", medians.bytes, BUDGET.bytes], ["Waterfall", medians.networkSteps, BUDGET.networkSteps]] : []),
  ].map(([metric, actual, limit]) => ({ metric, actual, limit, pass: actual !== null && actual <= limit }));
  return { kind, runs: reports.length, medians, verdicts };
}

function formatSummary(summary) {
  const { medians } = summary;
  const ms = (value) => value === null ? "-" : `${Math.round(value)} ms`;
  const lines = [`${summary.kind} (${summary.runs} runs): T-paint ${ms(medians.paintMs)}, T-play ${ms(medians.playMs)}, `
    + `${(medians.bytes / MEBIBYTE).toFixed(2)} MB transferred, ${medians.requests} requests, `
    + `${medians.networkSteps} network steps`];
  for (const verdict of summary.verdicts) {
    const shown = verdict.metric === "Bytes-play" ? `${(verdict.actual / MEBIBYTE).toFixed(2)} MB <= ${verdict.limit / MEBIBYTE} MB`
      : verdict.metric === "Waterfall" ? `${verdict.actual} <= ${verdict.limit}` : `${ms(verdict.actual)} <= ${verdict.limit} ms`;
    lines.push(`  ${verdict.pass ? "PASS" : "OVER"} ${verdict.metric}: ${shown}`);
  }
  return lines.join("\n");
}

// A one-day self-signed certificate for 127.0.0.1, or null when no openssl is found (PATH, then Git for Windows).
function createCertificate(workDir) {
  const keyFile = path.join(workDir, "key.pem");
  const certFile = path.join(workDir, "cert.pem");
  for (const openssl of ["openssl", "C:/Program Files/Git/usr/bin/openssl.exe"]) {
    const result = spawnSync(openssl, ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", keyFile, "-out", certFile,
      "-days", "1", "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1"], { stdio: "ignore" });
    if (result.status === 0) return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
  }
  return null;
}

// Serves the built site like GitHub Pages: HTTP/2 when a certificate exists, gzip for text types, a 10 minute cache
// lifetime.
function serveSite(siteDir, certificate) {
  const mime = new MimeTypeRegistry();
  const handle = (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = path.join(siteDir, pathname === "/" ? "index.html" : pathname);
    if (!file.startsWith(siteDir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    const type = mime.getForFile(file);
    let body = fs.readFileSync(file);
    const headers = { "Content-Type": type, "Cache-Control": "max-age=600" };
    if (COMPRESSED_TYPES.test(type) && /\bgzip\b/u.test(request.headers["accept-encoding"] || "")) {
      body = zlib.gzipSync(body, { level: 6 });
      headers["Content-Encoding"] = "gzip";
      headers.Vary = "Accept-Encoding";
    }
    headers["Content-Length"] = body.length;
    response.writeHead(200, headers).end(body);
  };
  const server = certificate ? http2.createSecureServer({ ...certificate, allowHTTP1: true }, handle) : http.createServer(handle);
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// Collects the page's uncaught errors and console errors for a start that never becomes ready.
function watchPageErrors(page) {
  page.startupErrors = [];
  page.on("pageerror", (error) => page.startupErrors.push(String(error?.message ?? error)));
  page.on("console", (message) => { if (message.type() === "error") page.startupErrors.push(message.text()); });
  return page;
}

function launchOptions(browser) {
  return ["chrome", "msedge"].includes(browser) ? { channel: browser, headless: true } : { executablePath: browser, headless: true };
}

async function measureLoad(context, page, { network, cold, url, reload, cpu = 1 }) {
  const client = await context.newCDPSession(page);
  if (cpu > 1) await client.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  // Requests that started and have not finished, for the diagnosis of a start that never becomes ready.
  const pending = new Map();
  client.on("Network.requestWillBeSent", ({ requestId, request }) => pending.set(requestId, request.url));
  client.on("Network.loadingFinished", ({ requestId }) => pending.delete(requestId));
  client.on("Network.loadingFailed", ({ requestId, errorText }) => {
    pending.set(requestId, `${pending.get(requestId) ?? requestId} (failed: ${errorText})`);
  });
  await client.send("Network.enable");
  await client.send("Network.setCacheDisabled", { cacheDisabled: cold });
  if (network) await client.send("Network.emulateNetworkConditions", { offline: false, ...network });
  if (reload) await page.reload({ waitUntil: "commit" });
  else await page.goto(url, { waitUntil: "commit" });
  try {
    await page.waitForSelector("html[data-game-ready]", { state: "attached", timeout: READY_TIMEOUT_MS });
  } catch (error) {
    // A start that never becomes ready: name the last stage it reached and the page's own errors.
    const reached = await page.evaluate(() => performance.getEntriesByType("mark").map((mark) => mark.name)).catch(() => []);
    const errors = (page.startupErrors ?? []).slice(-5);
    const stuck = [...pending.values()].slice(0, 8).map((value) => value.replace(/^https?:\/\/[^/]+/u, ""));
    throw new Error(`The game did not become ready in ${READY_TIMEOUT_MS} ms; marks: ${reached.join(", ") || "none"}; `
      + `page errors: ${errors.join(" | ") || "none"}; unfinished requests (${pending.size}): ${stuck.join(", ") || "none"}`,
    { cause: error });
  }
  const timings = await page.evaluate(() => {
    const copy = ({ name, initiatorType, startTime, responseEnd, transferSize, encodedBodySize, decodedBodySize }) =>
      ({ name, initiatorType, startTime, responseEnd, transferSize, encodedBodySize, decodedBodySize });
    const navigation = performance.getEntriesByType("navigation")[0];
    return {
      marks: performance.getEntriesByType("mark").map(({ name, startTime }) => ({ name, startTime })),
      paints: performance.getEntriesByType("paint").map(({ name, startTime }) => ({ name, startTime })),
      navigation: navigation ? copy(navigation) : null,
      resources: performance.getEntriesByType("resource").map(copy),
    };
  });
  await client.detach();
  return timings;
}

// The asset files (images, audio, Spine data, location data) a cold start finished before ready, as release paths,
// sorted: two builds that request the same files before the start give the same list (spec 157 TK-178).
function withAssetsBeforePlay(build, timings) {
  const report = build(timings);
  const assets = timings.resources.filter((entry) => report.playMs !== null && entry.responseEnd <= report.playMs)
    .map((entry) => new URL(entry.name).pathname.replace(/^.*?\/(?=assets\/)/u, ""))
    .filter((pathname) => pathname.startsWith("assets/"));
  return Object.freeze({ ...report, assetsBeforePlay: Object.freeze([...new Set(assets)].sort()) });
}

async function main() {
  const options = readOptions(process.argv.slice(2));
  const { chromium } = require("playwright-core");
  const { StartupLoadReport } = await import(pathToFileURL(path.join(ROOT_DIR, "src/dev/diagnostics/startup_load_report.js")).href);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-fishing-startup-"));
  const siteDir = path.join(workDir, "site");
  fs.mkdirSync(siteDir);
  let server = null;
  let browser = null;
  try {
    // --prefix pages: the Pages site (root copies with <base> and preloads, the release under releases/<id>/);
    // --prefix root: the release folder itself at the server root, as a game server would serve it (spec 157 R13).
    const builder = new PagesReleaseBuilder({ tree: new GitCommitTree({ rootDir: ROOT_DIR, ref: options.ref }) });
    let release;
    if (options.prefix === "root") {
      fs.rmSync(siteDir, { recursive: true, force: true });
      release = builder.buildRelease(siteDir);
    } else release = builder.build(siteDir);
    const certificate = createCertificate(workDir);
    const protocol = certificate ? "h2" : "http/1.1";
    server = await serveSite(siteDir, certificate);
    const url = `${certificate ? "https" : "http"}://127.0.0.1:${server.address().port}/${options.page}`;
    browser = await chromium.launch(launchOptions(options.browser));
    const network = NETWORKS[options.network];
    // Every entry is kept: the page loads several hundred files and browsers keep 250 by default.
    const enlargeBuffer = () => performance.setResourceTimingBufferSize(5000);
    console.log(`Measuring ${release.id} ${options.page} (${options.prefix}) over ${protocol}, network ${options.network}, CPU x${options.cpu}, `
      + `${options.runs} runs each.`);
    if (!certificate) console.log("No openssl: HTTP/1.1 limits the browser to 6 connections, so cold starts read slower than on Pages.");
    const cold = [];
    for (let run = 0; run < options.runs; run += 1) {
      const context = await browser.newContext(PHONE);
      await context.addInitScript(enlargeBuffer);
      const page = watchPageErrors(await context.newPage());
      cold.push(withAssetsBeforePlay(StartupLoadReport.build, await measureLoad(context, page, { network, cold: true, url, reload: false, cpu: options.cpu })));
      await context.close();
    }
    const warm = [];
    const context = await browser.newContext(PHONE);
    await context.addInitScript(enlargeBuffer);
    const page = watchPageErrors(await context.newPage());
    await measureLoad(context, page, { network, cold: false, url, reload: false, cpu: options.cpu });
    for (let run = 0; run < options.runs; run += 1) {
      warm.push(StartupLoadReport.build(await measureLoad(context, page, { network, cold: false, url, reload: true, cpu: options.cpu })));
    }
    await context.close();
    const summaries = [summarize("cold", cold), summarize("warm", warm)];
    for (const summary of summaries) console.log(formatSummary(summary));
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify({ release: release.id, page: options.page, prefix: options.prefix, protocol, network: options.network, cpu: options.cpu,
      budget: BUDGET, summaries, coldRuns: cold, warmRuns: warm }, null, 2)}\n`);
    console.log(`Report: ${path.relative(ROOT_DIR, OUTPUT_FILE)}`);
    if (options.strict && summaries.some((summary) => summary.verdicts.some((verdict) => !verdict.pass))) process.exitCode = 1;
  } finally {
    await browser?.close();
    await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { BUDGET, NETWORKS, median, summarize, formatSummary, readOptions };
