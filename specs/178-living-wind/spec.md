# Spec 178 — Живий вітер світу (безперервна сила `0…1`, пориви, хвилі, дощ, поплавок, DevTools)

Статус: **прийнято власником (2026-11-13)** — рішення `Q1–Q5` затверджено; розбито на етапи реалізації `A` (`WindModel` + конфіг + `apply:weather`), `B` (`SeaStateResolver` + дощ + поплавок з `%` відкату), `C` (селектор мапи, секція шансів, ручна сила вітру в DevTools і посилання оверлею).
Правила: [AGENTS.md](../../AGENTS.md), [DEVELOPMENT_RULES.md](../../DEVELOPMENT_RULES.md) («Gameplay changes», «Loading and startup optimization», «Utils cleanup»), [docs/rendering.md](../../docs/rendering.md), [DESIGN_RULES.md](../../DESIGN_RULES.md), [docs/incidents.md](../../docs/incidents.md) (`R20`).

---

## 1. Запит власника та затверджені рішення (`Q1–Q5`)

Запит власника (2026-11-13):
> «Зробити живу змінну силу вітру (`0…1`) для всього світу: додати безперервну силу вітру (слабкий/середній/сильний + плавні зміни й пориви, залежність від грози/дощу, ручне керування силою вітру в `ПОГОДА → Керування`), щоб вона реально змінювала і хвилі (`SeaStateResolver`), і нахил дощу/поплавка, а посилання `Сила вітру 0…1` вело саме на її параметр.»

Затверджені рішення власника (`2026-11-13`):
1. **`Q1` (Потік RNG):** виділити вітру окремий іменований потік `windRng = new SeededRng("${seed}:wind")` у `bootstrap` (`game_composition_root.js`). Послідовність опадів/туману (`weatherRng`) та кльову/риби (`game-cycle`) не змінюються.
2. **`Q2` (Конфіг по локаціях + селектор мапи + секція шансів у `ПОГОДА`):**
   - Блок `wind` додається в `src/game/config/raw/locations/weather/<id>.js` (`MAP_DB.<id>.weather.wind`), валідується в `weather_export_format.js` та переноситься в код через `npm run apply:weather`.
   - У DevTools `ПОГОДА` додається **селектор вибору конкретної мапи** (будь-яка локація з `CONFIG.locations.map`) і **окрема секція шансів погоди** (ваги опадів, туману й режимів вітру), елементи якої напряму синхронізовані з `CONFIG.locations.map.<обрана>.weather` (одне джерело істини без дублювання стану) — щоб зручно налаштовувати різні профілі локацій (дощові, туманні, штормові).
3. **`Q3` (Шкала часу):** усі тривалості, плавні переходи та пориви вітру рахуються в **реальних секундах** (як дощ, гроза і туман у Spec 172 `Q2`).
4. **`Q4` (Просте правило «сила ⇔ напрямок»):**
   - Поки сила вітру дорівнює `0` — напрямку немає (`direction = 0`).
   - Коли вітер з’являється (`strength` піднімається вище `0` з нуля — автоматично, від дощу/грози чи через ручний повзунок за `напрям = авто`), випадково (через `windRng`) обирається напрям `-1` (вліво) або `+1` (вправо).
   - Коли вітер зникає (`strength` плавно доходить до `0`), напрям зникає назад у `0`.
   - Ручне примушення в `ПОГОДА → Керування`: вибір `немає (0)` прибирає вітер (`strength → 0` / `0`); вибір `← вліво` / `вправо →` фіксує напрям (і при `strength === 0` без заблокованої ручної сили дає легкий вітер/використовує ручний рівень).
5. **`Q5` (Вудка, глобальні пориви й динаміка поплавка):**
   - **Вудка (Spine):** у цій спеці не чіпаємо — її підлаштуємо окремо під напрям вітру пізніше.
   - **Глобальні пориви (`WindModel`):** живі плавні хвилі посилень/ослаблень (`gust`) працюють на рівні світового вітру `wind.strength` (`0…1`), тому під них автоматично підлаштовуються **дощ, хвилі і поплавок**.
   - **Окремий параметр поплавка (`float`):** нахил поплавка залежить від живої світової сили вітру, але при сильному вітрі поплавок не завмирає статично нахиленим, а має власний **діапазон `%` руху повернення з різною амплітудою і частотою** — тобто постійно «відіграє» назад у межах налаштованого відсотка й знову притискається вітром, створюючи живий нестатичний рух.

