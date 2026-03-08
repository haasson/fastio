<template>
  <UiCollapseItem
    name="modifiers"
    title="Модификаторы"
  >
    <div class="content">
      <div v-if="loading" class="loading">
        <UiSkeleton :height="40" :count="2" />
      </div>

      <template v-else>
        <div v-if="availableGroups.length === 0" class="empty">
          <UiText size="small" color="secondary">
            Нет групп модификаторов.
            <NuxtLink to="/menu/modifiers">Создать</NuxtLink>
          </UiText>
        </div>

        <template v-else>
          <!-- Привязанные группы -->
          <div v-for="(attached, gi) in attachedGroups" :key="attached.groupId" class="attached-group">
            <div class="group-row">
              <UiText :weight="600" size="small">{{ attached.groupName }}</UiText>
              <UiButton size="tiny" type="text" @click="removeGroup(gi)">
                ✕
              </UiButton>
            </div>

            <div class="options-grid">
              <div v-for="sourceOpt in getGroupSourceOptions(attached.groupId)" :key="sourceOpt.id" class="option-row">
                <UiCheckbox
                  :model-value="isOptionAttached(gi, sourceOpt.id)"
                  @update:model-value="toggleOption(gi, sourceOpt, $event)"
                >
                  {{ sourceOpt.name }}
                </UiCheckbox>
                <template v-if="isOptionAttached(gi, sourceOpt.id)">
                  <UiInputNumber
                    :model-value="getAttachedOption(gi, sourceOpt.id)!.priceDelta"
                    label=""
                    :min="0"
                    placeholder="0"
                    class="price-input"
                    @update:model-value="getAttachedOption(gi, sourceOpt.id)!.priceDelta = $event ?? 0"
                  />
                  <UiText size="tiny" color="secondary" class="delta-label">+₽</UiText>
                  <UiCheckbox
                    :model-value="getAttachedOption(gi, sourceOpt.id)!.isDefault"
                    @update:model-value="setDefault(gi, sourceOpt.id, $event)"
                  >
                    <UiText size="tiny">По умолч.</UiText>
                  </UiCheckbox>
                </template>
              </div>
            </div>
          </div>

          <!-- Добавление -->
          <template v-if="!addMode">
            <div v-if="canAddGroup || hasCopySource" class="add-buttons">
              <UiButton
                v-if="canAddGroup"
                type="primary"
                icon="plus"
                @click="addMode = 'group'"
              >
                Добавить
              </UiButton>
              <UiButton v-if="hasCopySource" type="default" @click="addMode = 'copy'">
                Скопировать с другого блюда
              </UiButton>
            </div>
          </template>

          <div v-else class="add-section">
            <template v-if="addMode === 'group'">
              <UiSelect
                v-model:value="selectedGroupId"
                label=""
                placeholder="Выберите группу"
                :options="groupSelectOptions"
                class="add-select"
              />
              <UiButton type="default" :disabled="!selectedGroupId" @click="addGroup">
                Привязать
              </UiButton>
            </template>

            <template v-else-if="addMode === 'copy'">
              <UiSelect
                v-model:value="copyFromDishId"
                label=""
                placeholder="Выберите блюдо"
                :options="copyDishSelectOptions"
                class="add-select"
              />
              <UiButton type="default" :disabled="!copyFromDishId" @click="copyFromDish">
                Скопировать
              </UiButton>
            </template>

            <UiButton type="text" size="tiny" @click="addMode = null">✕</UiButton>
          </div>
        </template>
      </template>
    </div>
  </UiCollapseItem>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiCollapseItem, UiButton, UiText, UiSkeleton, UiInputNumber, UiCheckbox, UiSelect, useMessage } from '@fastio/ui'
import type { Dish, ModifierGroup, DishModifierGroup, DishModifierOption } from '@fastio/shared'
import { useSupabaseApi } from '#imports'

const props = defineProps<{
  tenantId: string
  categoryId: string
  dishId: string | null
  refreshKey: number
}>()

const api = useSupabaseApi()
const { success } = useMessage()

const loading = ref(false)
const availableGroups = ref<ModifierGroup[]>([])
const attachedGroups = ref<DishModifierGroup[]>([])
const selectedGroupId = ref<string | null>(null)
const copyFromDishId = ref<string | null>(null)
const categoryDishes = ref<Dish[]>([])
const addMode = ref<'group' | 'copy' | null>(null)

const loadAvailableGroups = async () => {
  if (!props.tenantId) return
  availableGroups.value = await api.modifiers.list(props.tenantId)
}

const dishesWithModifiers = ref<Set<string>>(new Set())

