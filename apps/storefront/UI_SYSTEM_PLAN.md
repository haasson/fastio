# Storefront UI System — Plan

> **Stack:** Reka UI v2.9.1, SCSS, Vue 3, Nuxt 3 (SSR), VueUse
> **Prefix:** `Sf` (StoreFront) — все UI компоненты системы
> **Принципы:** Mobile-first, tenant theme variables only, auto-responsive (CSS-only адаптив без JS), scoped styles, short class names + `-root` suffix

---

## Tenant Theme Variables

Все цвета — ТОЛЬКО через эти переменные (вычисляются `useTheme` из `paletteToCssVars`):

```css
--primary          /* основной бренд-цвет */
--on-primary       /* цвет текста на primary (WCAG auto) */
--color-bg         /* фон страницы */
--color-surface    /* фон карточек/поверхностей */
--color-text       /* основной текст */
--color-text-secondary  /* вторичный текст */
--color-text-muted      /* третичный/hint */
--color-border     /* границы */
```

Дополнительные derived переменные (задаём в `sf-tokens.scss` через `color-mix`):
```css
--primary-hover        /* color-mix(in srgb, var(--primary) 85%, #000) */
--primary-subtle       /* color-mix(in srgb, var(--primary) 12%, transparent) */
--primary-subtle-hover /* color-mix(in srgb, var(--primary) 20%, transparent) */
--surface-hover        /* color-mix(in srgb, var(--color-surface) 85%, var(--color-text)) */
```

Radius и shadow — из tenant theme объекта, пробрасываются в CSS vars:
```css
--radius-btn    /* buttonRadius: pill=9999px, rounded=8px, square=4px */
--radius-card   /* cardRadius из tenant (число в px) */
--shadow-card   /* cardShadow: none/subtle/medium */
```

---

## Breakpoints

Совместимы с `packages/styles/mixins/media-queries.scss`. Добавляем `sm`:

| Token | Value | Описание |
|-------|-------|----------|
| (default) | 0+ | Mobile portrait — базовые стили |
| `sm` | 480px | Mobile landscape / large phones |
| `md` | 800px | Tablet (= mq-m в packages/styles) |
| `lg` | 1280px | Desktop (= mq-l) |
| `xl` | 1536px | Wide desktop (= mq-xl) |

SCSS-миксины в `assets/styles/_mixins.scss`:
```scss
@mixin sm { @media (min-width: 480px) { @content; } }
@mixin md { @media (min-width: 800px) { @content; } }
@mixin lg { @media (min-width: 1280px) { @content; } }
@mixin xl { @media (min-width: 1536px) { @content; } }
```

---

## Структура файлов

```
apps/storefront/
├── assets/
│   └── styles/
│       ├── main.scss          # точка входа: import всех частей
│       ├── _tokens.scss       # derived CSS vars, tenant radius/shadow vars
│       ├── _mixins.scss       # breakpoint mixins
│       ├── _reset.scss        # минимальный reset
│       └── _typography.scss   # base html typography (body, h1-h6 defaults)
├── components/
│   └── sf/
│       ├── layout/
│       │   ├── SfContainer.vue    # max-width wrapper + padding
│       │   └── SfSection.vue      # секция с top/bottom padding
│       ├── typography/
│       │   ├── SfHeading.vue      # h1-h6 с авто-размерами
│       │   └── SfText.vue         # body/caption/label/overline
│       ├── base/
│       │   ├── SfButton.vue       # primary/secondary/ghost/outline/destructive
│       │   ├── SfIconButton.vue   # квадратная кнопка с иконкой
│       │   ├── SfBadge.vue        # статусный бейдж (colored dot + label)
│       │   ├── SfTag.vue          # тэг/чип (кликабельный или нет)
│       │   ├── SfDivider.vue      # горизонтальный/вертикальный разделитель
│       │   ├── SfSkeleton.vue     # skeleton loader (line/circle/rect)
│       │   └── SfSpinner.vue      # loading spinner
│       ├── form/
│       │   ├── SfLabel.vue        # label + required indicator
│       │   ├── SfInput.vue        # text/email/tel/number input (Reka primitive)
│       │   ├── SfTextarea.vue     # textarea
│       │   ├── SfSelect.vue       # Reka SelectRoot (dropdown)
│       │   ├── SfCheckbox.vue     # Reka Checkbox
│       │   ├── SfRadioGroup.vue   # Reka RadioGroup
│       │   ├── SfSwitch.vue       # Reka Switch (toggle)
│       │   └── SfField.vue        # wrapper: label + input slot + error/hint
│       ├── overlay/
│       │   ├── SfDialog.vue       # Reka Dialog (modal)
│       │   ├── SfDrawer.vue       # Reka Dialog с анимацией снизу/сбоку
│       │   ├── SfToast.vue        # Reka Toast (уведомления)
│       │   ├── SfToastProvider.vue# провайдер тостов
│       │   └── SfTooltip.vue      # Reka Tooltip
│       ├── nav/
│       │   ├── SfTabs.vue         # Reka Tabs (+ SfTabsList, SfTabsTrigger, SfTabsContent)
│       │   └── SfScrollNav.vue    # горизонтальный скролл-навигатор (категории)
│       └── domain/
│           ├── SfDishCard.vue     # карточка блюда (image+name+price+add button)
│           ├── SfDishCardCompact.vue # компактный вариант для списка
│           ├── SfPriceTag.vue     # цена (основная + старая зачёркнутая)
│           ├── SfStepper.vue      # инкремент/декремент counter (+-N)
│           ├── SfCartFab.vue      # floating кнопка корзины с badge
│           ├── SfOrderStatus.vue  # статус заказа (badge + label)
│           └── SfEmptyState.vue   # пустое состояние (icon + title + action)
├── composables/
│   ├── useTheme.ts     # уже существует — tenant CSS vars
│   └── useToast.ts     # composable для показа уведомлений
```

