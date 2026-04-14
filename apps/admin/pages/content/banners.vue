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

    <AppDraggableList
      v-else
      v-model="banners"
      @reorder="onReorder"
    >
      <AppListRow
        v-for="banner in banners"
        :key="banner.id"
        :thumb-url="banner.url || null"
        :disabled="!banner.enabled"
        thumb-width="96px"
        thumb-height="32px"
      >
        <template #name>
          <span>{{ linkLabel(banner) }}</span>
          <UiTag v-if="isBroken(banner)" type="warning" style="margin-left: var(--space-8)">
            {{ isBroken(banner) }}
          </UiTag>
        </template>

        <template #append>
          <UiSwitch
            :model-value="banner.enabled"
            @update:model-value="toggleEnabled(banner.id, $event)"
          />
          <AppActionsBlock
            size="small"
            @edit="openEdit(banner)"
            @delete="handleRemove(banner)"
          />
        </template>
      </AppListRow>
    </AppDraggableList>

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
import { UiButton, UiEmpty, UiIcon, UiSkeleton, UiSwitch, UiTag } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { Banner, BannerFormData } from '@fastio/shared'
import { featureLabel } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBanners } from '~/composables/data/useBanners'
import { usePromotions } from '~/composables/data/usePromotions'
import { usePromoCodes } from '~/composables/data/usePromoCodes'
import AppActionsBlock from '~/components/ui/AppActionsBlock.vue'
import AppListRow from '~/components/ui/AppListRow.vue'
import AppDraggableList from '~/components/ui/AppDraggableList.vue'
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

const isBroken = (banner: Banner): string | null => {
  if (banner.promotionId) {
    const p = promotions.value.find((pr) => pr.id === banner.promotionId)

    if (!p) return 'Акция удалена'
    if (!p.active) return 'Акция отключена'
  }
  if (banner.promoCodeId) {
    const c = promoCodes.value.find((pc) => pc.id === banner.promoCodeId)

    if (!c) return 'Промокод удалён'
    if (!c.active) return 'Промокод отключён'
  }

  return null
}

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
  gap: var(--space-16);
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}

:deep(.row-ghost) {
  opacity: 0.4;
}
</style>
