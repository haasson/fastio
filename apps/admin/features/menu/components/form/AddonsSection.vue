<template>
  <UiCollapseItem name="addons" title="Добавки">
    <template #header-extra>
      <HintPopover>
        <UiText size="tiny">
          {{ `Дополнения к ${item.dat} за отдельную цену. Добавки общие на весь ${menu.nom} — создаются в разделе ${menu.label} → Добавки. Количество можно ограничить — по умолчанию для всех ${item.plural.gen} или индивидуально.` }}
        </UiText>
      </HintPopover>
    </template>

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
          <UiAlert v-if="hasInactiveAddons" type="warning" size="small">
            Добавки, выделенные жёлтым, отключены в настройках и не будут отображаться гостям
          </UiAlert>

          <div class="tags">
            <UiTag
              v-for="addon in attachedAddons"
              :key="addon.id"
              :type="addon.active ? 'primary' : 'warning'"
              empty
              round
              closable
              @close="detachAddon(addon.id)"
            >
              {{ addon.name }} · {{ addon.price }} ₽
            </UiTag>
          </div>

          <div v-if="props.maxAddonsDefault != null" class="max-addons-row">
            <UiText size="small" color="secondary">Максимум добавок:</UiText>
            <template v-if="!editingMax">
              <UiText size="small" :weight="600">{{ effectiveMaxAddons }}</UiText>
              <UiEditButton @click="startEditMax" />
            </template>
            <template v-else>
              <UiInputNumber
                v-model="maxAddonsOverride"
                :min="1"
                :show-button="true"
                placeholder="—"
                class="max-addons-input"
              />
              <UiButton type="primary" size="tiny" @click="confirmMax">Ок</UiButton>
            </template>
          </div>

          <template v-if="!addMode">
            <div class="add-buttons">
              <UiButton
                type="primary"
                size="small"
                icon="plus"
                @click="showPicker = true"
              >
                Добавить
              </UiButton>
              <UiButton
                v-if="hasCopySource"
                type="default"
                size="small"
                @click="addMode = 'copy'"
              >
                {{ `Скопировать с другого ${item.gen}` }}
              </UiButton>
            </div>
          </template>

          <div v-if="addMode === 'copy'" class="add-section">
            <UiSelect
              v-model:value="copyFromDishId"
              label=""
              :placeholder="`Выберите ${item.acc}`"
              :options="copyDishSelectOptions"
              class="add-select"
            />
            <UiButton type="default" :disabled="!copyFromDishId" @click="copyFromDish">
              Скопировать
            </UiButton>
            <UiButton type="text" size="tiny" @click="addMode = null">✕</UiButton>
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
import { UiCollapseItem, UiButton, UiSkeleton, UiEmpty, UiTag, UiText, UiSelect, UiInputNumber, UiEditButton, UiAlert, useMessage } from '@fastio/ui'
import type { Addon, AddonPreset } from '@fastio/shared'
import { pluralize } from '@fastio/shared'
import { useConfirm } from '@fastio/kit'
import { useDatabase } from '~/composables/data/useDatabase'
import AddonPickerModal from './AddonPickerModal.vue'
import HintPopover from '~/components/ui/HintPopover.vue'
import { useTerms } from '~/features/legal'

const props = defineProps<{
  tenantId: string
  dishId: string | null
  refreshKey: number
  allAddons: Addon[]
  presets: AddonPreset[]
  loading: boolean
  categoryDishes: Array<{ id: string; name: string }>
  maxAddonsDefault: number | null
  initialMaxAddons: number | null
}>()

const api = useDatabase()
const { success } = useMessage()
const { confirm } = useConfirm()
const { item, menu } = useTerms()

const selectedAddonIds = ref(new Set<string>())
const showPicker = ref(false)
const maxAddonsOverride = ref<number | null>(null)
const hasOverride = ref(false)

const editingMax = ref(false)

const effectiveMaxAddons = computed(() => hasOverride.value ? maxAddonsOverride.value : props.maxAddonsDefault)

const startEditMax = () => {
  if (!hasOverride.value) {
    maxAddonsOverride.value = props.maxAddonsDefault
    hasOverride.value = true
  }
  editingMax.value = true
}

const confirmMax = () => {
  if (maxAddonsOverride.value != null) {
    hasOverride.value = true
  } else {
    hasOverride.value = false
  }
  editingMax.value = false
}
const addMode = ref<'copy' | null>(null)
const copyFromDishId = ref<string | null>(null)
const dishesWithAddons = ref<Set<string>>(new Set())

watch(
  () => props.categoryDishes,
  async (dishes) => {
    if (dishes.length === 0) {
      dishesWithAddons.value = new Set()

      return
    }
    const ids = await api.addons.getDishesThatHaveAddons(dishes.map((d) => d.id))

    dishesWithAddons.value = new Set(ids)
  },
  { immediate: true },
)

const copyDishSelectOptions = computed(() => props.categoryDishes
  .filter((d) => dishesWithAddons.value.has(d.id))
  .map((d) => ({ label: d.name, value: d.id })),
)

const hasCopySource = computed(() => copyDishSelectOptions.value.length > 0)

const copyFromDish = async () => {
  if (!copyFromDishId.value) return
  const rawIds = await api.addons.getDishAddons(copyFromDishId.value)
  const activeAddonIds = new Set(props.allAddons.filter((a) => a.active).map((a) => a.id))
  const ids = rawIds.filter((id) => activeAddonIds.has(id))
  const newIds = new Set(ids)
  const hasLosses = [...selectedAddonIds.value].some((id) => !newIds.has(id))

  if (hasLosses) {
    const ok = await confirm({
      title: 'Заменить добавки?',
      message: 'Некоторые текущие добавки не входят в список скопированных и будут удалены.',
      confirmText: 'Заменить',
      confirmType: 'warning',
    })

    if (!ok) return
  }

  selectedAddonIds.value = newIds
  success(`Скопировано ${ids.length} ${pluralize(ids.length, 'добавка', 'добавки', 'добавок')}`)
  copyFromDishId.value = null
  addMode.value = null
}

watch(
  () => props.refreshKey,
  async () => {
    selectedAddonIds.value = new Set()
    hasOverride.value = props.initialMaxAddons != null
    maxAddonsOverride.value = props.initialMaxAddons ?? null

    if (props.dishId) {
      const ids = await api.addons.getDishAddons(props.dishId)

      selectedAddonIds.value = new Set(ids)
    }
  },
  { immediate: true },
)

const attachedAddons = computed(() => props.allAddons.filter((a) => selectedAddonIds.value.has(a.id)))
const hasInactiveAddons = computed(() => attachedAddons.value.some((a) => !a.active))

const detachAddon = (id: string) => {
  const next = new Set(selectedAddonIds.value)

  next.delete(id)
  selectedAddonIds.value = next
}

const getAddonIds = () => [...selectedAddonIds.value]
const getMaxAddons = () => hasOverride.value ? maxAddonsOverride.value : undefined

defineExpose({ getAddonIds, getMaxAddons })
</script>

<style scoped lang="scss">
.content {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-8);
}

.add-buttons {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.add-section {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.add-select {
  width: 300px;
}

.max-addons-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  margin-top: var(--space-4);
}

.max-addons-input {
  width: 64px;
}

</style>
