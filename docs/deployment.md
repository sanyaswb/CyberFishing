# Release folder and server requirements

The game ships as one self-contained release folder (spec 157 R13). GitHub Pages and the game server serve the same
folder; the repository and local work stay without a build (`npm run dev` serves `src/` as native ESM), only a release
is built.

## Building

```
npm run build:release -- --out <empty dir> [--ref <commit>]
```

`utils/build-release.js` takes the committed files of the commit (default `HEAD`), never the working tree:

| Path | What it is | Cache |
| --- | --- | --- |
| `index.html`, `dev.html`, `ui-catalog.html` | the pages; each game page's one module script loads its boot module | no cache |
| `build/<page>.boot-<hash>.js` | boot module: imports the bundle; with `?esm=1` in the address it adds a `modulepreload` for every source module of the page and imports the source entry instead (debugging on a phone) | immutable |
| `build/<entry>-<hash>.js`, `build/chunks/<name>-<hash>.js` | esbuild bundles (`--bundle --format=esm --splitting --minify`), split into shared and lazy chunks | immutable |
| `build/**/*.js.map` | source maps | immutable (publication: see below) |
| `src/`, `vendor/` | source modules and vendor modules for the `?esm=1` fallback, vendor licences | short (e.g. 10 min) or revalidate |
| `assets/` | images, Spine exports, audio | short (e.g. 10 min) or revalidate |

Each game page of the folder announces, right after `<head>`, a `<link rel="preload" as="style">` per stylesheet and a
`<link rel="modulepreload">` for its boot module, the bundle and every chunk the bundle reaches (static and dynamic: the
game requests them all during startup), so the browser fetches them in parallel. `npm run release:pages -- --site
<gh-pages checkout>` builds the same folder into `releases/<version>-<commit>/` and writes root copies of the pages that
only add `<base href="releases/<version>-<commit>/">` as the first line of `<head>`. A server serves the folder as it is.

Every URL in the folder is relative, so it works under any path prefix: Pages serves it from
`/CyberFishing/releases/<version>-<commit>/` (through the root copies), a server from `/` or another prefix. The
`pages-release` check rejects absolute `/src/`, `/assets/`, `/vendor/` or `/build/` strings in the bundles; the browser
check of spec 157 R13 ran the game on both prefixes, and `npm run measure:startup -- --prefix root` measures the folder at a
server root (same start as Pages: 1.56 s cold on Fast 4G, 4 request waves).

## Server requirements

- **MIME types:** `.js` `text/javascript`, `.map` and `.json` `application/json`, `.css` `text/css`, `.html`
  `text/html`, `.svg` `image/svg+xml`, `.webp` `image/webp`, `.atlas` `text/plain`, `.mp3` `audio/mpeg`, `.m4a`
  `audio/mp4`. Module scripts fail with any other type for `.js`.
- **Compression:** gzip or brotli for `.js`, `.css`, `.json`, `.map`, `.svg`, `.atlas`, `.html` (images and audio are
  compressed already). Startup budgets of spec 157 count compressed bytes.
- **HTTP/2** (or HTTP/3): the release still requests ~70 files before the first frame; HTTP/1.1 with 6 connections
  per host is slower.
- **Caching:** the hashed files under `build/` never change for a name: `Cache-Control: public, max-age=31536000,
  immutable`. The pages: `no-cache` (revalidate every time), so a new release is seen at once. `src/`, `vendor/`,
  `assets/` have no hash in their names: a short `max-age` or revalidation (on Pages every release is its own folder,
  so their URLs change with the release anyway).
- **Content Security Policy** (if the server sets one):
  - `script-src 'self'` — the pages load module scripts of the same origin only; there are no inline scripts;
  - `worker-src 'self' blob:` — PixiJS starts workers from `blob:` URLs (`vendor/pixi/8.22.0/pixi-scene.js`);
  - `style-src 'self' 'unsafe-inline'` — the static startup screen is an inline `<style>` in each page (spec 157 D0;
    a hash of that block instead of `'unsafe-inline'` also works, it changes only with the page);
  - `img-src 'self' blob: data:`, `media-src 'self'` (radio streams), `connect-src 'self'` plus the API origin once
    there is a backend.
- **Source maps:** published on GitHub Pages; on the production server publishing them is the owner's decision (for
  example only to developers).

## Game server (spec 029)

The backend is Node.js 24, TypeScript and Fastify 5 behind HTTPS (same site through a reverse proxy, or explicit
domains). It serves the release folder unchanged, either through the proxy or with `@fastify/static` setting the headers
above per path (`build/` immutable, pages `no-cache`). The client build does not depend on the backend build (the
backend is its own package). The API address comes from the server's configuration, never from the bundle. esbuild also
compiles TypeScript, so the same release step serves the client after its move to TypeScript (after 1.0); shared types
of saves and the API are a separate later decision (spec 029).
