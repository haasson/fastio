<template>
  <div class="footer">
    <SfStepper v-model="qty" :min="1" :max="99" />
    <FsButton variant="primary" class="add-btn" @click="emit('confirm')">
      {{ confirmLabel }} за {{ formatPrice(totalPrice) }}
    </FsButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SfStepper from '~/shared/ui/sf/domain/SfStepper.vue'
import { FsButton } from '@fastio/public-ui'
import { formatPrice } from '@fastio/shared'

type Props = {
  modelValue: number
  totalPrice: number
  mode?: 'add' | 'edit' | 'order'
}

const props = withDefaults(defineProps<Props>(), { mode: 'add' })

const emit = defineEmits<{
  'update:modelValue': [value: number]
  'confirm': []
}>()

const qty = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const confirmLabel = computed(() => {
  if (props.mode === 'edit') return 'Сохранить'
  if (props.mode === 'order') return 'Заказать'
  return 'Добавить'
})
</script>

<style scoped lang="scss">
.footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.add-btn {
  flex: 1;
}
</style>
