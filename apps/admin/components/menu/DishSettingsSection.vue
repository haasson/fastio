<template>
  <UiCollapseItem
    name="settings"
    title="Настройки"
  >
    <div class="content">
      <div class="toggle-row">
        <span class="label">Показывать в меню</span>
        <UiSwitch :model-value="active" @update:model-value="$emit('update:active', $event)" />
      </div>

      <template v-if="branches.length > 0">
        <div class="toggle-row">
          <span class="label">Разная цена по филиалам</span>
          <UiSwitch v-model="useBranchPrices" @update:model-value="onToggleBranchPrices" />
        </div>

        <div v-if="useBranchPrices" class="branch-prices">
          <div v-for="branch in branches" :key="branch.id" class="branch-price-row">
            <span class="branch-price-name">{{ branch.name }}</span>
            <UiInputNumber
              v-model="branchPrices[branch.id]"
              label=""
              :min="0"
              :placeholder="String(price ?? 0)"
            />
          </div>
        </div>
      </template>
    </div>
  </UiCollapseItem>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UiCollapseItem, UiSwitch, UiInputNumber } from '@fastio/ui'
import { useSupabaseApi } from '#imports'
import { useBranchStore } from '~/stores/branch'

const props = defineProps<{
  active: boolean
  dishId: string | null
  price: number | null
  refreshKey: number
}>()

defineEmits<{
  'update:active': [value: boolean]
}>()

const api = useSupabaseApi()
const branchStore = useBranchStore()
const branches = computed(() => branchStore.branches)

const useBranchPrices = ref(false)
const branchPrices = reactive<Record<string, number | null>>({})

const reset = () => {
  useBranchPrices.value = false
  branches.value.forEach((b) => {
    branchPrices[b.id] = null
  })
}

const load = async (dishId: string) => {
  const prices = await api.dishes.getBranchPrices(dishId)

  branches.value.forEach((b) => {
    branchPrices[b.id] = null
  })

  if (prices.length > 0) {
    useBranchPrices.value = true
    prices.forEach((p) => {
      branchPrices[p.branchId] = p.price
    })
  } else {
    useBranchPrices.value = false
  }
}

const onToggleBranchPrices = (val: boolean) => {
  if (!val) {
    Object.keys(branchPrices).forEach((k) => {
      branchPrices[k] = null
    })
  }
}

const getBranchPrices = () => useBranchPrices.value
  ? branches.value
      .filter((b) => branchPrices[b.id] != null)
      .map((b) => ({ branchId: b.id, price: branchPrices[b.id] as number }))
  : []

defineExpose({ getBranchPrices })

watch(
  () => props.refreshKey,
  () => {
    if (props.dishId && branches.value.length > 0) {
      load(props.dishId)
    } else {
      reset()
    }
  },
  { immediate: true },
)
</script>

<style scoped lang="scss">
.content {
  display: flex;
  flex-direction: column;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-top: 1px solid var(--color-border);
}

.label {
  font-size: 14px;
  color: var(--color-text);
}

.branch-prices {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.branch-price-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.branch-price-name {
  flex: 1;
  font-size: 14px;
  color: var(--color-title);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
