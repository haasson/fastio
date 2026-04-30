# Styles — `apps/landing`

> Локальные стили лендинга.

_Карта SCSS-токенов и миксинов проекта. Используй переменные/миксины ВСЕГДА вместо хардкода значений._

## `assets/styles/_landing-tokens.scss`

**CSS-токены** (`var(--name)`):
- `--ln-black` — `#0d0c0b` — Landing-specific palette
- `--ln-white` — `#f5f3ee`
- `--ln-cream` — `#f0ede8`
- `--ln-accent` — `#e55a25`
- `--ln-accent-light` — `rgba(229, 90, 37, 0.15)`
- `--ln-gold` — `#c9973a`
- `--ln-muted` — `#6a6764`
- `--ln-border` — `#252220`
- `--ln-surface` — `#161412` — Dark surfaces
- `--ln-surface-2` — `#1e1b18`
- `--primary` — `var(--ln-accent)` — Override primary to orange for landing
- `--primary-hover` — `#cc4e1f`
- `--primary-subtle` — `var(--ln-accent-light)`
- `--primary-subtle-hover` — `rgba(229, 90, 37, 0.25)`
- `--on-primary` — `#ffffff`
- `--color-bg` — `var(--ln-black)` — Surface & text (dark theme)
- `--color-surface` — `var(--ln-surface)`
- `--color-text` — `var(--ln-white)`
- `--color-text-secondary` — `#c0bbb5`
- `--color-text-muted` — `var(--ln-muted)`
- `--color-border` — `var(--ln-border)`
- `--surface-hover` — `var(--ln-surface-2)`
- `--border-hover` — `#3a3633`
- `--color-error` — `#ef4444` — Semantic
- `--color-success` — `#10b981`
- `--radius-btn` — `10px` — Shape
- `--radius-card` — `14px`
- `--shadow-card` — `0 2px 12px rgba(0, 0, 0, 0.35)`
- `--shadow-card-md` — `0 8px 32px rgba(0, 0, 0, 0.5)`
- `--section-spacing` — `64px` — Spacing
- `--font-family` — `'Onest', -apple-system, BlinkMacSystemFont, 'Sego…` — Typography
- `--heading-font-family` — `'Unbounded', sans-serif`
- `--ctrl-h` — `44px` — Control sizes
- `--ctrl-px` — `20px`
- `--ctrl-fs` — `16px`
- `--ctrl-gap` — `8px`
- `--ctrl-icon` — `18px`
- `--z-sticky` — `200` — Z-index
- `--z-overlay` — `300`
- `--z-modal` — `400`
- `--z-toast` — `500`
- `--section-spacing` — `80px`
- `--section-spacing` — `100px`

## `assets/styles/_mixins.scss`

**Миксины**:
- `@mixin sm`
- `@mixin md`
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

