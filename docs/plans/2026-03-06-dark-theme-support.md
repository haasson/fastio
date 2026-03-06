# Dark Theme Support — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Подготовить `@fastio/ui` к переключению на тёмную тему — убрать захардкоженные цвета из компонентов, всё должно рулиться через Naive UI тему и CSS-переменные.

**Architecture:** Два корневых источника цветов — CSS-переменные в `colors.scss` и JS-объект `naive-ui-theme-overrides.ts`. Оба должны поддерживать light/dark варианты. Компоненты не должны содержать hardcoded цветов — только CSS vars или наследование от Naive UI. `UiConfigProvider` становится точкой переключения темы.

**Tech Stack:** Vue 3, Naive UI (darkTheme, GlobalThemeOverrides), SCSS, CSS custom properties

---

### Task 1: Удалить UiLink и UiBreadcrumbs

**Files:**
- Delete: `packages/ui/src/components/UiLink.vue`
- Delete: `packages/ui/src/components/UiBreadcrumbs.vue`
- Modify: `packages/ui/src/index.ts` (строки 39-40, 43)
- Modify: `apps/admin/components/orders/OrderCard.vue` (строка 30, 90)
- Modify: `apps/admin/components/settings/SettingsNotifications.vue` (строки 26-31, 54)

**Step 1: Заменить UiLink в OrderCard.vue**

В `OrderCard.vue` строка 30 заменить `<UiLink>` на обычный `<a>`:
```vue
<a :href="`tel:${order.customer.phone}`">{{ order.customer.phone }}</a>
```
Убрать `UiLink` из импорта на строке 90.

**Step 2: Заменить UiLink в SettingsNotifications.vue**

В `SettingsNotifications.vue` строки 26-31 заменить `<UiLink>` на `<a>`:
```vue
<a href="https://t.me/userinfobot" target="_blank">@userinfobot</a>
```
Убрать `UiLink` из импорта на строке 54.

**Step 3: Удалить экспорты из index.ts**

Удалить строки 39-40, 43 из `packages/ui/src/index.ts`:
```
export { default as UiLink } from './components/UiLink.vue'
export { default as UiBreadcrumbs } from './components/UiBreadcrumbs.vue'
export type { BreadcrumbItem } from './components/UiBreadcrumbs.vue'
```

**Step 4: Удалить файлы компонентов**

```bash
rm packages/ui/src/components/UiLink.vue
rm packages/ui/src/components/UiBreadcrumbs.vue
```

**Step 5: Проверить сборку**

```bash
cd apps/admin && npx nuxi build --fail-on-error 2>&1 | head -30
```
Ожидаем: сборка без ошибок.

**Step 6: Commit**

```
feat(no-refs): remove UiLink and UiBreadcrumbs components
```

---

### Task 2: Добавить dark-вариант CSS-переменных в colors.scss

**Files:**
- Modify: `packages/ui/src/styles/variables/colors.scss`

**Step 1: Добавить блок `[data-theme="dark"]` после `:root`**

Семантические переменные (строки 61-88) должны переопределяться для тёмной темы. Сырая палитра (grey-50..900, blue-50..900 и т.д.) остаётся неизменной — инвертируются только семантические алиасы.

```scss
[data-theme="dark"] {
  // Background Colors
  --bg-page: #111113;

  // Semantic Colors
  --color-primary: var(--blue-400);
  --color-primary-hover: var(--blue-300);
  --color-primary-light: rgba(59, 130, 246, 0.15);
  --color-success: var(--green-500);
  --color-title: var(--grey-50);
  --color-text: var(--grey-300);
  --color-text-secondary: var(--grey-500);
  --color-text-tertiary: var(--grey-600);
  --color-text-hint: var(--grey-400);
  --color-warning: var(--yellow-400);
  --color-error: var(--red-500);
  --color-error-light: rgba(239, 68, 68, 0.15);
  --color-white: #1c1c1e;
  --color-border: var(--grey-700);
  --color-border-light: var(--grey-800);
  --color-bg-card: #1c1c1e;
  --color-bg-page: #111113;
  --color-bg-hover: var(--grey-800);

  // Other
  --box-shadow: 0 12px 16px -4px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2);
}
```

> Заметь: `--color-white` в dark mode становится тёмным surface-цветом. Это нормально — переменная семантическая ("фон карточки/модалки"), а не буквально "белый".

