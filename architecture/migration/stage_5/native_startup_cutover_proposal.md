# Native production startup and canonical DEV graph proposal

Date: 2026-10-04. Audit base: `6429876b7bb1c208eb6e3fa80daa8ab0502330e5`.
Status: concrete design proposal; topology changes are not applied or approved.
Graph v7 and all completed evidence remain authoritative and unchanged.

## Verified problem

Game 027 is complete. The browser still uses a cumulative IIFE and classic
Development Bootstrap. Adding a module tag beside that graph would instantiate
another CONFIG/catalog/class graph. A module tag also does not block subsequent
classic scripts, so replacing the IIFE tag alone cannot preserve activation order.

The current index contains 102 substantive classic sources after excluding exact
transport shims and retired/inert placeholders: 94 DEV, three Development Bootstrap,
three Production Bootstrap, one Platform activation and one version alias. They
share classic lexical bindings and conditional window properties. Converting their
tags to `type="module"` changes scope and strict-mode semantics.

There are 52 registered bridges: 38 assigned to Stage 6 and 14 to Stage 5. Those 14
are held by `src/config/config.js` (five), `src/ui/ui.js` (three), version alias,
version badge and interface activation (one each), classic Script (EventBus and
EventLifecycle), and LocationDebugRenderFrameBuilder (Vector2). The last three are
actual DEV holders and must receive an exact reviewed Stage 6 retirement condition.
No bridge may retire while its classic holder survives.

Production Root imports 153 reviewed native dependencies but invokes eight DEV
factory ports unconditionally. WorldRenderFrameBuilder requires a debug builder;
GameApplication calls DebugService.update each frame; render contracts require the
world debug renderer. Empty objects implementing these methods would hide these
remaining lifecycle requirements.

FixedCatchFishFactory needs separate attention: CONFIG.debug.fixedCatch.enabled is
currently true, and WaitingState calls its create method based on that live config.
Omitting the factory or disabling the flag silently changes which fish is hooked.
It has no browser/DEV/global dependencies and receives all three resolvers through
constructor injection. Its implementation, formulas, suffix, API and enabled-config
behavior must survive a reviewed ownership decision. No config default is changed.

The current DevFlagsProvider does not fall back to CONFIG for GodMode flags: absent
GodMode source makes isEnabled false and godModeValue undefined. Current CONFIG has
GodMode enabled, noEquipmentLoss true, fixed bite chance enabled at 100 percent and
timeScale 240. A production profile must preserve enabled gameplay effects through
reviewed production ports with the same accessor semantics; removing GodMode or
supplying config alone is not proven equivalent. Audit actual consumers and record
that preparation separately. Do not silently disable these settings.

Utils now has 478 tracked JS/JSON files / 71,303 newline-counted lines against a
70,358-line ceiling (+945), including the separate saved visual-field regression
scenarios. This proposal adds no utility implementation.

## Proposed bounded transition

The production page uses only `src/entrypoints/game.entry.js`, which imports only
Production Bootstrap. Bootstrap composes native CONFIG/catalog/context, platform
startup targets, Root and Game. Its dependency closure contains no DEV code,
compatibility transport, legacy loader or IIFE. Existing version/config aliases and
game/cleanup handles are published through Platform; no new global is introduced.

A distinct DEV entry imports only Development Bootstrap. Its temporary bridge
imports the exact native namespaces through the existing cumulative build selection
and exposes them through the existing module-exports-only transport. Its browser
page never loads the IIFE. Root, Game, App, CONFIG, ITEM_DB, SLOT_CONFIG and their
consumers therefore use one native graph within each page/realm.

Preserve the current classic source-order document as the single reviewed build/test
input when the default index becomes production. Generate a fixed source list at
build time through LegacyScriptOrderReader and its aliases/split-slot semantics.
No browser scanner or inferred dependency order is introduced.

