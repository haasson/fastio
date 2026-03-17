<template>
  <div class="field-root">
    <SfLabel v-if="label" :required="required" :size="size" class="field-label">
      {{ label }}
    </SfLabel>
    <slot />
    <p v-if="error" class="field-error">{{ error }}</p>
    <p v-else-if="hint" class="field-hint">{{ hint }}</p>
  </div>
</template>
<script setup lang="ts">
import SfLabel from '~/components/sf/form/SfLabel.vue'

type Props = {
  label?: string
  hint?: string
  error?: string
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
.field-root {
  display: flex;
  flex-direction: column;
}

.field-label {
  margin-bottom: 6px;
}

.field-error {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--color-error, #ef4444);
  line-height: 1.4;
}

.field-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.4;
}
</style>
