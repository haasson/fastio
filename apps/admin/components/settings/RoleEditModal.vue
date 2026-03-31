<template>
  <UiModal
    :model-value="modelValue"
    :title="isEditing ? 'Редактировать роль' : 'Создать роль'"
    :width="480"
    :loading="saving"
    :actions="[
      { text: 'Отмена', type: 'default', actionType: 'decline' },
      { text: 'Сохранить', type: 'primary', actionType: 'confirm' },
    ]"
    :on-confirm="handleSave"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="form">
      <UiInput
        v-model="form.name"
        label="Название"
        placeholder="Например: Кассир"
        :clearable="false"
      />

      <div class="permission-groups">
        <div v-for="group in permissionGroups" :key="group.label" class="perm-group">
          <div class="group-header">
            <UiCheckbox
              :model-value="isGroupFullyChecked(group)"
              :indeterminate="isGroupPartiallyChecked(group)"
              @update:model-value="toggleGroup(group, $event)"
            >
              <UiText size="small" class="group-label">{{ group.label }}</UiText>
            </UiCheckbox>
          </div>
          <div class="group-items">
            <UiCheckbox
              v-for="perm in group.permissions"
              :key="perm.key"
              :model-value="form.permissions[perm.key] === true"
              @update:model-value="form.permissions[perm.key] = $event"
            >
              {{ perm.label }}
            </UiCheckbox>
          </div>
        </div>
      </div>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { UiModal, UiInput, UiCheckbox, UiText, useMessage } from '@fastio/ui'
import type { TenantCustomRole, RolePermissions } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { permissionGroups, type PermissionGroup } from '~/config/team-roles'

const props = defineProps<{
  modelValue: boolean
  role: TenantCustomRole | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const tenantStore = useTenantStore()
const message = useMessage()

const isEditing = computed(() => !!props.role?.id)

const saving = ref(false)
const form = reactive({
  name: '',
  permissions: {} as RolePermissions,
})

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      form.name = props.role?.name ?? ''
      form.permissions = { ...(props.role?.permissions ?? {}) }
    }
  },
)

const isGroupFullyChecked = (group: PermissionGroup) => group.permissions.every((p) => form.permissions[p.key] === true)

const isGroupPartiallyChecked = (group: PermissionGroup) => {
  const checked = group.permissions.filter((p) => form.permissions[p.key] === true).length

  return checked > 0 && checked < group.permissions.length
}

const toggleGroup = (group: PermissionGroup, checked: boolean) => {
  for (const perm of group.permissions) {
    form.permissions[perm.key] = checked
  }
}

const handleSave = async () => {
  if (!form.name.trim()) {
    message.warning('Введите название роли')

    return
  }

  saving.value = true
  try {
    if (isEditing.value) {
      await tenantStore.updateRole(props.role!.id, {
        name: form.name.trim(),
        permissions: form.permissions,
      })
      message.success('Роль обновлена')
    } else {
      await tenantStore.createRole(form.name.trim(), form.permissions)
      message.success('Роль создана')
    }
    emit('saved')
    emit('update:modelValue', false)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.permission-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.perm-group {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px 12px;
}

.group-header {
  margin-bottom: 6px;
}

.group-label {
  font-weight: 600;
}

.group-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 24px;
}
</style>
