<template>
  <UiModal
    :model-value="modelValue"
    title="Чем занимается ваш бизнес?"
    :closable="false"
    :width="480"
    :mask-closable="false"
  >
    <div class="content">
      <UiText size="small" class="hint">
        Это поможет настроить интерфейс под вашу сферу. Всегда можно изменить в настройках.
      </UiText>

      <div class="options">
        <button
          v-for="option in options"
          :key="option.type"
          class="option"
          :class="{ loading: saving === option.type }"
          :disabled="!!saving"
          @click="select(option.type)"
        >
          <span class="option-icon">{{ option.emoji }}</span>
          <div class="option-body">
            <UiText size="medium" class="option-title">{{ option.title }}</UiText>
            <UiText size="small" class="option-desc">{{ option.desc }}</UiText>
          </div>
        </button>
      </div>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { UiModal, UiText } from '@fastio/ui'
import type { BusinessType } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'

defineProps<{ modelValue: boolean }>()

const tenantStore = useTenantStore()
const saving = ref<BusinessType | null>(null)

const options: { type: BusinessType; emoji: string; title: string; desc: string }[] = [
  {
    type: 'food',
    emoji: '🍕',
    title: 'Общепит',
    desc: 'Кафе, ресторан, столовая, доставка еды',
  },
  {
    type: 'retail',
    emoji: '🛍️',
    title: 'Магазин',
    desc: 'Интернет-магазин, розница, товары на заказ',
  },
  {
    type: 'services',
    emoji: '✂️',
    title: 'Услуги',
    desc: 'Красота, образование, ремонт, любые сервисы',
  },
]

const select = async (type: BusinessType) => {
  if (saving.value) return
  saving.value = type
  try {
    await tenantStore.update({ businessType: type })
  } finally {
    saving.value = null
  }
}
</script>

<style scoped lang="scss">
.content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hint {
  color: var(--color-text-secondary);
}

.options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1.5px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-card);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;

  &:hover:not(:disabled) {
    border-color: var(--color-primary);
    background: var(--color-bg-hover);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &.loading {
    opacity: 1;
    border-color: var(--color-primary);
  }
}

.option-icon {
  font-size: 28px;
  line-height: 1;
  flex-shrink: 0;
}

.option-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-title {
  font-weight: 600;
  color: var(--color-text-primary);
}

.option-desc {
  color: var(--color-text-secondary);
}
</style>