const loadCategoryDishes = async () => {
  if (!props.tenantId || !props.categoryId) return
  const dishes = await api.dishes.list(props.tenantId, props.categoryId)

  categoryDishes.value = dishes.filter((d) => d.id !== props.dishId)

  const dishIds = categoryDishes.value.map((d) => d.id)

  if (dishIds.length > 0) {
    dishesWithModifiers.value = await api.dishes.getDishIdsWithModifiers(dishIds)
  }
}

const copyDishSelectOptions = computed(() => categoryDishes.value
  .filter((d) => dishesWithModifiers.value.has(d.id))
  .map((d) => ({ label: d.name, value: d.id })),
)

const copyFromDish = async () => {
  if (!copyFromDishId.value) return
  const modifiers = await api.dishes.getDishModifiers(copyFromDishId.value)

  attachedGroups.value = modifiers
  copyFromDishId.value = null
  addMode.value = null
  success('Скопировано')
}

const canAddGroup = computed(() => unattachedGroups.value.length > 0)
const hasCopySource = computed(() => copyDishSelectOptions.value.length > 0)

const unattachedGroups = computed(() => availableGroups.value.filter(
  (g) => !attachedGroups.value.some((a) => a.groupId === g.id),
),
)

const groupSelectOptions = computed(() => unattachedGroups.value.map((g) => ({ label: g.name, value: g.id })),
)

const addGroup = () => {
  const group = availableGroups.value.find((g) => g.id === selectedGroupId.value)

  if (!group) return

  const options: DishModifierOption[] = group.options.map((o, i) => ({
    optionId: o.id,
    optionName: o.name,
    groupId: group.id,
    groupName: group.name,
    priceDelta: 0,
    isDefault: i === 0,
    sortOrder: i,
  }))

  attachedGroups.value.push({
    groupId: group.id,
    groupName: group.name,
    sortOrder: attachedGroups.value.length,
    options,
  })

  selectedGroupId.value = null
  addMode.value = null
}

const removeGroup = (index: number) => {
  attachedGroups.value.splice(index, 1)
}

const getGroupSourceOptions = (groupId: string) => availableGroups.value.find((g) => g.id === groupId)?.options ?? []

const isOptionAttached = (groupIndex: number, optionId: string) => attachedGroups.value[groupIndex].options.some((o) => o.optionId === optionId)

const getAttachedOption = (groupIndex: number, optionId: string) => attachedGroups.value[groupIndex].options.find((o) => o.optionId === optionId)

const toggleOption = (groupIndex: number, sourceOpt: { id: string; name: string }, checked: boolean) => {
  const group = attachedGroups.value[groupIndex]

  if (checked) {
    group.options.push({
      optionId: sourceOpt.id,
      optionName: sourceOpt.name,
      groupId: group.groupId,
      groupName: group.groupName,
      priceDelta: 0,
      isDefault: group.options.length === 0,
      sortOrder: group.options.length,
    })
  } else {
    group.options = group.options.filter((o) => o.optionId !== sourceOpt.id)
    // If removed option was default, make first remaining default
    if (!group.options.some((o) => o.isDefault) && group.options.length > 0) {
      group.options[0].isDefault = true
    }
  }
}

const setDefault = (groupIndex: number, optionId: string, value: boolean) => {
  const group = attachedGroups.value[groupIndex]

  // Ensure exactly one default per group
  for (const opt of group.options) {
    opt.isDefault = opt.optionId === optionId ? value : false
  }

  // If none selected, default to first
  if (!group.options.some((o) => o.isDefault) && group.options.length > 0) {
    group.options[0].isDefault = true
  }
}

const loadDishModifiers = async (dishId: string) => {
  attachedGroups.value = await api.dishes.getDishModifiers(dishId)
}

const getModifiers = (): DishModifierGroup[] => attachedGroups.value

defineExpose({ getModifiers })

watch(
  () => props.refreshKey,
  async () => {
    loading.value = true
    try {
      await Promise.all([loadAvailableGroups(), loadCategoryDishes()])
      if (props.dishId) {
        await loadDishModifiers(props.dishId)
      } else {
        attachedGroups.value = []
      }
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)
</script>

<style scoped lang="scss">
.content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty a {
  color: var(--color-primary);
}

.attached-group {
  padding: 10px 12px;
  background: var(--color-bg-page);
  border-radius: 10px;
}

.group-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.options-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.price-input {
  width: 80px;
  flex-shrink: 0;
}

.delta-label {
  flex-shrink: 0;
}

.add-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-select {
  width: 300px;
}
</style>
