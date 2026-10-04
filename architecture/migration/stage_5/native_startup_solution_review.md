# Native startup: solution review and recommended scope decision

Date: 2026-10-04. Audited checkout: `0e2033d`.
Status: engineering recommendation only. No topology, production profile, graph
membership, retirement registry or Stage 5 completion condition is changed here.
The existing graph v7 remains authoritative until a separately recorded decision.

## Recommendation

Use two real page entry points and complete the migration in its intended stages:

- The default `index.html` is the complete native production application, starting
  through `game.entry.js` and production Bootstrap. Its closure contains no DEV,
  compatibility transport, IIFE or legacy loader. Exercise the complete game,
  inventory, config, lifecycle, saving and version UI there before release.
- A separate `dev.html` retains the existing classic/IIFE development application
  until Stage 6 migrates it to native `dev.entry.js`. Preserve its current script
  boundaries, order, source URLs, config owner and enabled development behavior.
  It never starts the native production entry alongside the IIFE.

This is the preferred project-wide approach because it introduces no new temporary
runtime loader, avoids pulling 94 DEV modules into Stage 5, preserves the existing
DEV execution model and establishes the intended production boundary immediately.
The primary Stage 5 specification explicitly assigns DEV/GodMode/overlay and
DEV-held classic retirement to Stage 6; see `../stage_4/stage5_handoff.md`.

However, graph v7 and the current continuation require canonical native browser
cutover including DEV. The recommended approach therefore needs an explicit v8
scope decision: Stage 5 certifies the actual default production native graph;
native DEV cutover is tracked to Stage 6. Keep v1–v7 and their evidence unchanged.
Do not claim this approach already satisfies v7 or silently weaken its conditions.
The final target remains native production and native DEV using the same authored
production modules; Stage 6 completes the second entry.

If both browser profiles must be native before Stage 5 closure, retain that condition
and choose the bounded DEV-only loader from `native_startup_cutover_proposal.md`,
subject to the corrections below. This is the smallest transition under that stricter
scope, but it adds temporary infrastructure and requires the recorded architecture
decision for loading legacy scripts from a new entrypoint.

## Options compared

| Approach | Stage 5 effect | Main cost or risk |
| --- | --- | --- |
| Default native production + existing separate legacy DEV | Recommended with explicit v8 scope decision | DEV native conversion remains an honest Stage 6 obligation |
| Native production + native DEV namespaces and fixed classic loader | Fits the current all-browser native requirement | New temporary loader, startup scheduling/error contract and removal work |
| Migrate DEV and its composition to native now | Reaches the final topology directly | Moves substantial Stage 6 scope into Stage 5; requires per-cluster preparation/evidence |
| Concatenate classics, convert tags, or mix native entry with IIFE | Unsuitable as an automatic conversion | Changes script scope/hoisting/strictness or creates duplicate runtime identities |

## Verified facts behind the recommendation

Game 027 is applied. Stage 5 has 28 applied clusters / 101 ESM targets and 25
preparations. Runtime: 27 active / 380 retired activations, 7 inert modules, 52
bridges, 852 historical global baseline entries and 24 known debts. Version is
0.25.2; no Stage 5 release/closure/tag exists.

The current bridges have removal stages 6 (38) and 5 (14). The proposed topology
does not authorize retirement of any bridge with a surviving classic DEV holder.
Production going native removes production demand, but the separate legacy DEV
page may still need the same exports. Reconcile holders and exact metadata after
the actual preparation, with justified Stage 6 conditions.

Using the existing alias resolver, LegacyScriptOrderReader observes 424 logical
slots and 449 physical script records. There are 26 activation tags publishing 27
active exports. The 102 substantive classic sources are not the whole execution
list: live activation shims and any live exact legacy wrappers must also execute.
Existing aliases exclude the cumulative runtime from logical slots and map physical
shim URLs to authored providers. Reading index without those aliases fails split-slot
validation; do not build a new list from a raw regex or authored paths alone.

A one-off Node VM semantic probe confirmed that concatenation is not equivalent:
with two separate scripts, `typeof Later` before a later class/function declaration
is `"undefined"`; joining the sources produces ReferenceError for the class and
`"function"` for the function. A generated combined classic file therefore needs
additional semantic transformation and proof. It is not a simpler safe substitute.

## Production preparations needed for either valid option

1. **Keep enabled gameplay effects.** FixedCatchFishFactory is currently classified
   DEV but is used by WaitingState when the live fixed-catch setting is enabled,
   which it currently is. Its injected rarity/anomaly/visual resolvers and absence
   of direct browser/DEV/config globals support a reviewed intact Application
   ownership candidate. Record actual readers and v8 membership before migration;
   retain formulas, `(TEST)` suffix, returned fields and enabled behavior.
2. **Preserve GodMode accessor semantics through an injected production reader.**
   Existing GodMode is a stateless reader of the authoritative CONFIG. Production
   consumers already use the DevFlagsProvider port, while some Bite/Fight services
   read their injected config directly. Keep these APIs and one writable owner;
   do not sprinkle replacement checks or add an independent settings store.
   Missing GodMode source currently yields false/undefined in DevFlagsProvider,
   so config injection alone does not preserve noEquipmentLoss/bite-sequence flags.
   Verify strict `=== true`, truthy master enablement, raw values, default/normal/
   guaranteed modes, fixed-percent clamp/null and live mutation before substitution.