**Step 2: Проверить что SCSS компилируется**

```bash
cd packages/ui && npx sass src/styles/variables/colors.scss --no-source-map 2>&1 | head -20
```

**Step 3: Commit**

```
feat(no-refs): add dark theme CSS variables
```

---

### Task 3: Сделать Naive UI theme overrides реактивными (light/dark)

**Files:**
- Modify: `packages/ui/src/config/naive-ui-theme-overrides.ts`
- Modify: `packages/ui/src/components/UiConfigProvider.vue`
- Modify: `packages/ui/src/index.ts` (экспорты)

**Step 1: Переписать naive-ui-theme-overrides.ts — два набора overrides**

Файл должен экспортировать два объекта: `lightThemeOverrides` и `darkThemeOverrides`. Общие настройки (размеры, border-radius, padding, font) вынести в `baseOverrides`. Цветовые значения — в light/dark варианты.

```typescript
import type { GlobalThemeOverrides } from 'naive-ui'
import { COLORS } from '../constants/colors'

// Общие настройки, не зависящие от темы
const baseOverrides = {
  common: {
    fontFamily: 'Inter, sans-serif',
    fontWeightStrong: '700',
    borderRadius: '12px',
    fontSizeTiny: '14px',
    fontSizeSmall: '14px',
    fontSizeMedium: '14px',
    fontSizeLarge: '14px',
    heightTiny: '24px',
    heightSmall: '32px',
    heightMedium: '40px',
    heightLarge: '48px',
    fontWeight: '700',
  },
  Button: {
    rippleDuration: '0',
    borderRadiusTiny: '6px',
    borderRadiusSmall: '8px',
    borderRadiusMedium: '8px',
    borderRadiusLarge: '12px',
    paddingTiny: '0 20px',
    paddingSmall: '0 20px',
    paddingMedium: '0 20px',
    paddingLarge: '0 20px',
    iconMarginTiny: '8px',
    iconMarginSmall: '8px',
    iconMarginMedium: '8px',
    iconMarginLarge: '8px',
    iconSizeTiny: '16px',
    iconSizeSmall: '16px',
    iconSizeMedium: '24px',
    iconSizeLarge: '24px',
  },
  Input: {
    fontWeight: '400',
    fontSizeTiny: '16px',
    fontSizeSmall: '16px',
    fontSizeMedium: '16px',
    fontSizeLarge: '16px',
    boxShadowFocus: 'none',
    boxShadowFocusWarning: 'none',
    boxShadowFocusError: 'none',
    paddingTiny: '0 8px',
    paddingSmall: '0 12px',
    paddingMedium: '0 16px',
    paddingLarge: '0 16px 0 24px',
  },
  Checkbox: {
    sizeSmall: '16px',
    sizeMedium: '20px',
    sizeLarge: '24px',
    fontSizeSmall: '12px',
    fontSizeMedium: '14px',
    fontSizeLarge: '16px',
    borderRadius: '5px',
    boxShadowFocus: 'none',
  },
  Radio: {
    radioSizeSmall: '16px',
    radioSizeMedium: '20px',
    radioSizeLarge: '24px',
    fontSizeSmall: '12px',
    fontSizeMedium: '14px',
    fontSizeLarge: '16px',
  },
  DatePicker: {
    itemBorderRadius: '50px',
    arrowSize: '24px',
  },
  Pagination: {
    buttonBorder: 'none',
    itemBorderActive: 'none',
    pageSlot: 7,
    itemBorderRadius: '8px',
    itemFontSizeTiny: '12px',
    itemFontSizeSmall: '14px',
    itemFontSizeMedium: '16px',
    itemFontSizeLarge: '16px',
  },
  Menu: {
    itemHeight: '38px',
  },
  DataTable: {
    thPaddingSmall: '2px 4px',
    tdPaddingSmall: '2px 4px',
    thPaddingMedium: '6px 10px',
    tdPaddingMedium: '6px 10px',
    thPaddingLarge: '10px 16px',
    tdPaddingLarge: '10px 16px',
  },
  Message: {
    borderRadius: '10px',
  },
  Select: {
    menuBoxShadow: 'none',
  },
} satisfies GlobalThemeOverrides

// Цвета для светлой темы
const lightColors = {
  common: {
    baseColor: COLORS.WHITE,
    primaryColor: COLORS.PRIMARY,
    primaryColorHover: COLORS.BLUE_400,
    primaryColorPressed: COLORS.PRIMARY,
    successColor: COLORS.SUCCESS,
    errorColor: COLORS.RED_500,
    errorColorHover: COLORS.RED_600,
    errorColorPressed: COLORS.RED_700,
    borderColor: COLORS.GREY_200,
    textColorBase: COLORS.TITLE,
    closeIconColor: COLORS.GREY_100,
  },
  Input: {
    placeholderColor: COLORS.GREY_300,
    textColorDisabled: COLORS.GREY_300,
    groupLabelBorder: `2px solid ${COLORS.GREY_200}`,
    border: `2px solid ${COLORS.GREY_200}`,
    borderHover: `2px solid ${COLORS.BLUE_400}`,
    borderDisabled: `2px solid ${COLORS.GREY_200}`,
    borderFocus: `2px solid ${COLORS.BLUE_400}`,
    borderWarning: `2px solid ${COLORS.WARNING}`,
    borderHoverWarning: `2px solid ${COLORS.YELLOW_400}`,
    borderFocusWarning: `2px solid ${COLORS.YELLOW_400}`,
    borderError: `2px solid ${COLORS.ERROR}`,
    borderHoverError: `2px solid ${COLORS.RED_500}`,
    borderFocusError: `2px solid ${COLORS.RED_500}`,
  },
  Collapse: {
    dividerColor: COLORS.GREY_200,
  },
  Checkbox: {
    checkMarkColorDisabled: COLORS.GREY_200,
    checkMarkColorDisabledChecked: COLORS.WHITE,
    colorDisabledChecked: COLORS.GREY_200,
    border: `2px solid ${COLORS.PRIMARY}`,
    borderDisabled: `2px solid ${COLORS.GREY_200}`,
    borderDisabledChecked: `2px solid ${COLORS.GREY_200}`,
    borderChecked: `2px solid ${COLORS.PRIMARY}`,
    borderFocus: `2px solid ${COLORS.PRIMARY}`,
    textColor: COLORS.TITLE,
    textColorDisabled: COLORS.GREY_300,
  },
  Radio: {
    boxShadow: `inset 0 0 0 2px ${COLORS.PRIMARY}`,
    boxShadowActive: `inset 0 0 0 2px ${COLORS.PRIMARY}`,
    boxShadowFocus: `inset 0 0 0 2px ${COLORS.PRIMARY}`,
    boxShadowHover: `inset 0 0 0 2px ${COLORS.BLUE_400}`,
    boxShadowDisabled: `inset 0 0 0 2px ${COLORS.GREY_200}`,
    textColorDisabled: COLORS.GREY_300,
    textColor: COLORS.TITLE,
  },
  Select: {
    border: `2px solid ${COLORS.GREY_200}`,
    borderHover: `2px solid ${COLORS.BLUE_400}`,
    borderActive: `2px solid ${COLORS.BLUE_400}`,
    borderFocus: `2px solid ${COLORS.BLUE_400}`,
    peers: {
      InternalSelectMenu: {
        optionColorPending: COLORS.BLUE_50,
        optionColorActive: COLORS.BLUE_50,
        optionColorActivePending: COLORS.BLUE_50,
        optionHeightTiny: '24px',
        optionHeightSmall: '32px',
        optionHeightMedium: '40px',
        optionHeightLarge: '48px',
      },
    },
  },
  DatePicker: {
    calendarDividerColor: COLORS.GREY_200,
    calendarTitleColorHover: COLORS.BLUE_50,
    itemColorHover: COLORS.BLUE_50,
    itemColorActive: COLORS.PRIMARY,
    itemColorActiveHover: COLORS.BLUE_400,
  },
  Pagination: {
    buttonColor: 'transparent',
    itemColor: 'transparent',
    itemColorActive: COLORS.BLUE_50,
    itemColorHover: COLORS.BLUE_50,
    itemColorPressed: COLORS.BLUE_50,
    itemColorActiveHover: COLORS.BLUE_50,
  },
  Menu: {
    itemTextColor: COLORS.GREY_900,
    itemTextColorHover: COLORS.GREY_900,
    itemColorHover: 'transparent',
    itemColorActive: 'transparent',
    itemColorActiveHover: 'transparent',
    itemTextColorActive: COLORS.TITLE,
    itemTextColorActiveHover: COLORS.TITLE,
    itemTextColorChildActive: COLORS.TITLE,
    itemTextColorChildActiveHover: COLORS.TITLE,
    itemIconColorActive: COLORS.TITLE,
    itemIconColorActiveHover: COLORS.TITLE,
    itemIconColorChildActive: COLORS.TITLE,
    itemIconColorChildActiveHover: COLORS.TITLE,
    arrowColorActive: COLORS.TITLE,
    arrowColorActiveHover: COLORS.TITLE,
    arrowColorChildActive: COLORS.TITLE,
    arrowColorChildActiveHover: COLORS.TITLE,
  },
  Alert: {
    colorInfo: COLORS.BLUE_50,
    colorSuccess: COLORS.GREEN_100,
    colorWarning: COLORS.YELLOW_100,
    colorError: COLORS.RED_100,
  },
  Message: {
    color: COLORS.GREY_900,
    colorInfo: COLORS.GREY_900,
    colorSuccess: COLORS.GREY_900,
    colorWarning: COLORS.GREY_900,
    colorError: COLORS.GREY_900,
    colorLoading: COLORS.GREY_900,
    textColorInfo: COLORS.WHITE,
    textColorSuccess: COLORS.WHITE,
    textColorWarning: COLORS.WHITE,
    textColorError: COLORS.WHITE,
    iconColorInfo: COLORS.BLUE_400,
    iconColorSuccess: COLORS.GREEN_500,
    iconColorWarning: COLORS.YELLOW_400,
    iconColorError: COLORS.RED_500,
    closeIconColor: COLORS.GREY_400,
    closeIconColorHover: COLORS.WHITE,
    closeIconColorPressed: COLORS.WHITE,
  },
} satisfies GlobalThemeOverrides

// Цвета для тёмной темы
const darkColors: GlobalThemeOverrides = {
  common: {
    primaryColor: COLORS.BLUE_400,
    primaryColorHover: COLORS.BLUE_300,
    primaryColorPressed: COLORS.BLUE_500,
    borderColor: COLORS.GREY_700,
  },
  Input: {
    placeholderColor: COLORS.GREY_600,
    textColorDisabled: COLORS.GREY_600,
    groupLabelBorder: `2px solid ${COLORS.GREY_700}`,
    border: `2px solid ${COLORS.GREY_700}`,
    borderHover: `2px solid ${COLORS.BLUE_400}`,
    borderDisabled: `2px solid ${COLORS.GREY_700}`,
    borderFocus: `2px solid ${COLORS.BLUE_400}`,
    borderWarning: `2px solid ${COLORS.WARNING}`,
    borderHoverWarning: `2px solid ${COLORS.YELLOW_400}`,
    borderFocusWarning: `2px solid ${COLORS.YELLOW_400}`,
    borderError: `2px solid ${COLORS.ERROR}`,
    borderHoverError: `2px solid ${COLORS.RED_500}`,
    borderFocusError: `2px solid ${COLORS.RED_500}`,
  },
  Collapse: {
    dividerColor: COLORS.GREY_700,
  },
  Checkbox: {
    checkMarkColorDisabled: COLORS.GREY_700,
    colorDisabledChecked: COLORS.GREY_700,
    borderDisabled: `2px solid ${COLORS.GREY_700}`,
    borderDisabledChecked: `2px solid ${COLORS.GREY_700}`,
    textColorDisabled: COLORS.GREY_600,
  },
  Radio: {
    boxShadowDisabled: `inset 0 0 0 2px ${COLORS.GREY_700}`,
    textColorDisabled: COLORS.GREY_600,
  },
  Select: {
    border: `2px solid ${COLORS.GREY_700}`,
    borderHover: `2px solid ${COLORS.BLUE_400}`,
    borderActive: `2px solid ${COLORS.BLUE_400}`,
    borderFocus: `2px solid ${COLORS.BLUE_400}`,
    peers: {
      InternalSelectMenu: {
        optionColorPending: 'rgba(59, 130, 246, 0.15)',
        optionColorActive: 'rgba(59, 130, 246, 0.15)',
        optionColorActivePending: 'rgba(59, 130, 246, 0.15)',
        optionHeightTiny: '24px',
        optionHeightSmall: '32px',
        optionHeightMedium: '40px',
        optionHeightLarge: '48px',
      },
    },
  },
  DatePicker: {
    calendarDividerColor: COLORS.GREY_700,
    calendarTitleColorHover: 'rgba(59, 130, 246, 0.15)',
    itemColorHover: 'rgba(59, 130, 246, 0.15)',
    itemColorActive: COLORS.BLUE_400,
    itemColorActiveHover: COLORS.BLUE_300,
  },
  Pagination: {
    buttonColor: 'transparent',
    itemColor: 'transparent',
    itemColorActive: 'rgba(59, 130, 246, 0.15)',
    itemColorHover: 'rgba(59, 130, 246, 0.15)',
    itemColorPressed: 'rgba(59, 130, 246, 0.15)',
    itemColorActiveHover: 'rgba(59, 130, 246, 0.15)',
  },
  Alert: {
    colorInfo: 'rgba(59, 130, 246, 0.15)',
    colorSuccess: 'rgba(16, 185, 129, 0.15)',
    colorWarning: 'rgba(234, 179, 8, 0.15)',
    colorError: 'rgba(239, 68, 68, 0.15)',
  },
  Message: {
    color: COLORS.GREY_100,
    colorInfo: COLORS.GREY_100,
    colorSuccess: COLORS.GREY_100,
    colorWarning: COLORS.GREY_100,
    colorError: COLORS.GREY_100,
    colorLoading: COLORS.GREY_100,
    textColorInfo: COLORS.GREY_900,
    textColorSuccess: COLORS.GREY_900,
    textColorWarning: COLORS.GREY_900,
    textColorError: COLORS.GREY_900,
    closeIconColor: COLORS.GREY_500,
    closeIconColorHover: COLORS.GREY_900,
    closeIconColorPressed: COLORS.GREY_900,
  },
}

function deepMerge(...objects: GlobalThemeOverrides[]): GlobalThemeOverrides {
  const result: Record<string, any> = {}
  for (const obj of objects) {
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = deepMerge(result[key] || {}, value)
      } else {
        result[key] = value
      }
    }
  }
  return result
}

export const lightThemeOverrides: GlobalThemeOverrides = deepMerge(baseOverrides, lightColors)
export const darkThemeOverrides: GlobalThemeOverrides = deepMerge(baseOverrides, darkColors)

// Обратная совместимость — убрать после миграции всех приложений
export default lightThemeOverrides
```

