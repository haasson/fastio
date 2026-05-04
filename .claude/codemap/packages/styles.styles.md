# Styles — `packages/styles`

> Глобальные токены и миксины монорепо. Используются всеми приложениями и пакетами через @use '@fastio/styles/...'.

_Карта SCSS-токенов и миксинов проекта. Используй переменные/миксины ВСЕГДА вместо хардкода значений._

## `variables/breakpoints.scss`

**CSS-токены** (`var(--name)`):
- `--breakpoint-s` — `320px`
- `--breakpoint-m` — `768px`
- `--breakpoint-l` — `1280px`
- `--breakpoint-xl` — `1536px`

## `variables/colors.scss`

**CSS-токены** (`var(--name)`):
- `--orange-50` — `#FFF7ED` — Brand Colors - Orange
- `--orange-100` — `#FFEDD5`
- `--orange-200` — `#FED7AA`
- `--orange-300` — `#FDBA74`
- `--orange-400` — `#FB923C`
- `--orange-500` — `#ff6b35`
- `--orange-600` — `#e55a25`
- `--orange-700` — `#c2410c`
- `--orange-800` — `#9a3412`
- `--orange-900` — `#7c2d12`
- `--yellow-50` — `#FEFCE8` — Brand Colors - Yellow
- `--yellow-100` — `#FEF9C3`
- `--yellow-200` — `#FEF08A`
- `--yellow-300` — `#FDE047`
- `--yellow-400` — `#FACC15`
- `--yellow-500` — `#EAB308`
- `--yellow-600` — `#CA8A04`
- `--yellow-700` — `#A16207`
- `--yellow-800` — `#713F12`
- `--yellow-900` — `#713F12`
- `--blue-50` — `#EFF6FF` — Brand Colors - Blue
- `--blue-100` — `#DBEAFE`
- `--blue-200` — `#BFDBFE`
- `--blue-300` — `#93C5FD`
- `--blue-400` — `#60A5FA`
- `--blue-500` — `#3B82F6`
- `--blue-600` — `#2563EB`
- `--blue-700` — `#1D4ED8`
- `--blue-800` — `#1E40AF`
- `--blue-900` — `#1E3A8A`
- `--grey-50` — `#F9FAFB` — Brand Colors - Grey
- `--grey-100` — `#F3F4F6`
- `--grey-200` — `#E5E7EB`
- `--grey-300` — `#D1D5DB`
- `--grey-400` — `#9CA3AF`
- `--grey-500` — `#6B7280`
- `--grey-600` — `#4B5563`
- `--grey-700` — `#374151`
- `--grey-800` — `#1F2937`
- `--grey-900` — `#111827`
- `--green-50` — `#ECFDF5` — System Colors - Green
- `--green-100` — `#D1FAE5`
- `--green-500` — `#10B981`
- `--red-100` — `#FEF2F2` — System Colors - Red
- `--red-500` — `#EF4444`
- `--red-600` — `#DC2626`
- `--red-700` — `#B91C1C`
- `--bg-page` — `#F8F9FB` — Background Colors
- `--bg-black` — `#000000`
- `--bg-card-black` — `#17171B`
- `--bg-card-grey` — `#353540`
- `--color-primary` — `var(--blue-500)` — Semantic Colors
- `--color-primary-hover` — `var(--blue-600)`
- `--color-primary-light` — `var(--blue-50)`
- `--color-primary-soft` — `color-mix(in srgb, var(--color-primary) 12%, tran…`
- `--color-success` — `var(--green-500)`
- `--color-title` — `var(--grey-900)`
- `--color-text` — `var(--grey-700)`
- `--color-text-secondary` — `var(--grey-400)`
- `--color-text-hint` — `var(--grey-500)`
- `--color-warning` — `var(--yellow-500)`
- `--color-error` — `var(--red-500)`
- `--color-white` — `#fff`
- `--color-border` — `var(--grey-200)`
- `--color-border-light` — `var(--grey-100)`
- `--color-bg-card` — `var(--color-white)`
- `--color-bg-page` — `var(--grey-50)`
- `--color-bg-hover` — `var(--grey-100)`
- `--color-bg-subtle` — `var(--grey-50)`
- `--overlay-bg` — `rgba(0, 0, 0, 0.2)` — Overlays
- `--overlay-loading` — `rgba(255, 255, 255, 0.7)`
- `--color-error-light` — `var(--red-100)`
- `--color-success-light` — `var(--green-50)`
- `--color-warning-light` — `var(--yellow-50)`
- `--box-shadow` — `0 12px 16px -4px rgba(10, 13, 18, 0.08), 0 4px 6p…` — Other
- `--color-primary` — `var(--blue-400)` — Semantic Colors
- `--color-primary-hover` — `var(--blue-300)`
- `--color-primary-light` — `rgba(59, 130, 246, 0.15)`
- `--color-primary-soft` — `rgba(59, 130, 246, 0.18)`
- `--color-success` — `var(--green-500)`
- `--color-title` — `var(--grey-50)`
- `--color-text` — `var(--grey-300)`
- `--color-text-secondary` — `var(--grey-500)`
- `--color-text-hint` — `var(--grey-400)`
- `--color-warning` — `var(--yellow-400)`
- `--color-error` — `var(--red-500)`
- `--color-error-light` — `rgba(239, 68, 68, 0.15)`
- `--color-success-light` — `rgba(16, 185, 129, 0.15)`
- `--color-warning-light` — `rgba(234, 179, 8, 0.15)`
- `--color-white` — `#1c1c1e`
- `--color-border` — `var(--grey-700)`
- `--color-border-light` — `var(--grey-800)`
- `--color-bg-card` — `#1c1c1e`
- `--color-bg-page` — `#111113`
- `--color-bg-hover` — `var(--grey-800)`
- `--color-bg-subtle` — `var(--grey-800)`
- `--bg-page` — `#111113` — Background Colors
- `--overlay-bg` — `rgba(0, 0, 0, 0.5)` — Overlays
- `--overlay-loading` — `rgba(0, 0, 0, 0.5)`
- `--box-shadow` — `0 12px 16px -4px rgba(0, 0, 0, 0.3), 0 4px 6px -2…` — Other

