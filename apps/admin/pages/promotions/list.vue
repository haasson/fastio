<template>
  <div class="tab-root">
    <div class="toolbar">
      <UiInput
        v-if="promotions.length > 0"
        v-model:value="search"
        placeholder="Поиск по названию..."
        clearable
        class="search"
      />
      <UiButton
        type="primary"
        icon="plus"
        class="add-btn"
        @click="openAdd"
      >
        Добавить
      </UiButton>
    </div>

    <UiSkeleton v-if="loading" :height="56" :count="3" />

    <UiEmpty
      v-else-if="promotions.length === 0"
      icon="promotions"
      text="Акций пока нет. Создайте первую — например скидку в happy hour."
    />

    <UiDataTable
      v-else
      :columns="columns"
      :data="filtered"
      :row-key="(row: Promotion) => row.id"
      :bordered="false"
      size="small"
    />

    <PromotionFormModal
      v-model="showModal"
      :promotion="editing"
      :tenant-id="tenantId"
      :saving="saving"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiButton, UiDataTable, UiEmpty, UiInput, UiSkeleton } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { Promotion, PromotionFormData } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { usePromotions } from '~/composables/data/usePromotions'
import { useBanners } from '~/composables/data/useBanners'
import { buildPromotionColumns } from '~/columns/promotions'
import PromotionFormModal from '~/components/promotions/PromotionFormModal.vue'

const tenantStore = useTenantStore()
const tenantId = computed(() => tenantStore.tenant?.id ?? '')

const { promotions, loading, add, update, remove, toggleActive } = usePromotions(tenantId)
const { banners: allBanners } = useBanners(tenantId)

const search = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()

  if (!q) return promotions.value

  return promotions.value.filter((p) => p.title.toLowerCase().includes(q))
})

const showModal = ref(false)
const editing = ref<Promotion | null>(null)
const saving = ref(false)

const { confirm } = useConfirm()

const openAdd = () => {
  editing.value = null
  showModal.value = true
}

const openEdit = (promo: Promotion) => {
  editing.value = promo
  showModal.value = true
}

const handleSave = async (data: PromotionFormData) => {
  saving.value = true
  try {
    if (editing.value) {
      await update(editing.value.id, data)
    } else {
      await add(data)
    }
    showModal.value = false
  } finally {
    saving.value = false
  }
}

const handleRemove = async (promo: Promotion) => {
  const ok = await confirm({ title: `Удалить акцию «${promo.title}»?` })

  if (ok) await remove(promo.id)
}

const handleToggleActive = async (id: string, active: boolean) => {
  if (!active) {
    const linked = allBanners.value.filter((b) => b.promotionId === id && b.enabled)

    if (linked.length > 0) {
      const ok = await confirm({
        title: 'Отключить акцию?',
        message: `К этой акции привязано баннеров: ${linked.length}. После отключения они перестанут отображаться на сайте.`,
      })

      if (!ok) return
    }
  }

  toggleActive(id, active)
}

const columns = buildPromotionColumns({
  onToggle: handleToggleActive,
  onEdit: openEdit,
  onRemove: handleRemove,
})
</script>

<style scoped lang="scss">
.tab-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-12);
}

.search {
  flex: 1;
  max-width: 320px;
}

.add-btn {
  margin-left: auto;
}

:deep(.promo-title-cell) {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

:deep(.promo-title) {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-md);
}
</style>