---

## 2. Архітектура та межі шарів

- **Domain (`src/game/domain/weather/wind_model.js`):** чистий клас **`WindModel`** (без DOM/Canvas/Pixi/глобалів), інжектується з `windRng` і `getSettings`. Оновлюється в реальних секундах і перезаписує єдиний об’єкт `#snapshot` без алокацій у кадрі.
- **Application (`src/game/application/world/environment_system.js`):** приймає `wind` (`WindModel`), викликає `wind.update(dtMs, { rain, storm })`, віддає об’єднаний `#snapshot.wind` та масштабований `#physicsWind` у `getPhysicsEnv()`.
- **Physics (`src/game/domain/tackle/water_entity.js`):** читає `environment.wind` (`direction`, `strength`, параметри `float`) без власного незалежного макро-таймера поривів.
- **Presentation / Render:**
  - `SeaStateResolver` ([sea_state_resolver.js](../../src/game/presentation/world/sea_state_resolver.js)): плавна інтерполяція `amplitudeScale` і `speedScale` від неперервної `wind.strength` (`0…1`) замість бінарного `|direction|`.
  - `WeatherRenderModelBuilder` ([weather_render_model_builder.js](../../src/game/presentation/rendering/weather_render_model_builder.js)) → `PixiRainRenderer` ([pixi_rain_renderer.js](../../src/platform/browser/scene/pixi_rain_renderer.js)): передає `windStrength` (`0…1`) у `world.weather`; кут нахилу крапель `targetSlant = windDirection * (windStrength * windSlantDeg + storm * stormSlantDeg)`. Нуль нових draw call'ів, фільтрів чи алокацій.
  - `WeatherStatusReader` + `WeatherOverlayModule`: передають живу `windStrength`, фазу вітру та ведуть посилання `Сила вітру 0…1` прямо на `WEATHER.controls.windStrength`.
- **DEV (`src/dev/tools/weather_dev_section.js`, `src/dev/weather/weather_export_format.js`):** селектор мапи, секція шансів, ручне керування силою вітру, кнопка пориву, валідація/експорт/імпорт та `apply:weather`.

---

## 3. Детальна математика моделі

### 3.1. `WindModel` (`src/game/domain/weather/wind_model.js`)

1. **Макро-режими (`calm`, `light`, `moderate`, `strong`):**
   - Кожен режим у `settings.states` має `{ weight, durationSec: [min, max], strength: [min, max] }`.
   - Після завершення таймера `episodeLeftSec` (у реальних секундах) зважено обирається наступний режим та випадкова ціль `baseTarget ∈ strength`.
   - `baseStrength` плавно рухається до `baseTarget` (обмежена швидкість зміни з `fadeSec`, напр. `step = dtSec / fadeSec`), тому старт і затихання вітру завжди плавні.

2. **Вплив дощу й грози (`rain`, `storm ∈ 0…1`):**
   - `weatherBoost`:
     - `rainFloor = rain > 0 ? rain * rainMinStrength : 0`
     - `stormFloor = storm > 0 ? storm * stormMinStrength : 0`
     - `rainAdd = rain * rainBonus`
     - `baseWithWeather = clamp01(Math.max(baseStrength, rainFloor, stormFloor) + rainAdd)` (при примусово зафіксованому `forcedDirection === 0` та без ручної сили вітер лишається `0`).

3. **Глобальні пориви (`gust`):**
   - Поки `baseWithWeather > 0 || storm > 0` (і сила не заморожена вручну): із ймовірністю на секунду `chance = gust.chancePerSec * (1 + rain * gust.rainChanceMult + storm * gust.stormChanceMult) * (0.4 + 0.6 * baseWithWeather)` запускається глобальний порив.
   - Кожен порив має випадкову тривалість `duration ∈ gust.durationSec` та амплітуду `delta ∈ gust.deltaRange` (різна сила й різна тривалість).
   - Профіль пориву гладкий: швидке наростання на ділянці `u < attackShare` (`sin((u / attackShare) * π/2)`), далі плавний спад на `[attackShare, 1]` (`cos(((u - attackShare) / (1 - attackShare)) * π/2)`).
   - Підсумкова жива сила:
     - В авто-режимі: `strength = clamp01(baseWithWeather + gustCurrent)`.
     - При ручній фіксації сили (`forcedStrength !== null`): `baseStrength` / `strength` тримає задане значення (`0…1`), а глобальний порив (якщо запущено вручну кнопкою **`🌬 Порив вітру зараз`** або якщо дозволено) плавно додається зверху в `0…1`.