## `variables/fonts.scss`

**CSS-токены** (`var(--name)`):
- `--main-font` — `'Inter', sans-serif`
- `--secondary-font` — `'Urbanist', sans-serif`
- `--code-font` — `'Monaco', 'Menlo', 'Consolas', monospace`
- `--font-size-xs` — `11px`
- `--font-size-sm` — `12px`
- `--font-size-base` — `13px`
- `--font-size-md` — `14px`
- `--font-size-lg` — `16px`
- `--font-size-xl` — `20px`
- `--font-weight-regular` — `400`
- `--font-weight-medium` — `500`
- `--font-weight-semibold` — `600`
- `--font-weight-bold` — `700`
- `--line-height-tight` — `1.2`
- `--line-height-base` — `1.4`
- `--line-height-loose` — `1.5`

## `variables/shapes.scss`

**CSS-токены** (`var(--name)`):
- `--radius-4` — `4px`
- `--radius-8` — `8px`
- `--radius-12` — `12px`
- `--radius-16` — `16px`
- `--radius-full` — `999px`
- `--radius-pill` — `9999px`
- `--radius-default` — `var(--radius-8)`
- `--radius-card` — `var(--radius-12)`

## `variables/sizes.scss`

**CSS-токены** (`var(--name)`):
- `--space-4` — `4px`
- `--space-8` — `8px`
- `--space-12` — `12px`
- `--space-16` — `16px`
- `--space-20` — `20px`
- `--space-24` — `24px`
- `--space-32` — `32px`
- `--transition-fast` — `120ms ease`
- `--transition-base` — `200ms ease`
- `--transition-slow` — `320ms ease`
- `--section-paddings` — `0 var(--space-16)`
- `--section-width` — `100%`
- `--header-height` — `64px`
- `--section-paddings` — `0 var(--space-32)`
- `--section-width` — `var(--breakpoint-m)`
- `--section-paddings` — `0 80px`
- `--section-width` — `var(--breakpoint-l)`
- `--header-height` — `72px`
- `--section-width` — `var(--breakpoint-xl)`