**Step 2: Обновить UiConfigProvider — поддержка dark theme**

```vue
<template>
  <n-config-provider
    :locale="ruRU"
    :date-locale="dateRuRU"
    :theme="isDark ? darkTheme : undefined"
    :theme-overrides="isDark ? darkThemeOverrides : lightThemeOverrides"
  >
    <n-message-provider>
      <slot />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { NConfigProvider, NMessageProvider, darkTheme, ruRU, dateRuRU } from 'naive-ui'
import { lightThemeOverrides, darkThemeOverrides } from '../config/naive-ui-theme-overrides'

type Props = {
  isDark?: boolean
}

defineProps<Props>()
</script>
```

**Step 3: Обновить экспорты в index.ts**

Добавить экспорт `lightThemeOverrides` и `darkThemeOverrides`:
```typescript
export { default as naiveUiThemeOverrides, lightThemeOverrides, darkThemeOverrides } from './config/naive-ui-theme-overrides'
```

**Step 4: Проверить сборку**

```bash
cd apps/admin && npx nuxi build --fail-on-error 2>&1 | head -30
```

**Step 5: Commit**

```
feat(no-refs): split naive-ui theme overrides into light/dark variants
```

---

### Task 4: Пофиксить hardcoded цвета в компонентах

**Files:**
- Modify: `packages/ui/src/components/UiBottomSheet.vue` (строки 133, 147)
- Modify: `packages/ui/src/components/UiModal.vue` (строка 300)
- Modify: `packages/ui/src/components/UiCounter.vue` (строки 60-61)
- Modify: `packages/ui/src/components/UiForm.vue` (строка 100)
- Modify: `packages/ui/src/styles/layout/index.scss` (строки 5, 13)
- Modify: `packages/ui/src/styles/variables/colors.scss` (добавить новые переменные)

