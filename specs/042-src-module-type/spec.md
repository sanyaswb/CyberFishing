# Feature Specification: Source modules declare their module type

**Created**: 2026-10-09 · **Status**: Implemented · **Kind**: test tooling (finalization review 9, first part)

## Problem (verified)
Checks that `require()` native modules from `src` made Node print `MODULE_TYPELESS_PACKAGE_JSON`: without a module type
Node first tried CommonJS, failed and reparsed every file as ESM. The root `package.json` cannot declare
`"type": "module"` because `utils/` is CommonJS.

## Solution
`src/package.json` declares `{"type": "module"}` for the source tree only. Every `src/**/*.js` file has ESM syntax
(verified with acorn: 0 files without import/export; the `require(` matches in `src` are `repository.require` methods).
Browsers ignore the file; the Pages release does not include it (not referenced by the page or the module graph).

## Evidence
Full 39/39 with 0 Node warnings (was 1 per affected check run); game-cycle digest unchanged `7b9baea3…ed5b6`.
