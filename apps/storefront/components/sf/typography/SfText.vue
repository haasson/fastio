<template>
  <component
    :is="as"
    class="text-root"
    :class="[
      variantClass,
      `align-${align}`,
      `color-${color}`,
      { 'is-responsive': responsive, 'is-truncate': truncate },
    ]"
    :style="clampStyle"
  >
    <slot />
  </component>
</template>
<script setup lang="ts">
import { computed } from 'vue'
type TextVariant = 'body' | 'body-sm' | 'caption' | 'label' | 'overline'
type TextColor = 'default' | 'secondary' | 'muted' | 'primary' | 'error' | 'success'

type Props = {
  as?: string
  variant?: TextVariant
  responsive?: boolean
  color?: TextColor
  align?: 'left' | 'center' | 'right'
  truncate?: boolean
  lines?: number
}

const props = withDefaults(defineProps<Props>(), {
  as: 'p',
  variant: 'body',
  responsive: false,
  color: 'default',
  align: 'left',
  truncate: false,
  lines: 0,
})

const clampStyle = computed(() => {
  if (props.lines > 0) {
    return {
      display: '-webkit-box',
      '-webkit-box-orient': 'vertical',
      '-webkit-line-clamp': String(props.lines),
      overflow: 'hidden',
    }
  }
  return {}
})

// Преобразуем variant в CSS-класс (body-sm → variant-body-sm)
const variantClass = computed(() => `variant-${props.variant}`)
</script>
<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.text-root {
  margin: 0;
  font-family: var(--font-family, inherit);
}

// ─── Align ───────────────────────────────────────────────────────────────────
.align-left   { text-align: left; }
.align-center { text-align: center; }
.align-right  { text-align: right; }

// ─── Colors ──────────────────────────────────────────────────────────────────
.color-default   { color: var(--color-text); }
.color-secondary { color: var(--color-text-secondary); }
.color-muted     { color: var(--color-text-muted); }
.color-primary   { color: var(--primary); }
.color-error     { color: var(--color-error, #ef4444); }
.color-success   { color: var(--color-success, #10b981); }

// ─── Truncate ────────────────────────────────────────────────────────────────
.is-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// ─── Variants ────────────────────────────────────────────────────────────────
.variant-body {
  font-size: 16px;
  line-height: 1.6;
  font-weight: 400;

  @include lg { font-size: 18px; }
}

.variant-body-sm {
  font-size: 14px;
  line-height: 1.5;
  font-weight: 400;

  @include lg { font-size: 16px; line-height: 1.6; }
}

.variant-caption {
  font-size: 12px;
  line-height: 1.45;
  font-weight: 400;

  @include lg { font-size: 14px; line-height: 1.5; }
}

.variant-label {
  font-size: 14px;
  line-height: 1.4;
  font-weight: 500;

  @include lg { font-size: 16px; }
}

.variant-overline {
  font-size: 12px;
  line-height: 1.3;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;

  @include lg { font-size: 14px; }
}
</style>