**Step 1: Добавить недостающие CSS-переменные в colors.scss**

В `:root` блок добавить:
```scss
--overlay-bg: rgba(0, 0, 0, 0.2);
--overlay-loading: rgba(255, 255, 255, 0.7);
--color-error-light: rgba(255, 0, 0, 0.08);
```

В `[data-theme="dark"]` блок добавить:
```scss
--overlay-bg: rgba(0, 0, 0, 0.5);
--overlay-loading: rgba(0, 0, 0, 0.5);
--color-error-light: rgba(239, 68, 68, 0.15);
```

**Step 2: UiBottomSheet.vue — заменить hardcoded цвета**

Строка 133: `background: rgba(0, 0, 0, 0.2)` → `background: var(--overlay-bg)`
Строка 147: `background: white` → `background: var(--color-bg-card)`

**Step 3: UiModal.vue — заменить loading overlay**

Строка 300: `background: rgba(255, 255, 255, 0.7)` → `background: var(--overlay-loading)`

**Step 4: UiCounter.vue — заменить filled цвета**

Строка 60: `background: rgba(255, 255, 255, 0.22)` → `background: rgba(255, 255, 255, 0.22)` — оставить как есть, это overlay поверх цветного бэкграунда, от темы не зависит.
Строка 61: `color: rgba(255, 255, 255, 0.85)` → аналогично, оставить.

