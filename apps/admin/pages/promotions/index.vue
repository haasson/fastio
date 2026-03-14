<template>
  <div class="promotions-root">
    <div class="toolbar">
      <UiTabs v-model="activeTab" :tabs="tabs" />
      <UiButton type="primary" icon="plus" @click="openAdd">
        Добавить
      </UiButton>
    </div>

    <!-- Акции -->
    <template v-if="activeTab === 'promotions'">
      <div v-if="promotionsLoading" class="loading">
        <UiSkeleton :height="56" :count="3" />
      </div>

      <UiEmpty
        v-else-if="promotions.length === 0"
        icon="promotions"
        text="Акций пока нет. Создайте первую — например скидку в happy hour."
      />

      <div v-else class="list">
        <div v-for="promo in promotions" :key="promo.id" class="row">
          <div class="row-main">
            <span class="title">{{ promo.title }}</span>
            <UiTag :type="effectiveStatus(promo).type" size="small">
              {{ effectiveStatus(promo).label }}
            </UiTag>
            <span v-if="promo.type === 'free_item'" class="discount">
              🎁 {{ promo.conditions.freeDishName ?? '—' }}
            </span>
            <span v-else class="discount">
              {{ promo.discountType === 'percent' ? `−${promo.discountValue}%` : `−${promo.discountValue} ₽` }}
            </span>
            <span class="meta">{{ typeLabel(promo) }}</span>
          </div>

          <div class="row-meta">
            <span v-if="promo.activeFrom || promo.activeTo" class="dates">
              <template v-if="promo.activeFrom">с {{ formatDate(promo.activeFrom) }}</template>
              <template v-if="promo.activeTo"> по {{ formatDate(promo.activeTo) }}</template>
            </span>
          </div>

          <div class="row-actions">
            <UiSwitch
              :model-value="promo.active"
              @update:model-value="promotionsToggle(promo.id, $event)"
            />
            <UiButton size="tiny" type="default" @click="openEdit(promo)">
              Изменить
            </UiButton>
            <UiButton size="tiny" type="text" @click="handleRemovePromotion(promo)">
              ✕
            </UiButton>
          </div>
        </div>
      </div>
    </template>

    <!-- Промокоды -->
    <template v-else>
      <div v-if="promoCodesLoading" class="loading">
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
              @update:model-value="promoCodesToggle(promo.id, $event)"
            />
            <UiButton size="tiny" type="default" @click="openEdit(promo)">
              Изменить
            </UiButton>
            <UiButton size="tiny" type="text" @click="handleRemovePromoCode(promo)">
              ✕
            </UiButton>
          </div>
        </div>
      </div>
    </template>

    <PromotionFormModal
      v-model="showPromotionModal"
      :promotion="editingPromotion"
      :tenant-id="tenantId"
      :saving="promotionSaving"
      @save="handleSavePromotion"
    />

    <PromoCodeFormModal
      v-model="showPromoCodeModal"
      :promo-code="editingPromoCode"
      :saving="promoCodeSaving"
      @save="handleSavePromoCode"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { UiButton, UiEmpty, UiSkeleton, UiSwitch, UiTag, UiTabs } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { Promotion, PromotionFormData, PromoCode, PromoCodeFormData } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { usePromotions } from '~/composables/data/usePromotions'
import { usePromoCodes } from '~/composables/data/usePromoCodes'
import PromotionFormModal from '~/components/promotions/PromotionFormModal.vue'
import PromoCodeFormModal from '~/components/promotions/PromoCodeFormModal.vue'

const tenantStore = useTenantStore()

onMounted(() => tenantStore.init())

const tenantId = computed(() => tenantStore.tenant?.id ?? '')

const { promotions, loading: promotionsLoading, add: promotionsAdd, update: promotionsUpdate, remove: promotionsRemove, toggleActive: promotionsToggle } = usePromotions(tenantId)
const { promoCodes, loading: promoCodesLoading, add: promoCodesAdd, update: promoCodesUpdate, remove: promoCodesRemove, toggleActive: promoCodesToggle } = usePromoCodes(tenantId)

const tabs = [
  { value: 'promotions', label: 'Акции' },
  { value: 'promo-codes', label: 'Промокоды' },
]
const activeTab = ref('promotions')

const showPromotionModal = ref(false)
const showPromoCodeModal = ref(false)
const editingPromotion = ref<Promotion | null>(null)
const editingPromoCode = ref<PromoCode | null>(null)
const promotionSaving = ref(false)
const promoCodeSaving = ref(false)

const { confirm } = useConfirm()

const openAdd = () => {
  if (activeTab.value === 'promotions') {
    editingPromotion.value = null
    showPromotionModal.value = true
  } else {
    editingPromoCode.value = null
    showPromoCodeModal.value = true
  }
}

const openEdit = (item: Promotion | PromoCode) => {
  if (activeTab.value === 'promotions') {
    editingPromotion.value = item as Promotion
    showPromotionModal.value = true
  } else {
    editingPromoCode.value = item as PromoCode
    showPromoCodeModal.value = true
  }
}

const handleSavePromotion = async (data: PromotionFormData) => {
  promotionSaving.value = true
  try {
    if (editingPromotion.value) {
      await promotionsUpdate(editingPromotion.value.id, data)
    } else {
      await promotionsAdd(data)
    }
    showPromotionModal.value = false
  } finally {
    promotionSaving.value = false
  }
}

const handleSavePromoCode = async (data: PromoCodeFormData) => {
  promoCodeSaving.value = true
  try {
    if (editingPromoCode.value) {
      await promoCodesUpdate(editingPromoCode.value.id, data)
    } else {
      await promoCodesAdd(data)
    }
    showPromoCodeModal.value = false
  } finally {
    promoCodeSaving.value = false
  }
}

const handleRemovePromotion = async (promo: Promotion) => {
  const ok = await confirm({ title: `Удалить акцию «${promo.title}»?` })

  if (ok) await promotionsRemove(promo.id)
}

const handleRemovePromoCode = async (promo: PromoCode) => {
  const ok = await confirm({ title: `Удалить промокод «${promo.code}»?` })

  if (ok) await promoCodesRemove(promo.id)
}

const effectiveStatus = (promo: Promotion | PromoCode) => {
  if (!promo.active) return { type: 'error' as const, label: 'Выключен' }
  const now = Date.now()

  if (promo.activeFrom && new Date(promo.activeFrom).getTime() > now) return { type: 'primary' as const, label: 'Запланирован' }
  if (promo.activeTo && new Date(promo.activeTo).getTime() < now) return { type: 'warning' as const, label: 'Истёк' }

  return { type: 'success' as const, label: 'Активен' }
}

const PROMOTION_TYPE_LABELS: Record<string, string> = {
  min_order: 'от суммы заказа',
  happy_hour: 'happy hour',
  weekday: 'по дням недели',
  first_order: 'первый заказ',
  free_item: 'блюдо в подарок',
}

const typeLabel = (promo: Promotion) => PROMOTION_TYPE_LABELS[promo.type] ?? promo.type

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
</script>

<style scoped lang="scss">
.promotions-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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

.title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
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
