<template>
  <component :is="as" class="section-root">
    <div class="container">
      <slot />
    </div>
  </component>
</template>
<script setup lang="ts">
type Props = {
  as?: string
}

withDefaults(defineProps<Props>(), {
  as: 'section',
})
</script>
<style scoped lang="scss">
@use '../../styles/mixins' as *;

.section-root {
  width: 100%;
  padding-block: var(--section-spacing);
}

.container {
  width: 100%;
  max-width: 1280px;
  margin-inline: auto;
  padding-inline: 16px;
  @include safe-area-horizontal(16px);
  box-sizing: border-box;

  @include md {
    padding-inline: 32px;
  }

  @include lg {
    padding-inline: 48px;
  }
}
</style>
