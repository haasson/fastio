<template>
  <div
    v-if="$slots.default"
    class="divider-root with-title"
    :class="[`title-${titlePlacement}`, { dashed }]"
    role="separator"
  >
    <span class="line" />
    <span class="title"><slot /></span>
    <span class="line" />
  </div>
  <div
    v-else
    class="divider-root"
    :class="{ vertical, dashed }"
    role="separator"
    :aria-orientation="vertical ? 'vertical' : 'horizontal'"
  />
</template>

<script setup lang="ts">
type Props = {
  vertical?: boolean
  dashed?: boolean
  titlePlacement?: 'left' | 'center' | 'right'
}

withDefaults(defineProps<Props>(), {
  vertical: false,
  dashed: false,
  titlePlacement: 'center',
})
</script>

<style scoped lang="scss">
.divider-root {
  &:not(.with-title):not(.vertical) {
    width: 100%;
    height: 2px;
    margin: var(--space-16) 0;
    background-color: var(--color-border);
  }

  &.vertical {
    display: inline-block;
    width: 0;
    height: 1em;
    margin: 0 var(--space-8);
    border-left: 1px solid var(--color-border);
    vertical-align: middle;
  }

  &.dashed:not(.with-title):not(.vertical) {
    height: 0;
    background: none;
    border-top: 1px dashed var(--color-border);
  }

  &.vertical.dashed {
    border-left-style: dashed;
  }

  &.with-title {
    display: flex;
    align-items: center;
    gap: 24px;
    margin: var(--space-16) 0;

    .line {
      flex: 1;
      height: 2px;
      background-color: var(--color-border);
    }

    &.dashed .line {
      height: 0;
      background: none;
      border-top: 1px dashed var(--color-border);
    }

    .title {
      color: var(--color-text-secondary);
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-regular);
      white-space: nowrap;
    }

    &.title-left .line:first-child { flex: 0 0 var(--space-16); }
    &.title-right .line:last-child { flex: 0 0 var(--space-16); }
  }
}
</style>