3. **Make only diagnostic capabilities optional.** Root currently calls eight DEV
   factories unconditionally; WorldRenderFrameBuilder requires debugBuilder and
   GameApplication calls DebugService.update each frame. Absence needs an explicit
   composition/lifecycle contract, not empty fake implementations. Preserve every
   existing DEV-on call, order, receiver and allocation site. Validate malformed
   supplied collaborators at composition. Audit diagnostic callbacks for gameplay
   side effects. Build the world-debug component only when its coherent builder/
   renderer capabilities exist; keep production render passes intact.
4. **Compose one production config context and lifecycle.** Preserve live CONFIG,
   ITEM_DB/catalog references, rarity/degradation attachments, nonenumerable physics
   adapter, context/base/store/provider, interface exceptions/styles/listeners,
   version identity and badge mounting. Preserve cleanup, awaited Game.start,
   original returns/errors, pagehide disposal and storage output. Config sourcing
   from BASE_CONFIG plus overrides remains a separate Stage 6 task.
5. **Preserve the reviewed legacy order input.** When default index becomes native,
   use the retained development document as the one current legacy-order input for
   the existing builder/VM tools. Both approaches need this reviewed redirection.
   Keep aliases/split slots and immutable historical release pins; production-page
   validation must examine the actual production page, not this legacy input.

Do not silently turn off current fixed catch, GodMode or timeScale settings to
make production start. Removing the DEV overlay and diagnostic presentation must
be an explicit profile boundary; test that gameplay outcomes remain unchanged.

## Corrections required if the DEV loader option is selected

**Execution order is not parser-event timing.** Dynamically inserted classic scripts
preserve classic scope when evaluated in the same document, but load asynchronously.
They may execute after DOMContentLoaded. The existing version badge would then take
its immediate branch instead of its original loading/listener branch. A sequential
loader alone does not prove activation-phase parity. Native module evaluation also
starts after parsing. Record the supported observable startup sequence and verify
it explicitly; never forge DOMContentLoaded or document.readyState. See
[MDN DOMContentLoaded](https://developer.mozilla.org/en-US/docs/Web/API/Document/DOMContentLoaded_event).

**Script load is not successful game startup.** HTML fires a script element's load
event after running a fetched classic script. Synchronous execution errors are
reported through Window error; async IIFE failures use unhandled rejection. A loader
must not treat its final onload as proof that Game.start, watchdog registration or
pagehide setup completed. Test fetch/syntax/runtime/async failures separately and
await the actual startup readiness contract where required. Preserve actual Error
identity when available; do not invent one original Error for a resource-load event.
See [HTML script execution](https://html.spec.whatwg.org/multipage/scripting.html#execute-the-script-block)
and [MDN Window error](https://developer.mozilla.org/en-US/docs/Web/API/Window/error_event).

**Canonical identity requires canonical resolved URLs.** Publish namespaces from
native imports, never an independently bundled copy. Forwarder imports, startup
imports and cold dynamic imports must resolve to the same module URLs; differing
query/fragment suffixes can instantiate separate modules. Assert object/constructor
identity, not merely path spelling or a module count. See
[HTML module maps](https://html.spec.whatwg.org/multipage/webappapis.html#module-map).

The fixed loader list must include required live shims at their physical source
URLs, with split-member order and existing query strings. Exclude only exact proven
retired/inert placeholders and the browser IIFE. Do not relocate Script's source URL
or break its relative cold imports. Generate/validate the list at build time;
no runtime scanner, sorting, URL fallback or inference from directory names.
Use ordered classic execution with one owner; do not add a generic resource-loader
framework. Keep it outside production's import closure and remove it, its list and
browser transport at the documented Stage 6 condition. Retain the IIFE only for
explicit VM/test consumers under this option.

## Decision and execution order

Choose the topology/scope explicitly before any production change. The preferred
decision is the two-page staged migration above. If v7's full native DEV cutover is
mandatory, choose the corrected fixed-list bridge option instead; do not label either
scope as implicitly approved by this research.

Then: reviewed graph/preparations -> gameplay override and Fixed Catch parity ->
optional diagnostic contracts -> complete native production startup -> page/build/
release projection and exact retirement reconciliation -> full browser/architecture
acceptance -> metrics/release/closure/English Stage 6 handoff -> authorized cleanup.

Acceptance must exercise real default production startup, not an isolated demo.
For the staged option also rerun the retained legacy DEV page against its previous
baseline. For the loader option exercise native DEV identity and the failure/phase
cases above. In both cases use focused + Quick 24 + Architecture 32 + uncached Full
64, source unchanged, zero browser warnings/errors, one loop per page, save/reload
and inventory-button parity, enabled override behavior and exact disposal.

Utils remains 478 JS/JSON files / 71,303 newline-counted lines (+945 over the 70,358
ceiling). This documentation introduces no runtime or utility implementation.
Meet the budget before closure through proven cleanup/consolidation; preserve live
checks and historical evidence. This review does not certify or close Stage 5.