4. **Просте правило напрямку (`Q4`):**
   - `WIND_EPS = 1e-4`.
   - Якщо `forcedDirection !== null`: `direction = forcedDirection` (якщо `forcedDirection === 0`, глобальний вітер гаситься до `0`; якщо `forcedDirection === ±1` без ручної сили, авто-епізоди не заходять у `calm`, тримаючи мінімальний вітер не нижче `light.strength[0]`).
   - Інакше (`auto`):
     - Якщо `strength <= WIND_EPS`: `strength = 0`, `direction = 0`.
     - Якщо `strength > WIND_EPS` і попередній `direction === 0`: `direction = windRng.chance(0.5) ? 1 : -1`.
     - Поки `strength > WIND_EPS`, поточний ненульовий `direction` зберігається до повного затихання в `0`, після чого скидається в `0`.
   - Ручне виставлення `setStrengthOverride(0)` скидає напрям у `0` (`strength === 0 ⇔ direction === 0`).

5. **Знімок `WindModel.snapshot` (reused object):**
   `{ direction, strength, baseStrength, gustStrength, targetStrength, state, episode, episodeLeftSec, isGusting, forcedDirection, forcedStrength, float }`.

---

### 3.2. Поплавок: нахил від вітру + `%` руху повернення (`WaterEntity`)

У конфізі вітру (`MAP_DB.<id>.weather.wind.float`):
```js
float: {
  maxAngleDeg: 38,            // максимальний базовий кут нахилу поплавка при strength = 1 (до компенсації якості поплавка)
  returnPctRange: [0.15, 0.45], // % відхилення назад від поточного нахилу на кожному циклі коливання
  cycleDurationSec: [0.45, 1.35], // тривалість одного циклу відкату/натиску (різна частота)
  amplitudeJitter: [0.75, 1.15],  // варіація амплітуди між сусідніми коливаннями
}
```
Як працює у `WaterEntity` ([water_entity.js](../../src/game/domain/tackle/water_entity.js)):
- Якщо `environment.wind.strength > 0` та `environment.wind.direction !== 0` (і не клює активно):
  - Середній вітровий кут: `baseAngle = environment.wind.direction * maxAngleDeg * strength * (1 - windComp)`.
  - Кожен короткий цикл `cycleDurationSec` (у мс/с за `dt`) ролить:
    - частку повернення `returnShare ∈ returnPctRange` (напр. `0.32` = на цьому поривчику поплавок відходить назад на 32% до `1 - 0.32 = 0.68` від `baseAngle`),
    - множник амплітуди `amp ∈ amplitudeJitter`,
    - тривалість циклу `cycleDurationSec`.
  - Внутрішня ціль нахилу плавно переходить між `baseAngle * amp` (натиск) і `baseAngle * (1 - returnShare)` (відігравання назад) із плавною кривою, а не стоїть мертво на одному куті!
  - Для повної сумісності в `EnvironmentSystem.getPhysicsEnv()` передаємо вже обчислений `wind = { direction, strength, rainMult, float: ... }` і тримаємо сумісність з тестами, які конструюють `environment` напряму без `WindModel` (fallback на `breezeAngleRange`/`gustAngleRange`, якщо `wind.float` не задано).

---

### 3.3. Конфігурація `MAP_DB.<id>.weather.wind` (`weather/test.js`)

