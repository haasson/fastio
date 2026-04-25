<template>
  <UiModal
    :model-value="modelValue"
    title="QR-код"
    :width="480"
    :loading="generating"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="qr-modal-root">
      <!-- QR preview for current table -->
      <div class="qr-preview-section">
        <div ref="qrPreviewRef" class="qr-preview">
          <NQrCode :value="tableUrl" :size="180" />
        </div>
        <UiText size="small" class="qr-table-name">{{ table?.name }}</UiText>
        <UiButton size="small" type="default" @click="downloadSinglePng">
          Скачать PNG
        </UiButton>
      </div>

      <!-- PDF download section -->
      <div class="pdf-section">
        <UiText size="small" class="section-title">Скачать PDF для печати</UiText>

        <div class="mode-switch">
          <button
            class="mode-btn"
            :class="{ 'mode-btn--active': mode === 'single' }"
            @click="mode = 'single'"
          >
            Только {{ table?.name }}
          </button>
          <button
            class="mode-btn"
            :class="{ 'mode-btn--active': mode === 'all' }"
            @click="mode = 'all'"
          >
            Все столы ({{ allTables.length }})
          </button>
        </div>

        <!-- Single mode: just copies count -->
        <div v-if="mode === 'single'" class="copies-single">
          <UiText size="tiny" class="copies-label">Копий</UiText>
          <UiInputNumber
            v-model:value="singleCopies"
            :min="1"
            :max="50"
            :show-button="true"
            size="small"
            class="copies-input"
          />
        </div>

        <!-- All mode: list with copies per table -->
        <div v-else class="copies-list">
          <div v-for="item in tableItems" :key="item.table.id" class="copies-row">
            <span class="copies-name">{{ item.table.name }}</span>
            <UiInputNumber
              v-model:value="item.copies"
              :min="0"
              :max="50"
              :show-button="true"
              size="small"
              class="copies-input"
            />
          </div>
        </div>

        <UiButton
          type="primary"
          :loading="generating"
          :disabled="totalCopies === 0"
          @click="downloadPdf"
        >
          Скачать PDF ({{ totalCopies }} {{ pluralize(totalCopies, 'код', 'кода', 'кодов') }})
        </UiButton>
      </div>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NQrCode } from 'naive-ui'
import { UiModal, UiButton, UiText, UiInputNumber } from '@fastio/ui'
import type { Table } from '@fastio/shared'
import { pluralize } from '@fastio/shared'
import { useTableUrl } from '~/composables/useTableUrl'
import { generateTableQrPdf } from '~/utils/generateTableQrPdf'
import { storeToRefs } from 'pinia'
import { useTenantStore } from '~/stores/tenant'

const props = defineProps<{
  modelValue: boolean
  table: Table | null
  allTables: Table[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { getTableUrl } = useTableUrl()
const tenantStore = useTenantStore()
const { tenant } = storeToRefs(tenantStore)

const generating = ref(false)
const qrPreviewRef = ref<HTMLElement | null>(null)
const mode = ref<'single' | 'all'>('single')
const singleCopies = ref(1)

type TableCopyItem = { table: Table; copies: number }

const tableItems = ref<TableCopyItem[]>([])

const tableUrl = computed(() => props.table ? getTableUrl(props.table.id) : '')

const totalCopies = computed(() => {
  if (mode.value === 'single') return singleCopies.value

  return tableItems.value.reduce((sum, i) => sum + i.copies, 0)
})

watch(() => props.modelValue, (open) => {
  if (!open) return
  mode.value = 'single'
  singleCopies.value = 1
  tableItems.value = props.allTables.map((t) => ({ table: t, copies: 1 }))
})

const downloadSinglePng = () => {
  const canvas = qrPreviewRef.value?.querySelector('canvas')

  if (!canvas || !props.table) return

  const link = document.createElement('a')

  link.download = `qr-${props.table.name}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

const downloadPdf = async () => {
  let items: { name: string; url: string; copies: number }[]

  if (mode.value === 'single' && props.table) {
    items = [{
      name: props.table.name,
      url: getTableUrl(props.table.id),
      copies: singleCopies.value,
    }]
  } else {
    items = tableItems.value
      .filter((i) => i.copies > 0)
      .map((i) => ({
        name: i.table.name,
        url: getTableUrl(i.table.id),
        copies: i.copies,
      }))
  }

  if (!items.length) return

  generating.value = true
  try {
    await generateTableQrPdf(items, tenant.value.name)
  } finally {
    generating.value = false
  }
}
</script>

<style scoped lang="scss">
.qr-modal-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-20);
}

.qr-preview-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-12);
}

.qr-preview {
  display: flex;
  justify-content: center;
  padding: var(--space-12);
  background: var(--color-bg-subtle);
  border-radius: var(--radius-8);
  overflow: hidden;

  :deep(canvas) {
    display: block;
    max-width: 100%;
    height: auto !important;
  }
}

.qr-table-name {
  font-weight: var(--font-weight-semibold);
}

.pdf-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  padding-top: var(--space-16);
  border-top: 1px solid var(--color-border);
}

.section-title {
  font-weight: var(--font-weight-semibold);
}

.mode-switch {
  display: flex;
  gap: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
  overflow: hidden;
}

.mode-btn {
  flex: 1;
  padding: var(--space-8) var(--space-12);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  background: var(--color-bg);
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: background 0.15s, color 0.15s;

  & + & {
    border-left: 1px solid var(--color-border);
  }

  &--active {
    background: var(--color-primary);
    color: var(--color-white);
  }
}

.copies-single {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.copies-label {
  color: var(--color-text-secondary);
}

.copies-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  max-height: 250px;
  overflow-y: auto;
}

.copies-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  padding: var(--space-4) var(--space-8);
  border-radius: var(--radius-8);
  background: var(--color-bg-subtle);
}

.copies-name {
  flex: 1;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copies-input {
  width: 100px;
  flex-shrink: 0;
}
</style>
