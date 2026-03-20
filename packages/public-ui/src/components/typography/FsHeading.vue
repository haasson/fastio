<template>
  <component
    :is="as"
    class="heading-root"
    :class="[`align-${align}`, `color-${color}`]"
  >
    <slot />
  </component>
</template>
<script setup lang="ts">
type Props = {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  align?: 'left' | 'center' | 'right'
  color?: 'default' | 'primary' | 'muted'
}

withDefaults(defineProps<Props>(), {
  as: 'h2',
  align: 'left',
  color: 'default',
})
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
.color-default { color: var(--color-text); }
.color-primary { color: var(--primary); }
.color-muted   { color: var(--color-text-muted); }

// ─── Sizes по тегу ───────────────────────────────────────────────────────────
h1.heading-root {
  font-size: 32px;
  line-height: 1.2;
  font-weight: 700;

  @include lg { font-size: 48px; line-height: 1.15; }
}

h2.heading-root {
  font-size: 26px;
  line-height: 1.25;
  font-weight: 700;

  @include lg { font-size: 36px; line-height: 1.2; }
}

h3.heading-root {
  font-size: 22px;
  line-height: 1.3;
  font-weight: 600;

  @include lg { font-size: 28px; line-height: 1.25; }
}

h4.heading-root {
  font-size: 18px;
  line-height: 1.35;
  font-weight: 600;

  @include lg { font-size: 22px; line-height: 1.3; }
}

h5.heading-root,
h6.heading-root {
  font-size: 16px;
  line-height: 1.4;
  font-weight: 600;

  @include lg { font-size: 18px; line-height: 1.35; }
}
</style>
