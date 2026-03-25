<template>
  <div class="tab-root">
    <div class="toolbar">
      <UiButton
        type="primary"
        icon="plus"
        class="add-btn"
        @click="openAdd"
      >
        Добавить баннер
      </UiButton>
    </div>

    <UiSkeleton v-if="loading" :height="72" :count="3" />

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
      @end="onReorder"
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
            {{ linkLabel(banner) }}
          </UiText>
        </div>

        <UiSwitch
          :model-value="banner.enabled"
          @update:model-value="toggleEnabled(banner.id, $event)"
        />

        <AppActionsBlock
          size="small"
          @edit="openEdit(banner)"
          @delete="handleRemove(banner)"
        />
      </div>
    </VueDraggable>

    <BannerFormModal
      v-model="showModal"
      :banner="editing"
      :promotions="promotions"
      :promo-codes="promoCodes"
      :pages="tenantStore.tenant?.siteLayout.pages ?? []"
      :saving="saving"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { UiButton, UiEmpty, UiIcon, UiSkeleton, UiSwitch, UiText } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { Banner, BannerFormData } from '@fastio/shared'
import { featureLabel } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBanners } from '~/composables/data/useBanners'
import { usePromotions } from '~/composables/data/usePromotions'
import { usePromoCodes } from '~/composables/data/usePromoCodes'
import AppActionsBlock from '~/components/ui/AppActionsBlock.vue'
import BannerFormModal from '~/components/promotions/BannerFormModal.vue'

const tenantStore = useTenantStore()
const tenantId = computed(() => tenantStore.tenant?.id ?? '')

const { banners, loading, add, update, remove, toggleEnabled, reorder, uploadImage } = useBanners(tenantId)
const { promotions } = usePromotions(tenantId)
const { promoCodes } = usePromoCodes(tenantId)

const showModal = ref(false)
const editing = ref<Banner | null>(null)
const saving = ref(false)

const { confirm } = useConfirm()

const onReorder = () => reorder(banners.value)

const linkLabel = (banner: Banner): string => {
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

const openAdd = () => {
  editing.value = null
  showModal.value = true
}

const openEdit = (banner: Banner) => {
  editing.value = banner
  showModal.value = true
}

const handleSave = async (data: BannerFormData, file: File | null) => {
  saving.value = true
  try {
    if (editing.value) {
      if (file) {
        const url = await uploadImage(editing.value.id, file)

        await update(editing.value.id, { ...data, url })
      } else {
        await update(editing.value.id, data)
      }
    } else {
      const banner = await add({ ...data, url: '', enabled: false })

      if (banner && file) {
        const url = await uploadImage(banner.id, file)

        await update(banner.id, { url, enabled: data.enabled })
      }
    }
    showModal.value = false
  } finally {
    saving.value = false
  }
}

const handleRemove = async (banner: Banner) => {
  const ok = await confirm({ title: 'Удалить баннер?' })

  if (ok) await remove(banner.id)
}
</script>

<style scoped lang="scss">
.tab-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
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

:deep(.row-ghost) {
  opacity: 0.4;
}
</style>
