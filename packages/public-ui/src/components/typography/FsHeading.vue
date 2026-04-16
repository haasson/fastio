<template>
  <component
    :is="as"
    class="heading-root"
    :class="[`size-${effectiveSize}`, `align-${align}`, `color-${color}`]"
    :style="weight ? { fontWeight: weight } : undefined"
  >
    <slot />
  </component>
</template>
<script setup lang="ts">
import { computed } from 'vue'

type HeadingSize = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

type Props = {
  as?: HeadingSize
  size?: HeadingSize
  align?: 'left' | 'center' | 'right'
  color?: 'default' | 'primary' | 'muted' | 'inherit'
  weight?: 400 | 500 | 600 | 700 | 800
}

const props = withDefaults(defineProps<Props>(), {
  as: 'h2',
  align: 'left',
  color: 'default',
})

const effectiveSize = computed((): HeadingSize => props.size ?? props.as ?? 'h2')
</script>
<style scoped lang="scss">
@use '../../styles/mixins' as *;

.heading-root {
  margin: 0;
  font-family: var(--heading-font-family, var(--font-family, inherit));
}

// ─── Align ───────────────────────────────────────────────────────────────────
.align-left   { text-align: left; }
.align-center { text-align: center; }
.align-right  { text-align: right; }

// ─── Colors ──────────────────────────────────────────────────────────────────
.color-default  { color: var(--color-text); }
.color-primary  { color: var(--primary); }
.color-muted    { color: var(--color-text-muted); }
.color-inherit  { color: inherit; }

// ─── Sizes по классу ─────────────────────────────────────────────────────────
.size-h1 {
  font-size: 32px;
  line-height: 1.2;
  font-weight: 700;

  @include lg { font-size: 48px; line-height: 1.15; }
}

.size-h2 {
  font-size: 26px;
  line-height: 1.25;
  font-weight: 700;

  @include lg { font-size: 36px; line-height: 1.2; }
}

.size-h3 {
  font-size: 22px;
  line-height: 1.3;
  font-weight: 600;

  @include lg { font-size: 28px; line-height: 1.25; }
}

.size-h4 {
  font-size: 18px;
  line-height: 1.35;
  font-weight: 600;

  @include lg { font-size: 22px; line-height: 1.3; }
}

.size-h5,
.size-h6 {
  font-size: 16px;
  line-height: 1.4;
  font-weight: 600;

  @include lg { font-size: 18px; line-height: 1.35; }
}
</style>
