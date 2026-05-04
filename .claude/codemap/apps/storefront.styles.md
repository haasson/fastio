# Styles — `apps/storefront`

> Локальные стили витрины (помимо @fastio/styles).

_Карта SCSS-токенов и миксинов проекта. Используй переменные/миксины ВСЕГДА вместо хардкода значений._

## `assets/styles/_mixins.scss`

**Миксины**:
- `@mixin md`
- `@mixin mdl`
- `@mixin lg`
- `@mixin xl`
- `@mixin flex-col($gap: 0)`
- `@mixin flex-row($gap: 0)`
- `@mixin flex-between($gap: 0)`
- `@mixin truncate`
- `@mixin flex-fill`
- `@mixin text-micro($weight: 400)` — ─── Typography ───────────────────────────────────────────────────────────────
- `@mixin text-xs($weight: 400)`
- `@mixin text-caption($weight: 400)`
- `@mixin text-body-sm($weight: 400)`
- `@mixin text-body($weight: 400)`
- `@mixin text-label`
- `@mixin text-overline`
- `@mixin consent-note`

## `assets/styles/_tokens.scss`

**CSS-токены** (`var(--name)`):
- `--font-family` — `-apple-system, BlinkMacSystemFont, 'Segoe UI', Ro…` — Fallback defaults (перекрываются useTheme при загрузке)
- `--primary` — `#ff6b35`
- `--on-primary` — `#ffffff`
- `--color-bg` — `#ffffff`
- `--color-surface` — `#f5f5f5`
- `--color-text` — `#111111`
- `--color-text-secondary` — `#666666`
- `--color-text-muted` — `#999999`
- `--color-border` — `#e0e0e0`
- `--color-error` — `#ef4444` — Semantic colors
- `--color-success` — `#10b981`
- `--color-warning` — `#f59e0b`
- `--primary-hover` — `color-mix(in srgb, var(--primary) 82%, #000)` — Derived от --primary
- `--primary-subtle` — `color-mix(in srgb, var(--primary) 12%, transparen…`
- `--primary-subtle-hover` — `color-mix(in srgb, var(--primary) 22%, transparen…`
- `--surface-hover` — `color-mix(in srgb, var(--color-surface) 88%, var(…` — Derived от --color-surface / --color-text
- `--border-hover` — `color-mix(in srgb, var(--color-border) 60%, var(-…`
- `--radius-btn` — `8px` — Radius (defaults, перекрываются useTheme из tenant.theme)
- `--radius-card` — `14px`
- `--radius-pill` — `9999px`
- `--shadow-card` — `0 2px 8px rgba(0, 0, 0, 0.07), 0 1px 2px rgba(0, …` — Shadows (defaults, перекрываются useTheme)
- `--shadow-card-md` — `0 4px 16px rgba(0, 0, 0, 0.10), 0 2px 4px rgba(0,…`
- `--section-spacing` — `24px` — Section spacing
- `--z-base` — `1` — Z-index scale
- `--z-dropdown` — `100`
- `--z-sticky` — `200`
- `--z-overlay` — `300`
- `--z-modal` — `400`
- `--z-toast` — `500`