> UiCounter: белый с opacity поверх цветного фона (primary/success/error) — это правильное поведение для обеих тем. Не трогаем.

**Step 5: UiForm.vue — убрать hardcoded fallback**

Строка 100: `background: var(--color-error-light, rgba(255, 0, 0, 0.08))` → `background: var(--color-error-light)` (fallback больше не нужен — переменная гарантированно определена).

**Step 6: layout/index.scss — заменить scrollbar цвета**

Строка 5: `scrollbar-color: #e2e3e8 transparent` → `scrollbar-color: var(--color-border) transparent`
Строка 13: `background: #e2e3e8` → `background: var(--color-border)`

**Step 7: Проверить сборку**

```bash
cd apps/admin && npx nuxi build --fail-on-error 2>&1 | head -30
```

**Step 8: Commit**

```
fix(no-refs): replace hardcoded colors with CSS variables for dark theme support
```

---

### Task 5: Интеграция в admin app — добавить переключение темы

**Files:**
- Modify: `apps/admin/app.vue`

**Step 1: Добавить data-theme атрибут и isDark проп**

```vue
<template>
  <UiConfigProvider :is-dark="isDark">
    <UiConfirmModal />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UiConfigProvider>
</template>

<script setup lang="ts">
import { UiConfigProvider, UiConfirmModal } from '@fastio/ui'
import { ref, watch } from 'vue'

const isDark = ref(false)

watch(isDark, (dark) => {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}, { immediate: true })

provide('isDark', isDark)
</script>
```

