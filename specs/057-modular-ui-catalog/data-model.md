# Data model: Модульний UI-каталог

Модель описує демонстрацію й renderer contracts, а не новий gameplay state або збереження. Конкретні signatures перевіряються перед реалізацією.

## Component definition

| Поле | Зміст |
| --- | --- |
| `id` | Стабільний унікальний ID прикладу |
| `family` | Інвентаризована FR-002 родина |
| `name`, `description` | DEV-підписи, призначення й source/style owner |
| `variants`, `states` | Лише реально підтримувані варіанти/стани |
| `examples` | Ізольовані fixtures та інжектований renderer |

Registry — DEV-дані; production-компонент не знає catalog ID. Не сканувати CSS для автоматичного створення компонентів.

## Appearance / host layout

Внутрішній контракт містить semantic appearance tokens, content slots, typography/alignment, accessibility і state. Host layout містить зовнішні width constraints, grid area, порядок, margins та координати. Host використовує дозволену size variant, а не довільно перевизначає внутрішні стилі.

## Fixture model

`exampleId`, plain read-model data, variant/state selection, isolated callbacks і supported actions. Fixture зберігає тільки демонстраційний switch state або meter value в пам’яті. Жодних live InventoryFacade, care, localStorage або real game clock.

## Meter reading

Поточний DOM meter отримує `id`, normalized `percent`, accessible `label`, optional `icon`; `remainingPercent` може задавати safety reading для occupancy. Для ресурсу safe reading — залишок, для зайнятості — `100-percent`. Колір повертає resolver; fixture не зберігає власних colors/stops.

У садку `occupied=count+reservedCount`, `percent=clamp(occupied/capacity)*100`. Fill обмежений 0..100; counter/hint показує авторитетні значення. Missing/invalid reading та нульова місткість обробляються за production contract без довільного ділення на нуль.

Canvas meter зберігає HUD read-model/style contract. Не створювати generic object, що одночасно управляє DOM і Canvas.

## UI surface metrics

`physicalWidth`, `physicalHeight`, `originX`, `originY`, `logicalWidth`, `logicalHeight`, `scale`, logical safe-area insets. Одиниці — CSS px; device pixel ratio не є layout scale.

Для додатної фізичної ширини: `logicalWidth=max(320,physicalWidth)`, `scale=min(1,physicalWidth/320)`, `logicalHeight=physicalHeight/scale`. Тимчасова нульова ширина hidden/detached surface зберігає last valid metrics і не активує interaction до валідного measurement.

Pointer conversion: `logicalX=(clientX-originX)/scale`, `logicalY=(clientY-originY)/scale`; фізична drag/scroll delta ділиться на scale один раз. DOM hit areas використовують native transformed geometry; game/world input не отримує цей conversion.

## Lifecycle

1. Bootstrap створює adapters, configs/resolvers і renderers; mount не відкриває game session.
2. Page монтує приклади у власні containers.
3. Preview змінює лише memory fixture/width; renderer оновлює наявні вузли.
4. Surface resize оновлює metrics/layout без gameplay або save changes.
5. Dispose очищає listeners, resize subscriptions/scheduling, portals і demo Canvas.
