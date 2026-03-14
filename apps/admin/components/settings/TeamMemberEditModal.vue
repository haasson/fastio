<template>
  <UiModal
    v-if="member"
    :model-value="modelValue"
    title="Редактировать участника"
    :width="400"
    :loading="saving"
    :actions="[
      { text: 'Отмена', type: 'default', actionType: 'decline' },
      { text: 'Сохранить', type: 'primary', actionType: 'confirm' },
    ]"
    :on-confirm="handleSave"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="form">
      <UiSelect
        v-model:value="form.role"
        label="Роль"
        :options="roleOptions"
      />
      <template v-if="branches.length > 0 && form.role !== 'admin' && form.role !== 'owner'">
        <UiRadioGroup
          v-model="branchMode"
          label="Доступ к филиалам"
          :options="branchAccessOptions"
        />
        <div v-if="branchMode === 'selected'" class="branch-checkboxes">
          <UiCheckbox
            v-for="branch in branches"
            :key="branch.id"
            :model-value="form.branchIds.includes(branch.id)"
            @update:model-value="toggleBranch(branch.id, $event)"
          >
            {{ branch.name }}
          </UiCheckbox>
        </div>
      </template>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { UiModal, UiSelect, UiRadioGroup, UiCheckbox } from '@fastio/ui'
import type { TenantRole, TenantMember } from '@fastio/shared'
import type { Branch } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { roleOptions } from '~/config/team-roles'

const props = defineProps<{
  modelValue: boolean
  member: TenantMember | null
  branches: Branch[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const api = useDatabase()

const saving = ref(false)
const form = reactive({ role: '' as TenantRole, branchIds: [] as string[] })
const branchMode = ref<'all' | 'selected'>('all')

const branchAccessOptions = [
  { label: 'Ко всем филиалам', value: 'all' },
  { label: 'К выбранным', value: 'selected' },
]

watch(
  () => props.modelValue,
  (open) => {
    if (open && props.member) {
      form.role = props.member.role
      form.branchIds = [...(props.member.branchIds ?? [])]
      branchMode.value = form.branchIds.length > 0 ? 'selected' : 'all'
    }
  },
)

watch(branchMode, (mode) => {
  if (mode === 'all') form.branchIds = []
})

const toggleBranch = (id: string, checked: boolean) => {
  if (checked) {
    if (!form.branchIds.includes(id)) form.branchIds.push(id)
  } else {
    form.branchIds = form.branchIds.filter((b) => b !== id)
  }
}

const handleSave = async () => {
  if (!props.member) return
  saving.value = true
  try {
    const branchIds = branchMode.value === 'all' ? [] : form.branchIds

    await api.members.updateRoleAndBranches(props.member.id, form.role, branchIds)
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
  gap: 12px;
}

.branch-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