Додається в `src/game/config/raw/locations/weather/test.js` (і валідується в `weather_export_format.js`):
```js
"wind": {
  "fadeSec": 14,
  "float": {
    "amplitudeJitter": [0.8, 1.15],
    "cycleDurationSec": [0.45, 1.35],
    "maxAngleDeg": 38,
    "returnPctRange": [0.15, 0.45]
  },
  "gust": {
    "attackShare": 0.25,
    "chancePerSec": 0.14,
    "deltaRange": [0.12, 0.3],
    "durationSec": [1.5, 4.5],
    "rainChanceMult": 1.5,
    "stormChanceMult": 2.5
  },
  "states": {
    "calm":     { "durationSec": [90, 300], "strength": [0, 0],       "weight": 0.2 },
    "light":    { "durationSec": [60, 240], "strength": [0.15, 0.35], "weight": 0.4 },
    "moderate": { "durationSec": [60, 200], "strength": [0.4, 0.65],  "weight": 0.28 },
    "strong":   { "durationSec": [45, 150], "strength": [0.7, 0.9],   "weight": 0.12 }
  },
  "weatherBoost": {
    "rainBonus": 0.2,
    "rainMinStrength": 0.25,
    "stormMinStrength": 0.7
  }
}
```
- Залишковий невикористаний `CONFIG.wind` у `game_config.js` перевірити через grep (чи хтось читає у коді/тестах) та видалити, якщо не використовується (разом із відповідною схемою, якщо була).
- `environment.wind.rainMultiplier` у `location_database.js` перевірити щодо `RadioReceiverService` (радіошум у дощ). Якщо `breezeAngleRange` / `gustAngleRange` ще використовуються тестами як fallback — зберегти або оновити відповідні тести прозоро.

---

## 4. DevTools `ПОГОДА` та Оверлей «ПОГОДА Й ХВИЛІ»

### 4.1. Селектор мапи та секція «Шанси погоди» (`WeatherDevSection`)
- **Вгорі `ПОГОДА`:**
  - Випадаючий список **`Локація`** (`createSelectRow` по всіх ключах `CONFIG.locations.map`, за замовчуванням — активна локація `weather.locationId`).
  - Якщо обрана локація != поточній локації гри, біля селектора або в підписі вказується, що живу погоду зараз крутить активна локація (`test`), але секції нижче (`Шанси погоди`, `Параметри локації`, `Збереження`) редагують та експортують саме **обрану мапу** `<selectedId>` (`weather-<selectedId>-...json` → `npm run apply:weather`).
- **Окрема секція `Шанси погоди (локація)` (`["WEATHER", "chances"]`):**
  - Містить швидкі числові поля (`createInputRow`, `"number"`) для обраної локації `<selectedId>`, напряму прив’язані (`bindingPath`) до відповідних шляхів у `CONFIG.locations.map.<selectedId>.weather`:
    - `Ясно (вага)` → `precipitation.clear.weight`
    - `Дощ (вага)` → `precipitation.rain.weight`
    - `Гроза (вага)` → `precipitation.storm.weight`
    - `Туман (шанс 0…1)` → `fog.chance`
    - `Штиль (вага)` → `wind.states.calm.weight`
    - `Слабкий вітер (вага)` → `wind.states.light.weight`
    - `Середній вітер (вага)` → `wind.states.moderate.weight`
    - `Сильний вітер (вага)` → `wind.states.strong.weight`
  - Оскільки прив’язка використовує той самий `updateConfig` і `bindingPath` `["CONFIG", "locations", "map", selectedId, "weather", ...]`, зміна в `Шанси погоди` автоматично оновлює `Параметри локації`, статус `Стан погоди` («Змінено (ще не в коді)») та файл експорту, і навпаки.

### 4.2. Живе керування вітром (`Керування`) і гіперпосилання оверлею (`R20`)
- У `ПОГОДА → Керування`:
  - `напрям вітру` (`авто`, `← вліво`, `немає`, `вправо →`) → `["WEATHER", "controls", "windDirection"]`;
  - **`💨 Ручна сила вітру`** (перемикач авто/вручну) → `["WEATHER", "controls", "windStrengthHold"]`;
  - **`сила вітру, %`** (повзунок `0…100%`) → **`["WEATHER", "controls", "windStrength"]`**;
  - **`🌬 Порив вітру зараз`** (кнопка миттєвого тестового пориву) → `["WEATHER", "controls", "gust"]`.
- В оверлеї `WeatherOverlayModule`:
  - `Вітер` показує напрям + стан (`слабкий / середній / сильний / штиль`, `(порив)`, `(вручну)`) → `WEATHER.controls.windDirection`;
  - `Сила вітру 0…1` показує живе `reading.windStrength` (`0.00…1.00`) → **`WEATHER.controls.windStrength`**.

