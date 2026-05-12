# content — заметка для агента

Контент витрины: баннеры, галереи, отзывы, вакансии (shared). Полная мета — `feature.manifest.ts`.

## Что модуль делает

CRUD «контентных» сущностей, у которых жизненный цикл отдельный от витрины-конфига (он в `appearance`): баннеры можно публиковать/архивировать, галереи — переупорядочивать, отзывы — модерировать. Картинки заливаются в Supabase Storage + проходят через `shared/utils/imageOptimize`.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/banners.ts` | CRUD баннеров + смена видимости |
| `api/galleries.ts` | CRUD галерей + фотографии |
| `composables/useBanners.ts` | Realtime-список баннеров |
| `composables/useGalleries.ts` | Realtime-список галерей |
| `components/*` | Редакторы баннеров/галерей + загрузчик картинок (использует `shared/ui/components/ImageUploadModal`) |

## Типовые задачи

- **Новое поле баннера (например, CTA-кнопка):** миграция + `Banner` тип в `@fastio/shared` + `mapBanner` + поле в `api/banners` + UI.
- **Новый тип контента (например, «новости»):** свой `api/<news>.ts` + composable + UI. Не складывай это в `banners` дискриминантом — у news другой жизненный цикл.
- **Загрузка картинки:** через `useImageUpload` (в `shared/ui/composables`). Не вызывай `sb.storage.from(...).upload` напрямую — нужна валидация типа и optimize.

## Антипаттерны (не делай так)

- ❌ Заливать picture без `imageOptimize` — будет 5МБ JPEG на витрине.
- ❌ Дублировать «промо-блок» с акциями (`features/promotions`) и баннер — баннеры это статичный контент, акции = правила скидок.
- ❌ Хранить thumbnail отдельно — используй Supabase Storage с transform-URL.
- ❌ Удалять `banners`/`galleries` жёстко если на них могут быть ссылки в `tenants.sections` — soft-archive.

## Куда расти

CMS-уровень (drag-n-drop конструктор страниц) — это `features/appearance` (`/appearance/sections`), не сюда.
