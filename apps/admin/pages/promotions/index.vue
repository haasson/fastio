<template>
  <div class="promotions-root">
    <div class="header">
      <UiButton type="primary" icon="plus" @click="openAdd">
        Добавить
      </UiButton>
    </div>

    <div v-if="loading" class="loading">
      <UiSkeleton :height="56" :count="3" />
    </div>

    <UiEmpty
      v-else-if="promoCodes.length === 0"
      icon="promotions"
      text="Промокодов пока нет. Создайте первый — например WELCOME10 на скидку 10%."
    />

    <div v-else class="list">
      <div v-for="promo in promoCodes" :key="promo.id" class="row">
        <div class="row-main">
          <span class="code">{{ promo.code }}</span>
          <UiTag :type="effectiveStatus(promo).type" size="small">
            {{ effectiveStatus(promo).label }}
          </UiTag>
          <span class="discount">
            {{ promo.discountType === 'percent' ? `−${promo.discountValue}%` : `−${promo.discountValue} ₽` }}
          </span>
          <span v-if="promo.minOrderAmount" class="meta">от {{ promo.minOrderAmount }} ₽</span>
        </div>

        <div class="row-meta">
          <span class="usage">
            {{ promo.usedCount }}{{ promo.usageLimit != null ? ` / ${promo.usageLimit}` : '' }} исп.
          </span>
          <span v-if="promo.activeFrom || promo.activeTo" class="dates">
            <template v-if="promo.activeFrom">с {{ formatDate(promo.activeFrom) }}</template>
            <template v-if="promo.activeTo"> по {{ formatDate(promo.activeTo) }}</template>
          </span>
        </div>

        <div class="row-actions">
          <UiSwitch
            :model-value="promo.active"
            @update:model-value="toggleActive(promo.id, $event)"
          />
          <UiButton size="tiny" type="default" @click="openEdit(promo)">
            Изменить
          </UiButton>
          <UiButton size="tiny" type="text" @click="handleRemove(promo)">
            ✕
          </UiButton>
        </div>
      </div>
    </div>

    <PromoCodeFormModal
      v-model="showModal"
      :promo-code="editingPromoCode"
      :saving="saving"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { UiButton, UiEmpty, UiSkeleton, UiSwitch, UiTag } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { PromoCode, PromoCodeFormData } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { usePromoCodes } from '~/composables/data/usePromoCodes'
import PromoCodeFormModal from '~/components/promotions/PromoCodeFormModal.vue'

const tenantStore = useTenantStore()

onMounted(() => tenantStore.init())

const tenantId = computed(() => tenantStore.tenant?.id ?? '')
const { promoCodes, loading, add, update, remove, toggleActive } = usePromoCodes(tenantId)

const showModal = ref(false)
const editingPromoCode = ref<PromoCode | null>(null)
const saving = ref(false)

const { confirm } = useConfirm()

const openAdd = () => {
  editingPromoCode.value = null
  showModal.value = true
}

const openEdit = (promo: PromoCode) => {
  editingPromoCode.value = promo
  showModal.value = true
}

const handleSave = async (data: PromoCodeFormData) => {
  saving.value = true
  try {
    if (editingPromoCode.value) {
      await update(editingPromoCode.value.id, data)
    } else {
      await add(data)
    }
    showModal.value = false
  } finally {
    saving.value = false
  }
}

const handleRemove = async (promo: PromoCode) => {
  const ok = await confirm({ title: `Удалить промокод «${promo.code}»?` })

  if (ok) await remove(promo.id)
}

const effectiveStatus = (promo: PromoCode) => {
  if (!promo.active) return { type: 'error' as const, label: 'Выключен' }
  const now = Date.now()

  if (promo.activeFrom && new Date(promo.activeFrom).getTime() > now) return { type: 'primary' as const, label: 'Запланирован' }
  if (promo.activeTo && new Date(promo.activeTo).getTime() < now) return { type: 'warning' as const, label: 'Истёк' }

  return { type: 'success' as const, label: 'Активен' }
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
</script>

<style scoped lang="scss">
.promotions-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header {
  display: flex;
  justify-content: flex-end;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  flex-wrap: wrap;
}

.row-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.code {
  font-family: monospace;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: 0.04em;
}

.discount {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-success);
}

.meta {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.row-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.usage {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.dates {
  font-size: 13px;
  color: var(--color-text-hint);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.loading {
  padding: 8px 0;
}
</style>