---

## Компоненты: детали реализации

### Typography scale (авто-адаптив через CSS)

`SfHeading` — только проп `as` (тег h1-h6). Размер определяется тегом автоматически через element selectors в scoped CSS:

| Tag | Mobile | Desktop (lg+) |
|-----|--------|---------------|
| `h1` | 32px / 700 | 48px / 700 |
| `h2` | 26px / 700 | 36px / 700 |
| `h3` | 22px / 600 | 28px / 600 |
| `h4` | 18px / 600 | 22px / 600 |
| `h5`, `h6` | 16px / 600 | 18px / 600 |

Реализация: element selectors в scoped style (`h1.heading-root { ... }`).

`SfText` — проп `variant` (body/body-sm/caption/label/overline):

| Variant | Size | Weight |
|---------|------|--------|
| `body` | 16px | 400 |
| `body-sm` | 14px | 400 |
| `caption` | 12px | 400 |
| `label` | 14px | 500 |
| `overline` | 11px / uppercase / tracked | 600 |

---

### Responsive sizing — универсальный паттерн для всех компонентов

**Правило:** `size` задаёт размер для мобилки. Если `responsive={true}`, на desktop (`lg`+) размер автоматически поднимается на один шаг. Если размер уже максимальный — остаётся как есть.

Шкала размеров: `tiny` → `small` → `medium` → `large` (у каждого компонента своё подмножество).

**Реализация через CSS** (не JS!) — в scoped style:
```scss
// Базовый паттерн для любого компонента с responsive
.btn-root.is-responsive {
  @include lg {
    // применяем стили следующего размера
  }
}
```

В шаблоне:
```vue
<SfButton size="small" :responsive="true">Мобилка small, десктоп medium</SfButton>
<SfButton size="medium" :responsive="true">Мобилка medium, десктоп large</SfButton>
<SfButton size="large" :responsive="true">Мобилка large, десктоп large (max)</SfButton>
<SfButton size="medium">Всегда medium</SfButton>
```

`responsive` по умолчанию `false` — явное управление. Везде где нужен авто-апскейл — передаём `responsive`.

Это применяется к: `SfButton`, `SfIconButton`, `SfText`, `SfBadge`, `SfInput`, `SfTag`, `SfStepper`.

---

### SfButton

Размеры: `small` (36px) / `medium` (44px) / `large` (52px)

Варианты: `primary` / `secondary` / `ghost` / `outline` / `destructive`

```vue
<SfButton variant="primary" size="small" responsive>Добавить в корзину</SfButton>
<SfButton variant="ghost" size="small">Отмена</SfButton>
```

