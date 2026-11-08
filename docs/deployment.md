# Release folder and server requirements

The game ships as a self-contained release folder (spec 157 R13) in two forms of one build (spec 169, owner: DEV only on
Pages): the **production release** for the game server holds the game only; the **Pages release** is the full test
release with `dev.html`, the `?esm=1` source fallback and source maps. The repository and local work stay without a
build (`npm run dev` serves `src/` as native ESM), only a release is built.

## Building

```
npm run build:release -- --out <empty dir> [--ref <commit>] [--maps <dir outside the release>]
npm run release:pages -- --site <gh-pages checkout>
```

Both take the committed files of the commit (default `HEAD`), never the working tree. `build:release` writes the
production release: `index.html`, its `build/` files (a boot module without the `?esm=1` branch, no source graph, no
`sourceMappingURL`), `assets/` and the vendor licences: no `dev.html`, no `src/`, no vendor modules. Source maps go only
to `--maps`, outside the public folder (for the developer); without it they are not kept. The `pages-release` check
holds this form (game only, closed URL graph). The Pages release has every row of the table:

| Path | What it is | Cache |
| --- | --- | --- |
| `index.html`, `dev.html` | the pages; each game page's one module script loads its boot module | no cache |
| `sw.js` | the release's offline cache worker (see below) | no cache |
| `build/<page>.boot-<hash>.js` | boot module: imports the bundle; with `?esm=1` in the address it adds a `modulepreload` for every source module of the page and imports the source entry instead (debugging on a phone); a bundle that cannot load shows the failure and a retry button on the startup screen | immutable |
| `build/<entry>-<hash>.js`, `build/chunks/<name>-<hash>.js` | esbuild bundles (`--bundle --format=esm --splitting --minify`), one build per page, split into shared and lazy chunks | immutable |
| `build/<page>.styles-<hash>.css` | the page's stylesheets in page order as one minified file; the release page links only this one, also under `?esm=1` | immutable |
| `build/**/*.map` | source maps | immutable (publication: see below) |
| `src/`, `vendor/` | Pages only: source modules and vendor modules for the `?esm=1` fallback; vendor licences (both forms) | short (e.g. 10 min) or revalidate |
| `assets/` | images, Spine exports, audio | short (e.g. 10 min) or revalidate |

Each game page of the folder announces, right after `<head>`, a `<link rel="preload" as="style">` for its stylesheet and a
`<link rel="modulepreload">` for its boot module, the bundle and the chunks the start loads (the static ones and those of
the start's own `import()` calls, `START_IMPORTS` in `utils/build-release.js`), so the browser fetches them in parallel;
a feature loaded after `ready` or on first use stays out of the preloads (spec 157 R12). `npm run release:pages -- --site
<gh-pages checkout>` builds the same folder into `releases/<version>-<commit>/` and writes root copies of the pages that
only add `<base href="releases/<version>-<commit>/">` as the first line of `<head>`. A server serves the folder as it is.

Every URL in the folder is relative, so it works under any path prefix: Pages serves it from
`/CyberFishing/releases/<version>-<commit>/` (through the root copies), a server from `/` or another prefix. The
`pages-release` check rejects absolute `/src/`, `/assets/`, `/vendor/` or `/build/` strings in the bundles; the browser
check of spec 157 R13 ran the game on both prefixes, and `npm run measure:startup -- --prefix root` measures the
production release at a server root (v0.50.47: T-play 1.24 s cold on Fast 4G with CPU x4, 0.44 MB).

## Offline cache (spec 171 stage 4)

Both forms carry `sw.js` beside the game page (Pages: also at the site root, beside the root `index.html`, its files
under `releases/<id>/`), and the built game page declares it (`<html data-offline-worker="sw.js">`); `npm run dev` and
`dev.html` never register a worker. The page registers it only after the full load, so it never competes with the
start, and hands it the files it loaded (taken from the HTTP cache, nothing downloads twice). The worker keeps one cache
per release: the game page answers from the cache at once (instant repeat start, offline), the release's files are cache
first, and only what the game actually loaded is kept (audio when it played, progress-locked content when opened). A
new release's worker installs in the background and takes over on the next launch. Serve `sw.js` with `no-cache` (the
browser also checks it on every navigation: `updateViaCache: "none"`).

## Server requirements

- **MIME types:** `.js` `text/javascript`, `.map` and `.json` `application/json`, `.css` `text/css`, `.html`
  `text/html`, `.svg` `image/svg+xml`, `.webp` `image/webp`, `.atlas` `text/plain`, `.mp3` `audio/mpeg`, `.m4a`
  `audio/mp4`. Module scripts fail with any other type for `.js`.
- **Compression:** gzip or brotli for `.js`, `.css`, `.json`, `.map`, `.svg`, `.atlas`, `.html` (images and audio are
  compressed already). Startup budgets of spec 157 count compressed bytes. Prefer brotli on the game server: the main
  start bundle is about 20 % smaller than with gzip, with no code change (Pages offers gzip only).
- **HTTP/2** (or HTTP/3): the release still requests ~30 files before the first frame; HTTP/1.1 with 6 connections
  per host is slower.
- **Caching:** the hashed files under `build/` never change for a name: `Cache-Control: public, max-age=31536000,
  immutable`. The pages: `no-cache` (revalidate every time), so a new release is seen at once. `src/`, `vendor/`,
  `assets/` have no hash in their names: a short `max-age` or revalidation (on Pages every release is its own folder,
  so their URLs change with the release anyway).
- **Content Security Policy** (if the server sets one):
  - `script-src 'self'` — the pages load module scripts of the same origin only; there are no inline scripts; no
    `'unsafe-eval'` either: where the page forbids eval, the scene installs PixiJS's eval-free systems before its renderer
    starts (TK-256, `pixi_runtime_module.js`), and pages that allow eval keep Pixi's faster generated code;
  - `worker-src 'self' blob:` — PixiJS starts workers from `blob:` URLs (`vendor/pixi/8.22.0/pixi-scene.js`);
  - `style-src 'self' 'unsafe-inline'` — the static startup screen is an inline `<style>` in each page (spec 157 D0;
    a hash of that block instead of `'unsafe-inline'` also works, it changes only with the page). A boot module that
    cannot load at all leaves the screen's ring running: with no inline scripts nothing on the page can report it;
  - `img-src 'self' blob: data:`, `media-src 'self'` (radio streams), `connect-src 'self'` plus the API origin once
    there is a backend.
- **Source maps:** published on GitHub Pages; the production release does not contain them (`--maps` keeps them for the
  developer, spec 169).

## Game server (spec 029)

The backend is Node.js 24, TypeScript and Fastify 5 behind HTTPS (same site through a reverse proxy, or explicit
domains). It serves the release folder unchanged, either through the proxy or with `@fastify/static` setting the headers
above per path (`build/` immutable, pages `no-cache`). The client build does not depend on the backend build (the
backend is its own package). The API address comes from the server's configuration, never from the bundle. esbuild also
compiles TypeScript, so the same release step serves the client after its move to TypeScript (after 1.0); shared types
of saves and the API are a separate later decision (spec 029).
