<template>
  <div class="footer">
    <SfStepper v-model="qty" :min="1" :max="99" />
    <SfButton variant="primary" class="add-btn" @click="emit('confirm')">
      {{ confirmLabel }} за {{ totalPrice }} {{ currency }}
    </SfButton>
  </div>
</template>

<script setup lang="ts">
import SfStepper from '~/components/sf/domain/SfStepper.vue'
import SfButton from '~/components/sf/base/SfButton.vue'

type Props = {
  modelValue: number
  totalPrice: string
  currency: string
  mode?: 'add' | 'edit'
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

const confirmLabel = computed(() => props.mode === 'edit' ? 'Сохранить' : 'Добавить')
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
