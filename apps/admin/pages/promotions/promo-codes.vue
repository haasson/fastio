<template>
  <div class="tab-root">
    <div class="toolbar">
      <UiInput
        v-if="promoCodes.length > 0"
        v-model:value="search"
        placeholder="Поиск по коду..."
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
      v-else-if="promoCodes.length === 0"
      icon="promotions"
      text="Промокодов пока нет. Создайте первый — например WELCOME10 на скидку 10%."
    />

    <UiDataTable
      v-else
      :columns="columns"
      :data="filtered"
      :row-key="(row: PromoCode) => row.id"
      :bordered="false"
      size="small"
    />

    <PromoCodeFormModal
      v-model="showModal"
      :promo-code="editing"
      :saving="saving"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { UiButton, UiDataTable, UiEmpty, UiInput, UiSkeleton } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { PromoCode, PromoCodeFormData } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { usePromoCodes } from '~/features/promotions'
import { useBanners } from '~/features/content'
import { buildPromoCodeColumns } from '~/features/promotions'
import PromoCodeFormModal from '~/features/promotions/components/PromoCodeFormModal.vue'

const { tenantId } = storeToRefs(useTenantStore())

const { promoCodes, loading, add, update, remove, toggleActive } = usePromoCodes(tenantId)
const { banners: allBanners } = useBanners(tenantId)

const search = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()

  if (!q) return promoCodes.value

  return promoCodes.value.filter((p) => p.code.toLowerCase().includes(q))
})

const showModal = ref(false)
const editing = ref<PromoCode | null>(null)
const saving = ref(false)

const { confirm } = useConfirm()

const openAdd = () => {
  editing.value = null
  showModal.value = true
}

const openEdit = (promo: PromoCode) => {
  editing.value = promo
  showModal.value = true
}

const handleSave = async (data: PromoCodeFormData) => {
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

const handleRemove = async (promo: PromoCode) => {
  const ok = await confirm({ title: `Удалить промокод «${promo.code}»?` })

  if (ok) await remove(promo.id)
}

const handleToggleActive = async (id: string, active: boolean) => {
  if (!active) {
    const linked = allBanners.value.filter((b) => b.promoCodeId === id && b.enabled)

    if (linked.length > 0) {
      const ok = await confirm({
        title: 'Отключить промокод?',
        message: `К этому промокоду привязано баннеров: ${linked.length}. После отключения они перестанут отображаться на сайте.`,
      })

      if (!ok) return
    }
  }

  toggleActive(id, active)
}

const columns = buildPromoCodeColumns({
  onToggle: handleToggleActive,
  onEdit: openEdit,
  onRemove: handleRemove,
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.tab-root {
  @include flex-col(var(--space-16));
}

.toolbar {
  @include flex-row(var(--space-12));
}

.search {
  flex: 1;
  max-width: 320px;
}

.add-btn {
  margin-left: auto;
}

:deep(.promo-code-text) {
  font-family: monospace;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.04em;
}
</style>
