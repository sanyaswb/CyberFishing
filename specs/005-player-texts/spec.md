# Feature Specification: Player-facing texts live in presentation

**Branch**: `develop` · **Created**: 2026-10-08 · **Status**: Implemented 2026-10-08 (approved by owner in chat) · **Kind**: structural, same texts

## Problem (verified)
Rule 5 of the owner's decomposition framework: player-facing text belongs to a presentation catalog that is injected.
Today ~85 player-facing strings live outside presentation: inventory command/gameplay/line/loadout services,
cast service, chum controller, game application warnings, and platform widgets (item progression tooltip labels,
"ПРОДОВЖИТИ", "УТРИМАННЯ", depth selector).

## Classification
- **Player text** → presentation catalogs injected through constructors (the existing `INVENTORY_RULE_MESSAGES`
  pattern): `INVENTORY_MESSAGES`, `FISHING_MESSAGES`, HUD/tooltip label catalogs.
- **Diagnostics** (arguments of `console.*` / injected logger calls) stay where they are (rule 5).
- **DEV-only log data** (bite results, iteration results) becomes codes; DEV printers own the labels.
- **Persisted names** (`Комплект`, imported/restored loadout names) are save format: one Domain module.

## Requirements
- **FR-001** No Cyrillic string literal in `engine`, `game/domain`, `game/application`, `platform`, `bootstrap`
  except diagnostics call arguments and the persisted-names module; enforced by the architecture guard with
  negative fixtures.
- **FR-002** Every text the player sees is byte-identical (checks that assert texts keep passing unchanged).
- **FR-003** Catalogs are composed in bootstrap and injected; Application never imports presentation.

## Acceptance
All checks; game-cycle output unchanged; browser smoke (inventory warnings, tooltip labels, HUD labels).
