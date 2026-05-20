# Bundle Analysis — Admin (PREPROD-280)

Lazy-route splitting для `apexcharts`, `tiptap`, `jspdf`, `vue-yandex-maps`.

Команда: `pnpm --filter admin run analyze` (или `nuxi analyze --no-serve`).

## Baseline (до изменений)

Top чанков в `.nuxt/dist/client/_nuxt/`:

| Чанк                                  | Size      | Gzip       |
| ------------------------------------- | --------- | ---------- |
| **`entry.js`**                        | **1540 kB** | **449.92 kB** |
| `lucide-vue-next.js`                  | 569 kB    | 144.88 kB  |
| `apexcharts.ssr.esm-*.js`             | 518 kB    | 140.35 kB  |
| `jspdf.es.min.js`                     | 386 kB    | 126.29 kB  |
| `RichTextEditor.js`                   | 366 kB    | 116.53 kB  |
| `default.js` (layout)                 | 240 kB    | 69.60 kB   |
| `html2canvas.esm.js`                  | 201 kB    | 47.63 kB   |
| `index.es.js`                         | 159 kB    | 53.23 kB   |
| `UiDataTable.js`                      | 112 kB    | 32.21 kB   |
| `UiDatepicker.js`                     | 82 kB     | 18.37 kB   |

**Initial JS (entry.js):** 1540 kB raw / **449.92 kB gzip**.

Проблемы:
- `apexcharts` тянулся в entry через глобальный плагин `plugins/apexcharts.client.ts` (`app.use(VueApexCharts)`).
- `vue-yandex-maps` инициализировался через `plugins/yandex-maps.client.ts` + глобальный CSS `vue-yandex-maps/css` в `nuxt.config.ts:css`.
- `jspdf` импортировался статически в `features/tables/utils/generateTableQrPdf.ts` + ре-экспорт через `features/tables/index.ts`.
- `RichTextEditor` тянул tiptap (~366 kB), импортировался статически из 3 мест.

## После изменений

| Чанк                                  | Size      | Gzip       | Delta vs baseline |
| ------------------------------------- | --------- | ---------- | ----------------- |
| **`entry.js`**                        | **1008 kB** | **303.33 kB** | **−532 kB raw / −146 kB gzip (−32.5 %)** |
| `lucide-vue-next.js`                  | 569 kB    | 144.88 kB  | без изменений     |
| `vue3-apexcharts.js`                  | 527 kB    | (lazy)     | новый lazy-chunk  |
| `apexcharts.ssr.esm-*.js`             | 518 kB    | 140.35 kB  | теперь lazy (через `LazyApexChart`) |
| `jspdf.es.min.js`                     | 386 kB    | 126.29 kB  | теперь lazy (через `await import('jspdf')`) |
| `RichTextEditor.js`                   | 366 kB    | 116.53 kB  | теперь lazy (через `defineAsyncComponent`) |
| `vue-yandex-maps.D8Q-IMLe.css`        | ~        | ~          | новый CSS-chunk, лазифицирован вместе с компонентом |
| `default.js` (layout)                 | 240 kB    | 69.60 kB   | без изменений     |

## Что изменилось в импорт-графе

| Библиотека          | До                                                        | После                                                                          |
| ------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apexcharts`        | глобальный плагин `plugins/apexcharts.client.ts`          | `LazyApexChart.vue` → dynamic `import('vue3-apexcharts')` только на дашборде   |
| `vue-yandex-maps`   | плагин `plugins/yandex-maps.client.ts` + глобальный CSS   | `defineAsyncComponent` для `DeliveryZoneMap` + локальный CSS в lazy-chunk      |
| `jspdf`             | статический `import { jsPDF }` + re-export из barrel      | `import type` + `await import('jspdf')` внутри `generateTableQrPdf` handler'а  |
| `tiptap` (`RichTextEditor`) | статический `import RichTextEditor` в 3 местах   | `defineAsyncComponent(() => import('~/shared/ui/components/RichTextEditor.vue'))` |

## Проверка отсутствия в main bundle

`grep` по `entry.js` (новый):

| Библиотека          | Совпадений в entry.js | Статус |
| ------------------- | --------------------- | ------ |
| `ApexCharts`/`apexcharts` | 0               | OK    |
| `tiptap`/`ProseMirror`    | 0               | OK    |
| `jsPDF`/`jspdf`           | 0               | OK    |
| `YandexMap`               | 0               | OK (только строка `yandex-maps` в `__vite__mapDeps` — это ссылка на lazy-chunk CSS) |

Все 4 целевые библиотеки полностью вынесены из main bundle.

## Удалённые/изменённые точки входа

- **Удалён `apps/admin/plugins/apexcharts.client.ts`** — глобальный `app.use(VueApexCharts)` больше не нужен, `LazyApexChart.vue` сам подтягивает компонент через `shallowRef + onMounted`.
- **Удалён `apps/admin/plugins/yandex-maps.client.ts`** — `createYmapsOptions({apikey})` перенесён в `features/settings/components/DeliveryZoneMap.vue` (вызывается на module-side-effect при первой загрузке lazy-chunk; idempotent).
- **`apps/admin/nuxt.config.ts`** — убран `'vue-yandex-maps/css'` из массива `css`. CSS теперь импортируется внутри `DeliveryZoneMap.vue` (попадает в lazy-chunk).
- **`apps/admin/features/tables/index.ts`** — убран `export * from './utils/generateTableQrPdf'` из barrel. `TableQrModal.vue` импортирует напрямую через `'../utils/generateTableQrPdf'`.
- **`apps/admin/package.json`** — добавлен скрипт `"analyze": "nuxi analyze --no-serve"`.

## Драйвер.js — не трогали

`driver.js` уже подключён через dynamic `import()` в `useTour.ts` (см. shared composable). CSS `driver.js/dist/driver.css` всё ещё в `nuxt.config.ts:css` — отдельно лениться не критично (CSS мал, помогает избегать FOUC при первом запуске тура).
