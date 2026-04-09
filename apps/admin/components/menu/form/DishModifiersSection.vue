<template>
  <UiCollapseItem
    name="modifiers"
    title="Модификаторы"
  >
    <template #header-extra>
      <HintPopover>
        <UiText size="tiny">
          Группы вариантов блюда. Например, размер пиццы или вид теста. Гость выбирает один вариант из каждой группы.
        </UiText>
      </HintPopover>
    </template>

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
            <UiAlert v-if="isGroupInactive(attached.groupId)" type="error" size="small">Модификатор отключен в настройках и не будет отображаться для данного блюда</UiAlert>

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
                  >
                    <template #suffix>+₽</template>
                  </UiInputNumber>
                  <UiInputNumber
                    v-if="isPerDishWeight(attached.groupId)"
                    :model-value="getAttachedOption(gi, sourceOpt.id)!.weight ?? undefined"
                    label=""
                    :show-button="true"
                    placeholder="—"
                    class="weight-input"
                    @update:model-value="getAttachedOption(gi, sourceOpt.id)!.weight = $event ?? null"
                  >
                    <template #suffix>{{ weightUnit ?? 'г' }}</template>
                  </UiInputNumber>
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
                size="small"
                icon="plus"
                @click="addMode = 'group'"
              >
                Добавить
              </UiButton>
              <UiButton
                v-if="hasCopySource"
                type="default"
                size="small"
                @click="addMode = 'copy'"
              >
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
import { toRefs } from 'vue'
import { UiCollapseItem, UiButton, UiText, UiSkeleton, UiInputNumber, UiCheckbox, UiSelect, UiAlert, useMessage } from '@fastio/ui'
import { useDishModifiersEditor } from '~/composables/menu/useDishModifiersEditor'
import HintPopover from '~/components/ui/HintPopover.vue'

const props = defineProps<{
  tenantId: string
  categoryId: string
  dishId: string | null
  refreshKey: number
  weightUnit?: 'г' | 'мл'
}>()

const { success } = useMessage()

const { tenantId, categoryId, dishId, refreshKey, weightUnit } = toRefs(props)

const {
  loading, availableGroups, attachedGroups, selectedGroupId, copyFromDishId, addMode,
  canAddGroup, hasCopySource, groupSelectOptions, copyDishSelectOptions,
  addGroup, removeGroup, getGroupSourceOptions, getGroupWeightMode, isOptionAttached, getAttachedOption,
  isGroupInactive, toggleOption, setDefault, getModifiers,
  copyFromDish: copyFromDishRaw,
} = useDishModifiersEditor(tenantId, categoryId, dishId, refreshKey)

const isPerDishWeight = (groupId: string) => {
  const { affectsWeight, weightMode } = getGroupWeightMode(groupId)

  return affectsWeight && weightMode === 'per_dish'
}

const copyFromDish = async () => {
  await copyFromDishRaw()
  success('Скопировано')
}

defineExpose({ getModifiers })
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
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.price-input,
.weight-input {
  width: 80px;
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
