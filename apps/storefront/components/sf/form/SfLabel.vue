<template>
  <label
    class="label-root"
    :class="`size-${size}`"
    :for="for"
  >
    <slot />
    <span v-if="required" class="required">*</span>
  </label>
</template>
<script setup lang="ts">
type Props = {
  for?: string
  required?: boolean
  size?: 'sm' | 'md'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  required: false,
})
</script>
<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;
.label-root {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-weight: 500;
  color: var(--color-text);
  line-height: 1.4;
}

.size-sm {
  font-size: 12px;
}

.size-md {
  font-size: 13px;
}

.required {
  color: var(--color-error, #ef4444);
  font-weight: 500;
}
</style>
