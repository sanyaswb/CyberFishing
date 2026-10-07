"use strict";

const { LegacyScriptOrderReader } = require("./legacy_script_order_reader");

// The logical legacy slot at which the single cumulative runtime tag evaluates in index.html: the slot
// of the first logical script after the tag. `precedesWholeSlot` is true when the tag also precedes
// every member of that slot (the script before it belongs to an earlier slot), so every provider and
// activation of the slot sees the runtime. The aliases are the exact runtime script aliases of the tree
// (activation shims resolve to their providers, the runtime itself to null).
class CumulativeRuntimeLoadSlot {
  static read({ html, aliases, runtimePath }) {
    const tags = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script>/giu)]
      .filter(match => match[1].split("?")[0].replace(/^\.\//u, "") === runtimePath);
    if (tags.length !== 1) throw new Error(`Expected one cumulative runtime tag: ${runtimePath}`);
    const reader = new LegacyScriptOrderReader(null, { scriptAliases: aliases });
    const scripts = reader.parse(html);
    const before = reader.parse(html.slice(0, tags[0].index)).length;
    const first = scripts[before];
    if (!first) throw new Error("The cumulative runtime tag is not followed by a legacy script");
    return Object.freeze({ slot: first.legacyLoadOrder, firstPath: first.currentPath,
      precedesWholeSlot: before === 0 || scripts[before - 1].legacyLoadOrder < first.legacyLoadOrder });
  }
}

module.exports = { CumulativeRuntimeLoadSlot };
