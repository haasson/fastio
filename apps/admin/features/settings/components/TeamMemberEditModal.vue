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
        v-model:value="form.roleId"
        label="Роль"
        :options="roleSelectOptions"
      />
      <template v-if="branches.length > 0">
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
import { ref, reactive, watch, computed } from 'vue'
import { UiModal, UiSelect, UiRadioGroup, UiCheckbox } from '@fastio/ui'
import type { TenantMember, Branch } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/shared/stores/tenant'

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
const tenantStore = useTenantStore()

const roleSelectOptions = computed(() => tenantStore.roles.map((r) => ({ value: r.id, label: r.name })),
)

const saving = ref(false)
const form = reactive({ roleId: '' as string, branchIds: [] as string[] })
const branchMode = ref<'all' | 'selected'>('all')

const branchAccessOptions = [
  { label: 'Ко всем филиалам', value: 'all' },
  { label: 'К выбранным', value: 'selected' },
]

watch(
  () => props.modelValue,
  (open) => {
    if (open && props.member) {
      form.roleId = props.member.roleId ?? ''
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

    await api.members.updateRoleAndBranches(props.member.id, form.roleId, branchIds)
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
  gap: var(--space-12);
}

.branch-checkboxes {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}
</style>