> Примечание: `provide('isDark', isDark)` позволит любому компоненту в дереве читать и переключать тему. Полноценный UI для переключения темы — отдельная задача, не входит в этот план.

**Step 2: Убрать старый импорт naiveUiThemeOverrides**

Из `app.vue` убрать `import { naiveUiThemeOverrides } from '@fastio/ui'` и проп `:theme-overrides`.

**Step 3: Проверить сборку**

```bash
cd apps/admin && npx nuxi build --fail-on-error 2>&1 | head -30
```

**Step 4: Commit**

```
feat(no-refs): integrate dark theme switching in admin app
```

---

### Task 6: Визуальная проверка

**Step 1: Запустить dev-сервер**

```bash
cd apps/admin && npx nuxi dev
```

**Step 2: Проверить светлую тему**

Открыть приложение, убедиться что визуально ничего не сломалось.

**Step 3: Проверить тёмную тему**

В DevTools консоли выполнить:
```js
document.documentElement.setAttribute('data-theme', 'dark')
```

Проверить:
- Фон страницы стал тёмным
- Карточки/модалки — тёмный surface
- Текст — светлый
- Бордеры — тёмные
- Инпуты, селекты, чекбоксы — корректные цвета
- Bottom sheet и модалка — корректные overlay
- Scrollbar — адаптировался

**Step 4: Зафиксировать найденные проблемы**

Если что-то выглядит неправильно — это будут проблемы в конкретных компонентах, где CSS-переменные используются неправильно (например, `var(--grey-50)` вместо `var(--color-bg-page)`). Собрать список и пофиксить.

**Step 5: Финальный commit**

```
fix(no-refs): dark theme visual fixes
```
