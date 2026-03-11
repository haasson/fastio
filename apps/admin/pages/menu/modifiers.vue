<template>
  <div class="modifiers-root">
    <div class="header">
      <UiButton type="primary" icon="plus" @click="openAdd">
        Добавить группу
      </UiButton>
    </div>

    <div v-if="loading" class="loading">
      <UiSkeleton :height="80" :count="3" />
    </div>

    <div v-else-if="groups.length === 0" class="empty">
      <UiText color="secondary">
        Модификаторов пока нет. Создайте первую группу — например "Размер" или "Бортик".
      </UiText>
    </div>

    <div v-else class="groups-list">
      <div v-for="group in groups" :key="group.id" class="group-card">
        <div class="group-header">
          <div class="group-info">
            <UiText :weight="600">{{ group.name }}</UiText>
            <UiBadge v-if="!group.active" type="warning" size="small">
              Скрыта
            </UiBadge>
          </div>
          <div class="group-actions">
            <UiSwitch
              :model-value="group.active"
              @update:model-value="toggleActive(group.id, $event)"
            />
            <UiButton size="tiny" type="default" @click="openEdit(group)">
              Изменить
            </UiButton>
            <UiButton size="tiny" type="text" @click="handleRemove(group)">
              ✕
            </UiButton>
          </div>
        </div>
        <div class="group-options">
          <UiTag v-for="opt in group.options" :key="opt.id" size="small">
            {{ opt.name }}
          </UiTag>
          <UiText v-if="group.options.length === 0" size="small" color="secondary">
            Нет опций
          </UiText>
        </div>
      </div>
    </div>

    <ModifierGroupFormModal
      v-model="showModal"
      :group="editingGroup"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { definePageMeta } from '#imports'
import { UiButton, UiText, UiSkeleton, UiSwitch, UiBadge, UiTag } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { ModifierGroup } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useModifierGroups } from '~/composables/data/useModifierGroups'
import ModifierGroupFormModal from '~/components/menu/ModifierGroupFormModal.vue'

definePageMeta({ middleware: 'auth' })

const tenantStore = useTenantStore()

onMounted(() => tenantStore.init())

const tenantId = computed(() => tenantStore.tenant?.id ?? '')
const { groups, loading, add, update, remove, toggleActive } = useModifierGroups(tenantId)

const showModal = ref(false)
const editingGroup = ref<ModifierGroup | null>(null)

const { confirm } = useConfirm()

const openAdd = () => {
  editingGroup.value = null
  showModal.value = true
}

const openEdit = (group: ModifierGroup) => {
  editingGroup.value = group
  showModal.value = true
}

const handleSave = async (data: Parameters<typeof add>[0]) => {
  if (editingGroup.value) {
    await update(editingGroup.value.id, data)
  } else {
    await add(data)
  }
  showModal.value = false
}

const handleRemove = async (group: ModifierGroup) => {
  const confirmed = await confirm({
    title: 'Удалить модификатор?',
    message: `Группа "${group.name}" будет удалена. Привязки к блюдам тоже исчезнут.`,
    confirmText: 'Удалить',
    confirmType: 'error',
  })

  if (confirmed) await remove(group.id)
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.modifiers-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0;
}

.header {
  display: flex;
  justify-content: flex-end;
}

.loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty {
  padding: 40px;
  text-align: center;
}

.groups-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-card {
  padding: 14px 16px;
  background: var(--color-white);
  border-radius: 12px;
  border: 1px solid var(--color-border);
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.group-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
</style>