Цвета через tenant vars:
- `primary`: bg=`--primary`, text=`--on-primary`, hover=`--primary-hover`
- `secondary`: bg=`--color-surface`, text=`--color-text`, border=`--color-border`
- `ghost`: bg=transparent, text=`--primary`, hover=`--primary-subtle`

---

### SfContainer

```vue
<SfContainer>...</SfContainer>
<!-- Props: maxWidth ('content'=1280|'narrow'=800|'wide'=1536|'full') -->
```

Внутри: `max-width` + `padding-inline` из CSS vars (совместимо с `--section-paddings`).

---

### SfSection

```vue
<SfSection>
  <SfContainer>...</SfContainer>
</SfSection>
<!-- Props: spacing ('small'|'medium'|'large'='medium'), bg ('page'|'surface'|'none'='none') -->
```

---

### SfDialog / SfDrawer

`SfDialog` — классический центрированный модал, Reka Dialog под капотом.
`SfDrawer` — Reka Dialog + позиция (bottom/right), анимация slide. На mobile всегда bottom.

---

### SfDishCard

```vue
<SfDishCard :dish="dish" @add="onAdd" />
```

- Image (aspect-ratio 4/3), lazy
- Name (SfText label)
- Description (SfText caption, truncate 2 lines)
- SfPriceTag
- SfButton или SfStepper (если уже в корзине)
- `--radius-card` для скругления

---

## Порядок реализации и параллелизм

### Шаг 1 — Foundation (блокирует всё, делать первым, 1 агент)
1. `assets/styles/main.scss` — точка входа
2. `assets/styles/_tokens.scss` — derived CSS vars (color-mix, radius, shadow)
3. `assets/styles/_mixins.scss` — breakpoint mixins
4. `assets/styles/_reset.scss` — box-sizing, margin reset
5. `assets/styles/_typography.scss` — base html styles
6. `nuxt.config.ts` — подключить `css: ['~/assets/styles/main.scss']`, добавить `scss.additionalData` для `@use '~/assets/styles/mixins'`
7. `useTheme.ts` — расширить: добавить `--radius-btn`, `--radius-card`, `--shadow-card` из tenant theme

### Шаг 2 — Layout + Typography (параллельно, 2 агента)

**Агент A — Layout:**
- `SfContainer.vue`
- `SfSection.vue`

**Агент B — Typography:**
- `SfHeading.vue`
- `SfText.vue`

### Шаг 3 — Base UI + Forms (параллельно, 2 агента)

**Агент A — Base UI:**
- `SfButton.vue`
- `SfIconButton.vue`
- `SfBadge.vue`
- `SfTag.vue`
- `SfDivider.vue`
- `SfSkeleton.vue`
- `SfAvatar.vue`
- `SfSpinner.vue`

**Агент B — Forms:**
- `SfLabel.vue`
- `SfField.vue`
- `SfInput.vue`
- `SfTextarea.vue`
- `SfCheckbox.vue`
- `SfSwitch.vue`
- `SfSelect.vue`
- `SfRadioGroup.vue`

### Шаг 4 — Overlays + Nav (параллельно, 2 агента)

**Агент A — Overlays:**
- `SfDialog.vue`
- `SfDrawer.vue`
- `SfToast.vue` + `SfToastProvider.vue`
- `SfTooltip.vue`
- `useToast.ts`

**Агент B — Nav:**
- `SfTabs.vue`
- `SfScrollNav.vue`

### Шаг 5 — Domain Components (1 агент)
- `SfDishCard.vue`
- `SfDishCardCompact.vue`
- `SfPriceTag.vue`
- `SfStepper.vue`
- `SfCartFab.vue`
- `SfOrderStatus.vue`
- `SfEmptyState.vue`

---

## Ключевые правила для агентов

