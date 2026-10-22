# Implementation plan

- Shared `DevToolsUI.createSwitcherRow` accepts explicitly declared prerequisites and checks live conditions before calling the existing command callback. Rejected attempts restore the checkbox's current bound value.
- Existing control bindings expose their row elements by canonical path; no second registry of parameter values.
- A DEV feedback class owns highlighting, disclosure reveal and one cancellable timer. Bootstrap injects it and the existing browser timeout adapter into DevToolsUI. No production dependency on DEV and no new polling.
- ZoneEditorSection declares the editor prerequisite for editable zones and depth-number visibility. Existing choices remain in ZoneEditorState; feedback does not change it.
- Extend existing zone-editor behavioral scenarios with a controlled clock: reject/no-write, success, early clearing, restart, collapse reveal and lifecycle. Full once; known unrelated pages-release PNG failure recorded separately.
