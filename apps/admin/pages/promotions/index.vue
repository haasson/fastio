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
      <UiSkeleton v-if="promotionsLoading" :height="56" :count="3" />

      <UiEmpty
        v-else-if="promotions.length === 0"
        icon="promotions"
        text="Акций пока нет. Создайте первую — например скидку в happy hour."
      />

      <template v-else>
        <UiInput
          v-model:value="promotionSearch"
          placeholder="Поиск по названию..."
          clearable
          class="search"
        />

        <UiDataTable
          :columns="promotionColumns"
          :data="filteredPromotions"
          :row-key="(row) => row.id"
          :bordered="false"
          size="small"
        />
      </template>
    </template>

    <!-- Промокоды -->
    <template v-else>
      <UiSkeleton v-if="promoCodesLoading" :height="56" :count="3" />

      <UiEmpty
        v-else-if="promoCodes.length === 0"
        icon="promotions"
        text="Промокодов пока нет. Создайте первый — например WELCOME10 на скидку 10%."
      />

      <template v-else>
        <UiInput
          v-model:value="search"
          placeholder="Поиск по коду..."
          clearable
          class="search"
        />

        <UiDataTable
          :columns="promoCodeColumns"
          :data="filteredPromoCodes"
          :row-key="(row) => row.id"
          :bordered="false"
          size="small"
        />
      </template>
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
import { UiButton, UiDataTable, UiEmpty, UiInput, UiSkeleton, UiTabs } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { Promotion, PromotionFormData, PromoCode, PromoCodeFormData } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { usePromotions } from '~/composables/data/usePromotions'
import { usePromoCodes } from '~/composables/data/usePromoCodes'
import PromotionFormModal from '~/components/promotions/PromotionFormModal.vue'
import PromoCodeFormModal from '~/components/promotions/PromoCodeFormModal.vue'
import { buildPromotionColumns } from '~/columns/promotions'
import { buildPromoCodeColumns } from '~/columns/promo-codes'

const tenantStore = useTenantStore()

onMounted(() => tenantStore.init())

const tenantId = computed(() => tenantStore.tenant?.id ?? '')

const {
  promotions,
  loading: promotionsLoading,
  add: promotionsAdd,
  update: promotionsUpdate,
  remove: promotionsRemove,
  toggleActive: promotionsToggle,
} = usePromotions(tenantId)

const {
  promoCodes,
  loading: promoCodesLoading,
  add: promoCodesAdd,
  update: promoCodesUpdate,
  remove: promoCodesRemove,
  toggleActive: promoCodesToggle,
} = usePromoCodes(tenantId)

const tabs = [
  { value: 'promotions', label: 'Акции' },
  { value: 'promo-codes', label: 'Промокоды' },
]
const activeTab = ref('promotions')

const promotionSearch = ref('')
const search = ref('')

const filteredPromotions = computed(() => {
  const q = promotionSearch.value.trim().toLowerCase()

  if (!q) return promotions.value

  return promotions.value.filter((p) => p.title.toLowerCase().includes(q))
})

const filteredPromoCodes = computed(() => {
  const q = search.value.trim().toLowerCase()

  if (!q) return promoCodes.value

  return promoCodes.value.filter((p) => p.code.toLowerCase().includes(q))
})

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

const promotionColumns = buildPromotionColumns({
  onToggle: promotionsToggle,
  onEdit: openEdit,
  onRemove: handleRemovePromotion,
})

const promoCodeColumns = buildPromoCodeColumns({
  onToggle: promoCodesToggle,
  onEdit: openEdit,
  onRemove: handleRemovePromoCode,
})

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

.search {
  max-width: 320px;
}

:deep(.promo-title-cell) {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

:deep(.promo-title) {
  font-weight: 600;
  font-size: 14px;
}

:deep(.promo-code-text) {
  font-family: monospace;
  font-weight: 700;
  letter-spacing: 0.04em;
}
</style>