---

## 5. Етапи реалізації та перевірки

- **Етап A (`WindModel`, конфіг локації, `EnvironmentSystem`, `windRng`, `apply:weather`):**
  - `WindModel`, `windRng` у `game_composition_root.js`, оновлення `EnvironmentSystem`, `MAP_DB.test.weather.wind`, валідація у `weather_export_format.js`, перевірка незмінності `game-cycle`.
- **Етап B (Інтеграція у світ: хвилі, дощ, поплавок, чистка `CONFIG.wind`):**
  - `SeaStateResolver` (неперервна `windStrength`), `WeatherRenderModelBuilder` + `PixiRainRenderer` (нахил дощу від `windStrength`), `WaterEntity` (`floatSwing` із `%`-поверненням різної амплітуди й частоти), видалення мертвого `CONFIG.wind`.
- **Етап C (`WeatherDevSection` — селектор мапи, секція шансів, ручна сила, `WeatherOverlayModule` посилання):**
  - Оновлення `WeatherDevSection`, `dev_tools.js`, `WeatherStatusReader`, `WeatherOverlayModule` (`WEATHER.controls.windStrength`), регресійні перевірки UI/DevTools і `R20`.

### Перевірки
- Автоматичні (`weather-check.js`, `apply-weather-check.js`, `config-schema`, `float-pose-check.js`, `devtools-controls`, `node utils/run-checks.js`, `npm run measure:startup`, `game-cycle`).
- Візуальна перевірка власника у `dev.html` (оверлей + DevTools + поплавок/дощ/хвилі) та вимірювання «⚡ ПРОДУКТИВНІСТЬ» на телефоні в обох орієнтаціях.

---

## 6. Що реалізовано

- **`v0.50.111` (TK-298, етапи A–C):**
  - Створено `WindModel` ([wind_model.js](../../src/game/domain/weather/wind_model.js)) з виділеним потоком `windRng = new SeededRng("${seed}:wind")` у [game_composition_root.js](../../src/bootstrap/production/game_composition_root.js), інтегровано в [environment_system.js](../../src/game/application/world/environment_system.js); додано блок `wind` у [test.js](../../src/game/config/raw/locations/weather/test.js) та валідацію/експорт у [weather_export_format.js](../../src/dev/weather/weather_export_format.js).
  - Підключено неперервну `wind.strength` до [sea_state_resolver.js](../../src/game/presentation/world/sea_state_resolver.js), [weather_render_model_builder.js](../../src/game/presentation/rendering/weather_render_model_builder.js), [pixi_rain_renderer.js](../../src/platform/browser/scene/pixi_rain_renderer.js) та [water_entity.js](../../src/game/domain/tackle/water_entity.js); видалено невикористаний `CONFIG.wind` із [game_config.js](../../src/game/config/runtime/game_config.js).
  - Оновлено [weather_dev_section.js](../../src/dev/tools/weather_dev_section.js), [dev_tools.js](../../src/dev/tools/dev_tools.js), [weather_status_reader.js](../../src/game/presentation/world/weather_status_reader.js) та [weather_overlay_module.js](../../src/dev/overlay/modules/weather_overlay_module.js) (`WEATHER.controls.windStrength`).
- **`v0.50.112` (TK-298.1, виправлення за рев'ю):**
  - `WindModel`: відокремлено `#episodeTarget` від `#forcedStrength` (вимкнення ручної сили одразу повертає ціль поточного епізоду); при примусовому напрямі `±1` виключено перехід у `calm` і додано нижній поріг сили `light`, а `setStrengthOverride(0)` скидає напрям у `0`; у `snapshot` публікується живий `float`.
  - `WaterEntity`: зроблено $C^1$-неперервний перехід коливань поплавка між циклами (`_swingStartFactor → _swingAmp → _swingFloorFactor`) без стрибків на межі циклів, обмежено кут значенням `maxAngleDeg * (1 - windComp)` і виправлено обробку `maxAngleDeg: 0`.
  - `EnvironmentSystem`: `getPhysicsEnv()` читає живий `windSnap.float` і не перераховує legacy-діапазони, коли активна `WindModel`.
  - `WeatherDevSection`: селектор «Локація» відображається завжди (навіть з однією локацією) та показує підказку, якщо обрана неактивна локація.
