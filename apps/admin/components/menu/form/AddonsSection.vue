<template>
  <UiCollapseItem name="addons" title="Добавки">
    <div class="content">
      <div v-if="loading" class="loading">
        <UiSkeleton :height="28" :count="1" />
      </div>

      <template v-else>
        <UiEmpty v-if="allAddons.length === 0">
          Нет добавок в каталоге.
          <NuxtLink to="/menu/addons">Создать</NuxtLink>
        </UiEmpty>

        <template v-else>
          <div class="tags">
            <UiTag
              v-for="addon in attachedAddons"
              :key="addon.id"
              type="primary"
              empty
              round
              closable
              @close="detachAddon(addon.id)"
            >
              {{ addon.name }} · {{ addon.price }} ₽
            </UiTag>

            <UiButton
              type="primary"
              size="small"
              icon="plus"
              @click="showPicker = true"
            >
              Добавить
            </UiButton>
          </div>
        </template>
      </template>
    </div>

    <AddonPickerModal
      v-model="showPicker"
      :all-addons="allAddons"
      :presets="presets"
      :selected-ids="[...selectedAddonIds]"
      @confirm="selectedAddonIds = new Set($event)"
    />
  </UiCollapseItem>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiCollapseItem, UiButton, UiSkeleton, UiEmpty, UiTag } from '@fastio/ui'
import type { Addon, AddonPreset } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import AddonPickerModal from './AddonPickerModal.vue'

const props = defineProps<{
  tenantId: string
  dishId: string | null
  refreshKey: number
  allAddons: Addon[]
  presets: AddonPreset[]
  loading: boolean
}>()

const api = useDatabase()

const selectedAddonIds = ref(new Set<string>())
const showPicker = ref(false)

watch(
  () => props.refreshKey,
  async () => {
    selectedAddonIds.value = new Set()

    if (props.dishId) {
      const ids = await api.addons.getDishAddons(props.dishId)

      selectedAddonIds.value = new Set(ids)
    }
  },
  { immediate: true },
)

const attachedAddons = computed(() => props.allAddons.filter((a) => selectedAddonIds.value.has(a.id)),
)

const detachAddon = (id: string) => {
  const next = new Set(selectedAddonIds.value)

  next.delete(id)
  selectedAddonIds.value = next
}

const getAddonIds = () => [...selectedAddonIds.value]

defineExpose({ getAddonIds })
</script>

<style scoped lang="scss">
.content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
</style>
