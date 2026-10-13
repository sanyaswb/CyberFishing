# UI component contracts

Плановані контракти майбутньої реалізації. Існуючі public signatures не змінюються лише заради відповідності документу; reuse перевіряється на фактичних consumers.

## Appearance versus placement

- Компонент приймає semantic content/state, accessible names і callback/port через injection.
- Компонент володіє внутрішнім markup, typography, alignment, radius, border, color та інтерактивними станами.
- Consumer володіє mount container, grid area, порядком, зовнішніми margins, `position/inset` і координатами.
- BEM-mix поєднує host placement із appearance на одному node; state modifiers доповнюють base class.
- Внутрішній relative/absolute для власної іконки дозволений; screen-specific fixed/top/right не належить шаблону.

## Close button

Renderer отримує DOM factory, accessible label і close callback. Shared appearance — чинний `ui-modal-close`; cross центрований геометрично. Header inventory/keepnet/catalog визначає позицію. Зберегти keyboard activation, focus, hover і очищення handler binding. Не копіювати текст/геометрію в кожному екрані.

## Automatic switch

Renderer отримує selected artwork/placeholder, checked/disabled, accessible name, reserve count і change callback. Checkbox/switch semantics, кругла A, active-green та count visibility лишаються чинними. Variant задає permitted content/size; auto-refill preference та stock computation лишаються в authoritative owners.

## Resource meters and color ownership

- Повторно використовувати `InventoryResourceMeterRenderer.create/updateReading/update` і injected `DegradationColorResolver`; новий catalog meter class не потрібний.
- Scale 0..100, accessible reading/tooltip; host визначає зовнішню ширину й дозволений size variant.
- `remainingPercent` задає safety direction occupancy. Колір не задається demo CSS і не редагується preview.
- Canvas preview складається з чинних `HudBarRenderer`/HUD resolvers та окремої host surface; DOM renderer не малює Canvas.
- Catalog controls змінюють лише test readings, без gameplay commands/care timers.

## UI surface

Browser adapter надає вузький інжектований port:

- `mountRoot` і `portalRoot` у тому самому logical UI space;
- snapshot валідних physical/logical metrics, scale, origin, safe-area;
- conversion physical pointer/rect/delta ↔ logical UI;
- metrics subscription і deterministic unsubscribe/dispose.

Signatures визначаються після consumer audit; не додавати catch-all manager або global lookup. Native hit testing не реалізовується повторно. Camera/world input і Canvas dimensions не використовують UI port.

Нижче 320px surface freezes logicalWidth=320, масштабується один раз і компенсує logicalHeight/scroll footprint. Widgets/portals не додають другого scale. Persisted coordinates серіалізуються на чинній межі; conversion змінює UI reading/interaction, а не save schema.

## Catalog entry and preview

`ui-catalog.html` має один native module entry, production component styles та catalog-only CSS. Entry викликає development bootstrap; bootstrap створює concrete renderers/adapters/config providers. Page/preview не складають raw configurable production services.

Каталог показує source/variant/state metadata й fixture controls. Джерела редагуються звичайним процесом розробки; сторінка не записує code/themes/saves. Вузька demo-card не підміняє responsive contract: container-aware layout або isolated surface повинні відображати реальний mobile state.

## Accessibility and disposal

Зберігати semantic controls/ARIA, modal focus trap, Escape, повернення фокусу, help dismissal і reduced motion. Зміна числового fixture не перебудовує весь UI. Dispose очищає listeners, capture handlers, resize subscriptions, scheduling і portals; remount не дублює handlers.