## `mixins/accordion.scss`

**Миксины**:
- `@mixin accordion-list`
- `@mixin accordion-item`
- `@mixin accordion-options`
- `@mixin accordion-drag-handle`
- `@mixin accordion-item-label`
- `@mixin accordion-action-btn`
- `@mixin accordion-arrow`

## `mixins/form.scss`

**SCSS-переменные**:
- `$save-bar-height` — `64px` — Высота фикс-бара (padding + кнопка). Страницы под баром добавляют padding-bottom в 2x этой величины, чтобы контент не залезал под бар.

**Миксины**:
- `@mixin form-row($gap: 12px)`
- `@mixin section-title`
- `@mixin settings-footer`
- `@mixin fixed-save-bar`
- `@mixin save-bar-offset`
- `@mixin saved-msg`
- `@mixin modal-form($gap: 16px)`

## `mixins/layout.scss`

**Миксины**:
- `@mixin flex-center`
- `@mixin flex-row($gap: var(--space-8)`
- `@mixin flex-between($gap: var(--space-8)`
- `@mixin flex-col($gap: var(--space-8)`
- `@mixin text-ellipsis`
- `@mixin text-clamp($lines: 2)`
- `@mixin button-reset`
- `@mixin absolute-fill`

## `mixins/media-queries.scss`

**Миксины**:
- `@mixin mq-m`
- `@mixin mq-l`
- `@mixin mq-xl`

## `mixins/safe-area.scss`

**Миксины**:
- `@mixin safe-area-top($fallback: 0px)` — / Добавляет padding-top с учётом safe-area (для fixed элементов вверху) / @param {Length} $fallback [0px] - значение по умолчанию для устройств без нотча
- `@mixin safe-area-bottom($fallback: 0px)` — / Добавляет padding-bottom с учётом safe-area (для fixed элементов внизу) / @param {Length} $fallback [0px] - значение по умолчанию для устройств без home indicator
- `@mixin safe-area-left($fallback: 0px)` — / Добавляет padding-left с учётом safe-area (для landscape режима) / @param {Length} $fallback [0px] - значение по умолчанию
- `@mixin safe-area-right($fallback: 0px)` — / Добавляет padding-right с учётом safe-area (для landscape режима) / @param {Length} $fallback [0px] - значение по умолчанию
- `@mixin safe-area-horizontal($fallback: 0px)` — / Добавляет горизонтальные safe-area отступы (left + right) / @param {Length} $fallback [0px] - значение по умолчанию
- `@mixin safe-area-vertical($fallback: 0px)` — / Добавляет вертикальные safe-area отступы (top + bottom) / @param {Length} $fallback [0px] - значение по умолчанию
- `@mixin safe-area-all($fallback: 0px)` — / Добавляет все safe-area отступы / @param {Length} $fallback [0px] - значение по умолчанию для всех сторон

## `mixins/surface.scss`

**Миксины**:
- `@mixin surface-row` — Строка списка / инпута / мелкой карточки. По частоте: radius 8 + padding 8 12 — самый массовый паттерн в админке.
- `@mixin surface-card` — Карточка контента.
- `@mixin surface-hero` — Крупная панель: модалка, hero, онбординг.
- `@mixin text-body` — Типографика-пресеты (font-size + weight + line-height).
- `@mixin text-body-strong`
- `@mixin text-caption`
- `@mixin text-heading`

## `mixins/typography.scss`

**Миксины**:
- `@mixin secondary-font($size)`
- `@mixin underline`
- `@mixin list-styles`

