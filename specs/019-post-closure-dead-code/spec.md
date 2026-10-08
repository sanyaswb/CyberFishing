# 019 — Cleanup після закриття Stage 7

Дата: 2026-10-08. Підстава: [аудит](../../docs/audits/2026-10-08-stage7-post-closure.md)
та доручення власника самостійно виконати знайдені задачі. Stage 7 залишається закритим.

## Межі

Прибрати підтверджені невикористані приватні поля й локальні значення, повторний snapshot
DevTools та classic fallback у native test harness. Перевірити окремо кандидати public API,
невикористаний шлях buffs і bite fallback. Живі inventory/event/overlay bridges, save migrations,
test-only contracts та ручні DEV controls зберегти. Ігровий level залишається у fish data;
видалення приватної копії не змінює рівень, вагу, physics profile або save.

Перед видаленням — перевірка imports, усіх статичних і динамічних consumers, constructor
composition, RHS side effects. Не переносити бізнес-логіку в tests і не видаляти live assertions.
CSS — окремий checkpoint [018](../018-presentation-css-restructure/spec.md).

## Приймання

- Consumer review кожного кандидата з рішенням remove/retain і причиною.
- Focused gameplay/config/inventory/DEV checks, Architecture, Quick, Full.
- Той самий stdout game-cycle: SHA256
  `7b9baea38feaa4b550e20bc2d22d5eed7875a8c7fb6f3fdf9e176ddf573ed5b6` (11 907 bytes).
- Поточна save schema/key та round-trip bytes не змінюються.
- Native browser smoke index/dev, reload, DEV tools, lifecycle.
- Factual results на одному snapshot; ніяких ослаблень architecture guard.

Статус: виконано. [Рішення і докази](results.md).