1. **Цвета** — только через CSS vars `--primary`, `--color-bg`, `--color-surface`, `--color-text`, `--color-text-secondary`, `--color-text-muted`, `--color-border`, `--on-primary`, и derived vars из `_tokens.scss`
2. **Затемнение/осветление** — только через `color-mix(in srgb, var(--primary) X%, #000/#fff/transparent)`
3. **Стили** — только scoped, никаких global; короткие имена классов; корневой класс `[component-name]-root`
4. **Responsive** — mobile-first; авто-адаптив через CSS (не JS props); для auto-sizing кнопок и т.п. используй CSS media queries внутри scoped
5. **Reka UI** — импортировать компоненты напрямую из `reka-ui` (explicit import)
6. **Nuxt** — SSR: true, не использовать `document`/`window` на сервере; `onMounted` или `<ClientOnly>` где нужно
7. **TypeScript** — `type` вместо `interface`; Props через `defineProps` с типами
8. **Иконки** — `lucide-vue-next` (уже в зависимостях)
9. **Авто-импорты отключены** (`components: false`, `imports: { autoImport: false }` в nuxt.config). Всё импортировать явно в `<script setup>`: компоненты через `import SfButton from '~/components/sf/base/SfButton.vue'`, composables через `import { useX } from '~/composables/useX'`, Vue через `import { ref, computed } from 'vue'`
10. **SCSS mixins** — В каждом компоненте с `<style scoped lang="scss">` добавляй `@use '~/assets/styles/mixins' as *;` первой строкой. Затем используй `@include lg { }` и т.д.

---

## Пример компонента

```vue
<!-- components/sf/base/SfButton.vue -->
<script setup lang="ts">
type Props = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  responsive?: boolean   // на lg+ размер +1 шаг (sm→md, md→lg, lg→lg)
  disabled?: boolean
  loading?: boolean
  as?: 'button' | 'a'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  responsive: false,
  as: 'button',
})
</script>

<template>
  <component
    :is="as"
    class="btn-root"
    :class="[
      `btn-${variant}`,
      `btn-${size}`,
      { 'is-responsive': responsive, 'is-loading': loading }
    ]"
    :disabled="disabled || loading"
  >
    <SfSpinner v-if="loading" class="btn-spinner" />
    <slot />
  </component>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.btn-root {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  border-radius: var(--radius-btn);
  transition: background 0.15s, opacity 0.15s;
  white-space: nowrap;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

// Sizes (мобилка)
.btn-sm { height: 36px; padding: 0 14px; font-size: 13px; }
.btn-md { height: 44px; padding: 0 20px; font-size: 15px; }
.btn-lg { height: 52px; padding: 0 28px; font-size: 16px; }

// Responsive: на lg+ поднимаемся на шаг вверх
.btn-sm.is-responsive { @include lg { height: 44px; padding: 0 20px; font-size: 15px; } }
.btn-md.is-responsive { @include lg { height: 52px; padding: 0 28px; font-size: 16px; } }
// btn-lg.is-responsive — уже максимум, ничего не меняем

// Variants
.btn-primary {
  background: var(--primary);
  color: var(--on-primary);
  &:hover:not(:disabled) { background: var(--primary-hover); }
}
.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  &:hover:not(:disabled) { background: var(--surface-hover); }
}
.btn-ghost {
  background: transparent;
  color: var(--primary);
  &:hover:not(:disabled) { background: var(--primary-subtle); }
}
</style>
```

---

## Reka UI компоненты и их использование

| Reka Component | Наш компонент | Reka import |
|---|---|---|
| `DialogRoot/Trigger/Portal/Overlay/Content` | `SfDialog` | `reka-ui` |
| `DialogRoot` (с side animation) | `SfDrawer` | `reka-ui` |
| `ToastRoot/Provider/Viewport` | `SfToast/SfToastProvider` | `reka-ui` |
| `TooltipRoot/Trigger/Content` | `SfTooltip` | `reka-ui` |
| `TabsRoot/List/Trigger/Content` | `SfTabs` | `reka-ui` |
| `SelectRoot/Trigger/Content/Item` | `SfSelect` | `reka-ui` |
| `CheckboxRoot` | `SfCheckbox` | `reka-ui` |
| `RadioGroupRoot/Item` | `SfRadioGroup` | `reka-ui` |
| `SwitchRoot` | `SfSwitch` | `reka-ui` |

> Все остальные компоненты (Button, Input, Card, etc.) — **НЕ используем Reka** (там нет этих примитивов или они не нужны), пишем сами на чистом HTML/CSS.

---

## Что НЕ входит в UI систему (делается отдельно)

- Конкретные секции страниц (`SiteHeader`, `MenuSection`, `HeroSection` и т.д.) — это Page-level components
- Бизнес-логика (корзина, оформление заказа) — в composables/stores
- Анимации страниц / page transitions
