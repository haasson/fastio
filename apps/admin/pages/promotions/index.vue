<template>
  <div class="promotions-root">
    <div class="toolbar">
      <UiTabs v-model="activeTab" :tabs="tabs" />
      <UiButton
        v-if="activeTab !== 'banners'"
        type="primary"
        icon="plus"
        @click="openAdd"
      >
        Добавить
      </UiButton>
      <UiButton
        v-else
        type="primary"
        icon="plus"
        @click="openAddBanner"
      >
        Добавить баннер
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
    <template v-else-if="activeTab === 'promo-codes'">
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

    <!-- Баннеры -->
    <template v-else>
      <UiSkeleton v-if="bannersLoading" :height="72" :count="3" />

      <UiEmpty
        v-else-if="banners.length === 0"
        icon="image"
        text="Баннеров пока нет. Добавьте первый — он появится в карусели на главной."
      />

      <VueDraggable
        v-else
        v-model="banners"
        class="banner-list"
        handle=".drag-handle"
        :animation="180"
        ghost-class="row-ghost"
        @end="onBannersReorder"
      >
        <div v-for="banner in banners" :key="banner.id" class="banner-row">
          <UiIcon name="grip" class="drag-handle" />

          <div class="banner-thumb">
            <img
              v-if="banner.url"
              :src="banner.url"
              alt=""
              class="thumb-img"
            />
            <div v-else class="thumb-empty">
              <UiIcon name="image" :size="14" color="var(--color-text-tertiary)" />
            </div>
          </div>

          <div class="banner-meta">
            <UiText size="small" :color="banner.enabled ? undefined : 'var(--color-text-tertiary)'">
              {{ bannerLinkLabel(banner) }}
            </UiText>
          </div>

          <UiSwitch
            :model-value="banner.enabled"
            @update:model-value="bannersToggle(banner.id, $event)"
          />

          <AppActionsBlock
            size="small"
            @edit="openEditBanner(banner)"
            @delete="handleRemoveBanner(banner)"
          />
        </div>
      </VueDraggable>
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

    <BannerFormModal
      v-model="showBannerModal"
      :banner="editingBanner"
      :promotions="promotions"
      :promo-codes="promoCodes"
      :pages="tenantStore.tenant?.siteLayout.pages ?? []"
      :saving="bannerSaving"
      @save="handleSaveBanner"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { UiButton, UiDataTable, UiEmpty, UiInput, UiSkeleton, UiSwitch, UiTabs, UiText, UiIcon } from '@fastio/ui'
import AppActionsBlock from '~/components/ui/AppActionsBlock.vue'
import { useConfirm } from '@fastio/kit'
import type { Banner, BannerFormData, Promotion, PromotionFormData, PromoCode, PromoCodeFormData } from '@fastio/shared'
import { featureLabel } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { usePromotions } from '~/composables/data/usePromotions'
import { usePromoCodes } from '~/composables/data/usePromoCodes'
import { useBanners } from '~/composables/data/useBanners'
import PromotionFormModal from '~/components/promotions/PromotionFormModal.vue'
import PromoCodeFormModal from '~/components/promotions/PromoCodeFormModal.vue'
import BannerFormModal from '~/components/promotions/BannerFormModal.vue'
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

const {
  banners,
  loading: bannersLoading,
  add: bannersAdd,
  update: bannersUpdate,
  remove: bannersRemove,
  toggleEnabled: bannersToggle,
  reorder: bannersReorder,
  uploadImage: bannersUploadImage,
} = useBanners(tenantId)

const tabs = [
  { value: 'promotions', label: 'Акции' },
  { value: 'promo-codes', label: 'Промокоды' },
  { value: 'banners', label: 'Баннеры' },
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

// ─── Banners drag-and-drop ────────────────────────────────────

const onBannersReorder = () => {
  bannersReorder(banners.value)
}

const bannerLinkLabel = (banner: Banner): string => {
  if (banner.promotionId) {
    const p = promotions.value.find((pr) => pr.id === banner.promotionId)

    return p ? `Акция: ${p.title}` : 'Акция'
  }
  if (banner.promoCodeId) {
    const c = promoCodes.value.find((pc) => pc.id === banner.promoCodeId)

    return c ? `Промокод: ${c.code}` : 'Промокод'
  }
  if (banner.page) return `Страница: ${featureLabel(banner.page)}`
  if (banner.link) return `Ссылка: ${banner.link}`

  return 'Без ссылки'
}

// ─── Modals ───────────────────────────────────────────────────

const showPromotionModal = ref(false)
const showPromoCodeModal = ref(false)
const showBannerModal = ref(false)
const editingPromotion = ref<Promotion | null>(null)
const editingPromoCode = ref<PromoCode | null>(null)
const editingBanner = ref<Banner | null>(null)
const promotionSaving = ref(false)
const promoCodeSaving = ref(false)
const bannerSaving = ref(false)

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

const openAddBanner = () => {
  editingBanner.value = null
  showBannerModal.value = true
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

const openEditBanner = (banner: Banner) => {
  editingBanner.value = banner
  showBannerModal.value = true
}

// ─── Save handlers ────────────────────────────────────────────

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

const handleSaveBanner = async (data: BannerFormData, file: File | null) => {
  bannerSaving.value = true
  try {
    if (editingBanner.value) {
      if (file) {
        const url = await bannersUploadImage(editingBanner.value.id, file)

        await bannersUpdate(editingBanner.value.id, { ...data, url })
      } else {
        await bannersUpdate(editingBanner.value.id, data)
      }
    } else {
      const banner = await bannersAdd({ ...data, url: '', enabled: false })

      if (banner && file) {
        const url = await bannersUploadImage(banner.id, file)

        await bannersUpdate(banner.id, { url, enabled: data.enabled })
      }
    }
    showBannerModal.value = false
  } finally {
    bannerSaving.value = false
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

const handleRemoveBanner = async (banner: Banner) => {
  const ok = await confirm({ title: 'Удалить баннер?' })

  if (ok) await bannersRemove(banner.id)
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

.banner-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.banner-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);

  &:hover { background: var(--color-bg-hover); }
}

.drag-handle {
  cursor: grab;
  color: var(--color-text-tertiary);
  flex-shrink: 0;

  &:active { cursor: grabbing; }
}

.banner-thumb {
  width: 96px;
  height: 32px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumb-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.banner-meta {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

:deep(.row-ghost) {
  opacity: 0.4;
}
</style>
