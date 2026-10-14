# UI component contracts

Реалізовані контракти. Існуючі public signatures не перейменовуються лише заради відповідності документу; reuse перевіряється на фактичних consumers.

## Appearance versus placement

- Компонент приймає semantic content/state, accessible names і callback/port через injection.
- Компонент володіє внутрішнім markup, typography, alignment, radius, border, color та інтерактивними станами.
- Consumer володіє mount container, grid area, порядком, зовнішніми margins, `position/inset` і координатами.
- BEM-mix поєднує host placement із appearance на одному node; state modifiers доповнюють base class.
- Внутрішній relative/absolute для власної іконки дозволений; screen-specific fixed/top/right не належить шаблону.

## Close button

Renderer отримує DOM factory, accessible label і close callback. Shared appearance — чинний `ui-modal-close`; cross центрований геометрично. Header inventory/keepnet/catalog визначає позицію. Зберегти keyboard activation, focus, дозволений desktop hover і очищення handler binding. Не копіювати текст/геометрію в кожному екрані.

`UiCloseButtonRenderer({domFactory}).create({label,onClose,className,disabled})` повертає semantic button; `dispose(button)` очищає binding. Дозволені appearance properties: `--ui-close-size`, `--ui-close-border`, `--ui-close-radius`, `--ui-close-background`, `--ui-close-color`, `--ui-close-hover-background`. House зберігає свої 36px і кольори через ці properties; close base не визначає зовнішню позицію.

## Automatic switch

Renderer отримує selected artwork/placeholder, checked/disabled, accessible name, reserve count і change callback. Checkbox/switch semantics, кругла A, active-green та count visibility лишаються чинними. Variant задає permitted content/size; auto-refill preference та stock computation лишаються в authoritative owners.

`UiAutoSwitchRenderer({domFactory}).create({id,name,modeLabel,items,placeholderUrl,checked,disabled,stock,onChange,className,variant})` повертає label із checkbox/switch. `variant='equipment'` за замовчуванням; `variant='control'` не містить artwork/stock. `update(label,{checked,disabled,stock,modeLabel})` зберігає вузли; `dispose(label)` очищає binding. Appearance owner — `styles/auto-switch.css`.

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
- `hoverEnabled`: true лише для UI і landscape viewport понад1024px, fine hover-capable pointer, без coarse pointer і з `maxTouchPoints=0`; невідомі capabilities, mobile/tablet/portrait/touch/hybrid — false. CSS використовує root `ui-surface--desktop-hover`, JS hover-підказки читають той самий snapshot; зміна політики повідомляє subscribers і закриває відкриту hover-підказку;
- conversion physical pointer/rect/delta ↔ logical UI;
- metrics subscription і deterministic unsubscribe/dispose.

Фактичні signatures: `UiSurfaceAdapter({hostElement,documentRef,windowRef,viewport})`, `getMetrics()`, `subscribe(listener)`, `requestMeasure()`, `measure()`, `physicalToLogicalPoint/Rect/Delta`, `logicalToPhysicalPoint/Delta`, `dispose()`. Native hit testing не реалізовується повторно. Camera/world input і Canvas dimensions не використовують UI port.

Нижче 320px surface freezes logicalWidth=320, масштабується один раз і компенсує logicalHeight/scroll footprint. Widgets/portals не додають другого scale. Persisted coordinates серіалізуються на чинній межі; conversion змінює UI reading/interaction, а не save schema.

## Catalog entry and preview

`ui-catalog.html` має один native module entry, production component styles та catalog-only CSS. Entry викликає development bootstrap; bootstrap створює concrete renderers/adapters/config providers. Page/preview не складають raw configurable production services.

DevTools отримує інжектований `openUiCatalog` callback. Development bootstrap складає один
`EmbeddedPageOverlay` для House/каталогу; `open({src,title,onReady})` може замінити destination
лише на час відкриття, не змінюючи default House. Каталог не отримує live House preview data.
`UiCatalogPage` отримує return link/onReturn; у same-origin embedded режимі callback надсилає
чинний `EMBEDDED_PAGE_RETURN_MESSAGE`, standalone посилання виконує звичайну навігацію.
Dispose прибирає binding, iframe та message listener; close повертає фокус до opener.

Каталог показує source/variant/state metadata й fixture controls. Джерела редагуються звичайним процесом розробки; сторінка не записує code/themes/saves. Вузька demo-card не підміняє responsive contract: container-aware layout або isolated surface повинні відображати реальний mobile state.

## Accessibility and disposal

Зберігати semantic controls/ARIA, modal focus trap, Escape, повернення фокусу, help dismissal і reduced motion. Зміна числового fixture не перебудовує весь UI. Dispose очищає listeners, capture handlers, resize subscriptions, scheduling і portals; remount не дублює handlers.
