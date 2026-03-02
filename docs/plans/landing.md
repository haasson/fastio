# План: apps/landing — лендинг Fastio

Статус: 📋 Запланировано

---

## Контекст

Лендинг на `fastio.ru` — точка входа для потенциальных клиентов. Отдельное Nuxt-приложение в монорепо, минимальный контент: Hero с названием, слоганом и CTA-кнопкой «Попробовать бесплатно» → `admin.fastio.ru`.

---

## Структура файлов

```
apps/landing/
├── package.json
├── nuxt.config.ts
├── tsconfig.json
├── app.vue
├── assets/
│   └── css/
│       └── reset.css
└── pages/
    └── index.vue
```

---

## Шаги реализации

### 1. `apps/landing/package.json`
- `"name": "landing"`, `"private": true`
- Dependencies: `@fastio/ui: workspace:*`, `naive-ui`, `nuxt`, `vue`, `@vueuse/nuxt`
- DevDeps: `sass`, `typescript`, `@nuxt/eslint`

### 2. `apps/landing/nuxt.config.ts`
- `ssr: true` (SEO)
- `devServer.port: 4712`
- Модули: `@nuxt/eslint`, `@vueuse/nuxt`
- CSS: `~/assets/css/reset.css`

### 3. `apps/landing/app.vue`
- Обёртка `UiConfigProvider` с брендовым цветом `#ff6b35`
- `<NuxtPage />`

### 4. `apps/landing/pages/index.vue`
Hero-блок:
- Логотип / название **Fastio**
- Слоган (например: «Своя витрина для вашего ресторана — за 5 минут»)
- CTA-кнопка → `https://admin.fastio.ru`
- Адаптив: mobile-first, SCSS с `@include mq-m`

### 5. `apps/landing/tsconfig.json`
- Стандартный, `extends: "./.nuxt/tsconfig.json"`

### 6. Обновить корневой `package.json`
```json
"dev:landing": "turbo run dev --filter=landing"
```

### 7. `pnpm install`

---

## Деплой (после реализации)

1. Создать новый Vercel-проект, Root Directory: `apps/landing`
2. Привязать домены `fastio.ru` и `www.fastio.ru`
3. В Timeweb прописать DNS:
   - `A @ 76.76.21.21`
   - `CNAME www cname.vercel-dns.com`

---

## Референс

- `apps/admin/nuxt.config.ts` — паттерн конфига
- `apps/admin/app.vue` — UiConfigProvider обёртка
- `packages/ui/src/index.ts` — доступные компоненты
- `packages/ui/src/styles/mixins/` — SCSS-миксины