After native namespaces are ready, a temporary DEV-only Platform loader executes
that exact list as ordinary classic scripts, sequentially, at their original URLs.
This preserves shared lexical declarations and original code bytes without eval,
new Function, module conversion or copying business logic into the bridge. It is
an explicit exception requiring the separate decision described by refactor_Task
section 8, "load legacy scripts from a new entrypoint". Its owner is Development
Bootstrap; remove the loader, fixed list and browser transport in Stage 6 when every
listed classic holder has migrated. Production never imports this loader.

The existing IIFE builder remains available for SourceRuntime/VM evidence until
those consumers retire. Its test role must be recorded honestly; browser identity
acceptance uses the actual native pages. Extend the current builder and existing
checks rather than creating another migration framework.

## Required preparatory changes

1. Resolve the FixedCatchFishFactory ownership from its actual enabled production
   consumer. Preferred behavior-preserving candidate: intact Application class with
   injected resolver ports, migrated as an additional reviewed prerequisite. Record
   graph v8 before changing membership/classification; leave v1-v7 immutable.
   Resolve currently enabled GodMode effects through production ports without a
   concrete DEV import, preserving exact reads, return values and live config.
2. Make genuinely optional DEV diagnostics/render/UI capabilities absent explicitly.
   Preserve current DEV-on calls, instances, options, order and receiver semantics;
   retain strict validation for malformed supplied capabilities. Do not supply fake
   production debug implementations. Keep preparatory changes separate from migration.
3. Compose config's rarity/degradation attachments, nonenumerable physics adapter,
   sole context/base/store/provider and conditional aliases in the correct startup
   phase. DEV's classic config activation retains one context; production receives
   its one context directly. Both use the canonical native CONFIG owner.
4. Preserve interface styles/listeners/contextmenu/touch exceptions; badge loading
   versus immediate mounting; prior-game cleanup, publish/awaited-start, watchdog,
   idempotent pagehide cleanup, original errors and final storage-usage output.
5. Review the legacy-order input relocation and current release projection through
   existing strict mechanisms. Historical Stage 3/4 release pins remain immutable.

## Acceptance and negative fixtures before cutover

- Reject a native browser page containing the IIFE, duplicate native targets or a
  second writable CONFIG/catalog/context. Compare native import namespaces directly
  with every surviving activation, Root/Game/App constructors and injected owners.
- Reject unreviewed/duplicate/missing/reordered script paths, invalid split slots,
  loader execution before native publication, and a production dependency on the
  DEV loader or compatibility transport. Propagate the original script-load error.
- Verify classic lexical/property surfaces, receivers, strict-mode-sensitive cases
  and the config/interface/version/badge activation sequence against the original.
- Exercise missing DEV capabilities and malformed supplied ones; verify ordinary
  fishing plus the currently enabled Fixed Catch behavior without disabling config.
  Compare the existing DEV-on hot-loop/save/member evidence exactly.
- Exercise production and DEV separately: live overrides where supported, exactly
  one loop, inventory open/close/input/pause/disposal, badge/styles, zero warnings/
  errors, three save strings and inventory-button texts after reload.
- Focused + Quick + Architecture + uncached Full, source unchanged during acceptance.
  Meet the utils budget before Stage 5 closure; keep all 64 live checks and evidence.

## Alternatives and decision needed

**Recommended:** approve the bounded DEV-only classic loader above, with its exact
reviewed source list, canonical native namespaces and Stage 6 removal condition.
This retains the original Stage 6 DEV scope and classic semantics while completing
Stage 5 production independence and canonical browser identity.

**No loader:** bring the 94 remaining DEV modules and three Development Bootstrap
sources into native migration now, with explicit per-cluster scope/evidence reviews.
This moves a substantial part of Stage 6 into the current task. It needs a new scope
decision; changing their script tags alone is insufficient.

An isolated native demo while the main DEV page retains its IIFE is useful evidence
but does not satisfy the accepted canonical browser cutover obligation, and is not
proposed as Stage 5 completion.
