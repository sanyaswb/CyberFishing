# Spec 170: 2D-резерв сцени без зайвого

**Створено**: 2026-11-08 · **Статус**: реалізовано v0.50.51 (2026-11-09), власник «По 170 відразу так»; приймання власником відкрите · **Задача**: `tasks.md`, «Spec 170» · **Джерело**: аудит
[TK-255](../../docs/audits/2026-11-08-prod-readiness.md) P2-6, Q2; закриває [spec 103](../103-webgl-scene-layer/spec.md).

## Рішення власника (2026-11-08)

> «Canvas 2d резерв залишаємо можна провести cleanup якщо потрібно щоб не було нічого лишнього для просто резерву.»

2D-шлях лишається запасним; усе, що існує лише для етапів міграції spec 103 або для DEV-порівняння, прибирається.

## Що таке резерв зараз (за кодом, v0.50.48)

- Production читає `CONFIG.canvas.scene = "webgl"`. `SceneLayerRouter` віддає вид (`SCENE_KINDS`) сцені лише поки WebGL
  активний; при недоступному WebGL, збої ініціалізації Pixi (до TK-256 — сувора CSP) або втраті контексту ці самі види
  малює 2D-canvas. **Це і є резерв**: 2D-рендерери фону, води, поплавця, лінії, вудки, кораблика, зон бою.
- Spine у резерві: вудка й кораблик обирають шлях за **налаштованим режимом** (`scene.webgl` у
  `rod_animation_composition.js`, `boat_animation_composition.js`), а не за тим, чи працює WebGL. У режимі `"webgl"` без
  WebGL імпорт Pixi відмовляє → `probeSpine` = false → статична картинка (TK-181). Тобто в справжньому резерві Spine вже
  малюється статичною позою.
- Шлях `spine-webgl` (власний GL-контекст `SpineGlSurface`, копія GL → 2D у `RodSpineRenderer`, `spine_runtime_module.js`,
  `vendor/spine-webgl/4.3.13/spine-webgl.js` 250 KB, devDependency `@esotericsoftware/spine-webgl`) вмикається **лише** при
  `CONFIG.canvas.scene = "canvas"`, тобто в DEV `dev.html?scene=canvas`. Без WebGL він не працює так само, як Pixi, тож
  для резерву він нічого не дає — це залишок етапів 0–4 spec 103 (D5).

## Рішення (агент, за дозволом власника)

- **R1. Прибрати шлях `spine-webgl`:** `spine_runtime_module.js`, `SpineGlSurface`, гілки `onScene === false` у композиціях
  вудки й кораблика, `RodSpineRenderer`-копію GL → 2D, vendor-файл і його запис у маніфесті, devDependency, частину
  `utils/vendor-libraries.js` для нього. `SpineScene`, `SpineRuntimeProvider` (над Pixi), `SceneSkeletalSurface` лишаються.
- **R2. Spine вирішує за станом сцени, а не за режимом:** без активної WebGL-сцени вудка й кораблик — статична поза
  (як зараз у справжньому резерві); з'явилась сцена — Spine. Один шлях замість двох.
- **R3. `?scene=canvas` лишається в DEV** як примусовий резерв для перевірки (той самий шлях, що й при відмові WebGL), і
  кнопка DevTools «втрата контексту». Перемикач режиму «наживо без перезавантаження» прибирається, якщо після R1–R2 він
  не потрібен для жодного з цих двох тестів (спершу перевірити споживачів).
- **R4. Резерв перевіряється, а не лише існує:** перевірка `scene-layer` / `spine-rod` / `bait-boat-spine-animation`
  проганяє вид без WebGL: кожен `SCENE_KINDS` малює 2D, вудка й кораблик — статична поза, без імпорту `spine-webgl`.
- **R5. Утиліти (DEVELOPMENT_RULES «Utils cleanup step»):** прибрати все, що стало непотрібним (vendor-скрипт,
  фікстури `spine-webgl` у перевірках), записати в «Реалізації».
- **R6. Закрити spec 103:** рядок статусу (етапи 3–4 прийняті фактом роботи на Pages від 2026-10-18, етап 5 = ця spec),
  `docs/rendering.md` — розділ ролей (2D-шлях = резерв, не порівняння).

## Що не змінюється

Production-поведінка з WebGL (той самий Pixi-шлях), game-cycle, сейви. Production-бандл старту не змінюється (обидва
Spine-рантайми ліниві); зменшуються Pages-реліз, `vendor/`, devDependencies, графи модулів.

## Перевірки

Фокусні (`scene-layer`, `spine-rod`, `bait-boat-spine-animation`, `asset-preloader`, `pages-release`, `architecture`),
кожна нова — падає на старому коді; Full; game-cycle без змін; `measure:startup` до/після (очікування: без змін).

## Приймання власником

`dev.html?scene=canvas` і DevTools «🖼️ СЦЕНА WebGL» → «втрата контексту»: гра йде на 2D, вудка й кораблик — статичні
картинки, повернення контексту → знову Spine; телефон, обидві орієнтації, «⚡ ПРОДУКТИВНІСТЬ». Pages `index.html` — як
раніше.

## Реалізація (v0.50.51)

- R1: видалено `spine_runtime_module.js`, `SpineGlSurface`, `RodSpineRenderer` (2D-копія GL-полотна) і його компонент
  `rod-spine`, `vendor/spine-webgl/4.3.13/` (250 KB) із записом маніфесту й частиною `utils/vendor-libraries.js`,
  devDependency `@esotericsoftware/spine-webgl`, секцію профайлера `rod-spine`, лічильник `gl-pixels` і рядок оверлея
  «Spine GL поверхня». `SpineScene` — лише y-down Pixi-шлях (без GL-малювання `render()`, `restoreContext`, підписки на
  контекст); контракт `SKELETAL_SCENE_METHODS` без `render`/`restoreContext`; `SceneSkeletalSurface` без `canvas` і
  `onContextChange`; `SpineRuntimeProvider` без runtime за замовчуванням.
- R2: `composeRodAnimation` / `composeBoatAnimation` — один шлях: `sceneReady(scene)` → рантайм сцени, інакше `probeSpine`
  = false і статична картинка; сторінки експорту завжди `low` → повні.
- R3: `?scene=canvas` і кнопки втрати/відновлення контексту лишились; перемикач режиму наживо теж (кілька рядків DEV, вмикає
  той самий резерв).
- R4: `scene-layer` — резерв без сцени, у режимі `canvas` і з несформованою сценою: `probeSpine` = false без імпорту Spine;
  готова сцена — Spine з її рантайму. `spine-rod` і `bait-boat-spine-animation` — на spine-core з бандла сцени (ті самі
  числа кінчика лінії й меж); `asset-preloader` — рантайм сцени; `render-resolution` — у 2D немає компонента Spine.
- R5: утиліти — прибрано частину `vendor-libraries.js`; інших інструментів лише для spine-webgl не було.
- R6: spec 103 закрита; `docs/rendering.md` (резерв), `docs/architecture.md`.
- Production: 684 → 680 модулів.
